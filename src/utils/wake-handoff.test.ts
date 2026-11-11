import test from "node:test";
import assert from "node:assert/strict";
import { WakeHandoffCoordinator, NAVIGATION_COMMIT_LIMIT_MS, type WakeCandidate, type WakeRoutingSnapshot, type WakeRoutingStatus, type WakeTrigger } from "./wake-handoff";
import type { Alarm } from "./alarms";
const alarm: Alarm = { id: "a", hour: 7, minute: 0, days: [0,1,2,3,4,5,6], label: "Wake", sound: "system", enabled: true, challenge: "math", difficulty: "gentle", snooze: 5 };
const original: WakeCandidate = { id: "a", eventId: "registration:morning", sessionId: "registration:morning", createdAt: 100, kind: "scheduled", durable: true, native: true };
function fakeClock() {
  let at = 0, nextId = 0;
  const timers = new Map<number, { at: number; callback(): void }>();
  return { now: () => at,
    schedule: (callback: () => void, delay: number) => {
      const id = ++nextId; timers.set(id, { at: at + delay, callback });
      return () => { timers.delete(id); };
    },
    advance: (ms: number) => {
      const end = at + ms;
      for (;;) {
        const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > end) break;
        at = next[1].at; timers.delete(next[0]); next[1].callback();
      }
      at = end;
    }, pending: () => timers.size };
}
function harness(queue: WakeCandidate[] = [{ ...original }]) {
  const state: WakeRoutingSnapshot = { ready: true, active: true, navigationReady: true, route: { pathname: "/" }, data: { alarms: [alarm] } };
  const time = fakeClock(), details: WakeRoutingStatus[] = [];
  const calls: WakeCandidate[] = [], modes: boolean[] = [], statuses: string[] = [], logs: string[] = [], acknowledgements: string[] = [];
  let readFailure = false, navigationFailure = false, cleanupFailure = false, commit = true, reads = 0;
  const controller = new WakeHandoffCoordinator({
    now: time.now, schedule: time.schedule,
    snapshot: () => state,
    read: async () => { reads++; if (readFailure) throw new Error("Native read unavailable"); return [...queue]; },
    navigate: (target, replace) => {
      calls.push(target); modes.push(replace);
      if (navigationFailure) throw new Error("Navigator not ready yet");
      if (commit) state.route = { pathname: "/ringing", id: target.id, eventId: target.eventId, sessionId: target.sessionId };
    },
    acknowledge: async (target, reason) => {
      acknowledgements.push(`${target.sessionId}:${reason}`);
      if (cleanupFailure) throw new Error("Native write unavailable");
      const index = queue.findIndex(q => q.sessionId === target.sessionId); if (index >= 0) queue.splice(index, 1);
    },
    status: value => { statuses.push(value.state); details.push(value); },
    log: (event, _id, reason) => logs.push(`${event}:${reason}`),
  });
  return { state, queue, calls, modes, statuses, details, logs, acknowledgements, controller, time, check: (trigger: WakeTrigger = "tick") => controller.check(trigger),
    failures: (read = false, navigation = false, cleanup = false) => { readFailure = read; navigationFailure = navigation; cleanupFailure = cleanup; },
    commit: (value: boolean) => { commit = value; }, reads: () => reads };
}

test("locked Stop remains pending through delayed unlock without reading or navigating behind the lock screen", async () => {
  const h = harness(); h.state.active = false;
  await h.check("native"); await h.check("tick");
  assert.equal(h.reads(), 0); assert.equal(h.calls.length, 0); assert.equal(h.queue.length, 1);
  h.state.active = true; await h.check("resume");
  assert.equal(h.calls[0].sessionId, original.sessionId); assert.equal(h.queue.length, 1);
});
test("terminated-app cold start resumes a persisted stopped alarm even when it is no longer alerting", async () => {
  const disk = JSON.parse(JSON.stringify([original]));
  const relaunched = harness(disk);
  await relaunched.check("resume");
  assert.deepEqual(relaunched.calls, [original]); assert.deepEqual(relaunched.modes, [true]);
  assert.equal(relaunched.acknowledgements.length, 0);
});
test("Stop while the app is running takes precedence over ordinary tabs", async () => {
  const h = harness([]); h.state.route = { pathname: "/journal" };
  await h.check(); h.queue.push({ ...original }); await h.check("native");
  assert.deepEqual(h.modes, [false]); assert.equal(h.state.route.pathname, "/ringing");
});
test("handoffs arriving before state hydration or navigator readiness are deferred, not consumed", async () => {
  const h = harness(); h.state.ready = false;
  await h.check("native"); assert.equal(h.reads(), 0);
  h.state.ready = true; h.state.navigationReady = false;
  await h.check("route"); assert.equal(h.calls.length, 0); assert.equal(h.queue.length, 1);
  h.state.navigationReady = true; await h.check("route"); assert.equal(h.calls.length, 1);
});
test("duplicate callbacks and delayed navigation commits cannot stack ringing screens or reset challenge progress", async () => {
  const h = harness(); h.commit(false);
  await h.check("native"); await h.check("native"); await h.check("tick");
  assert.equal(h.calls.length, 1);
  h.state.route = { pathname: "/challenge", id: "a", sessionId: original.sessionId, eventId: original.eventId };
  await h.check("route"); await h.check("native");
  assert.equal(h.calls.length, 1); assert.equal(h.queue.length, 1);
});
test("a new occurrence of the same repeating alarm is not suppressed by yesterday's completion", async () => {
  const h = harness(); h.state.data.wakeHandoffCompletions = { a: { sessionId: original.sessionId, completedAt: 200 } };
  await h.check(); assert.equal(h.calls.length, 0); assert.equal(h.queue.length, 0);
  const tomorrow = { ...original, eventId: "registration:tomorrow", sessionId: "registration:tomorrow", createdAt: 300 };
  h.queue.push(tomorrow); await h.check("native"); assert.deepEqual(h.calls, [tomorrow]);
});
test("two alarms firing close together remain independently pending and are presented one at a time", async () => {
  const second = { ...original, id: "b", eventId: "other:morning", sessionId: "other:morning", createdAt: 101 };
  const h = harness([{ ...original }, second]); h.state.data.alarms.push({ ...alarm, id: "b" });
  await h.check("native"); assert.equal(h.calls[0].id, "a"); assert.equal(h.queue.length, 2);
  h.state.route.pathname = "/challenge"; await h.check("native"); assert.equal(h.calls.length, 1);
  h.state.data.wakeHandoffCompletions = { a: { sessionId: original.sessionId, completedAt: 200 } };
  h.state.route = { pathname: "/success" }; await h.check("route");
  assert.equal(h.calls[1].id, "b"); assert.deepEqual(h.queue, [second]);
});
test("timeout and actual snooze deliveries restart the same Mystery session and leave its dua snapshot intact", async () => {
  const h = harness();
  const missions = [{ kind: "math", difficulty: "gentle" }, { kind: "shake", difficulty: "gentle" }, { kind: "supplication", difficulty: "gentle", duaIds: ["protection", "waking"] }] as any;
  h.state.data.wakeSessions = { a: { id: original.sessionId, occurrenceKey: "a:100", startedAt: 100, missions } };
  const before = JSON.stringify(h.state.data.wakeSessions);
  h.state.route = { pathname: "/challenge", id: "a", sessionId: original.sessionId, eventId: original.eventId };
  const timeout = { ...original, eventId: "backup:deadline", kind: "timeout" as const, reminder: "1" as const, createdAt: 200 };
  h.queue.push(timeout); await h.check("native");
  assert.equal(h.calls[0].sessionId, original.sessionId); assert.equal(h.calls[0].reminder, "1");
  h.state.route.pathname = "/challenge"; await h.check("tick"); assert.equal(h.calls.length, 1);
  h.state.data.snoozed = { alarmId: "a", at: 300, sessionId: original.sessionId, registration: { kind: "alarmkit", ids: ["snoozed-native"] } };
  h.queue.forEach(q => { q.deferred = true; }); h.state.route = { pathname: "/alarms" };
  await h.check("tick"); assert.equal(h.calls.length, 1);
  h.queue.push({ ...original, eventId: "snoozed-native:300", createdAt: 300, kind: "snooze" });
  await h.check("native"); assert.equal(h.calls[1].sessionId, original.sessionId);
  h.state.route.pathname = "/challenge";
  h.queue.push({ ...timeout, eventId: "post-snooze-backup:400", createdAt: 400, deferred: false });
  await h.check("native"); assert.equal(h.calls[2].reminder, "1");
  assert.equal(JSON.stringify(h.state.data.wakeSessions), before);
});
test("completed handoffs never reopen even if native cleanup temporarily fails", async () => {
  const h = harness(); h.state.data.wakeHandoffCompletions = { a: { sessionId: original.sessionId, completedAt: 200 } };
  h.failures(false, false, true); await h.check(); await h.check("native");
  assert.equal(h.calls.length, 0); assert.equal(h.statuses.at(-1), "clear"); assert.equal(h.queue.length, 1);
  h.failures(); await h.check("resume"); assert.equal(h.queue.length, 0); assert.equal(h.calls.length, 0);
});
test("transient native read failures preserve the pending handoff and do not resolve boot to ordinary tabs", async () => {
  const h = harness(); h.failures(true); await h.check();
  assert.equal(h.statuses.at(-1), "error"); assert.equal(h.queue.length, 1); assert.equal(h.calls.length, 0);
  h.failures(); await h.check("tick"); assert.equal(h.calls.length, 1);
});
test("navigation failures remain recoverable without an unguarded polling navigation loop", async () => {
  const h = harness(); h.failures(false, true); await h.check("native");
  assert.equal(h.statuses.at(-1), "error"); assert.equal(h.queue.length, 1);
  await h.check("tick"); await h.check("native"); assert.equal(h.calls.length, 1);
  h.failures(); await h.check("retry"); assert.equal(h.calls.length, 2); assert.equal(h.state.route.pathname, "/ringing");
});
test("a native callback during the initial lookup is resolved before boot can publish a clear result", async () => {
  let release!: () => void, initial = true;
  const state: WakeRoutingSnapshot = { ready: true, active: true, navigationReady: true, route: { pathname: "/" }, data: { alarms: [alarm] } };
  const statuses: string[] = [], calls: WakeCandidate[] = [];
  const controller = new WakeHandoffCoordinator({ ...fakeClock(), snapshot: () => state,
    read: async () => { if (initial) { initial = false; await new Promise<void>(resolve => { release = resolve; }); return []; } return [original]; },
    navigate: target => { calls.push(target); }, status: value => statuses.push(value.state), log() {} });
  const first = controller.check("route"); await controller.check("native"); release(); await first;
  assert.ok(statuses.every(state => state === "pending")); assert.deepEqual(calls, [original]);
});
test("an app becoming inactive during a native read does not navigate until resume", async () => {
  let release!: () => void;
  const state: WakeRoutingSnapshot = { ready: true, active: true, navigationReady: true, route: { pathname: "/" }, data: { alarms: [alarm] } };
  const calls: WakeCandidate[] = [];
  const controller = new WakeHandoffCoordinator({ ...fakeClock(), snapshot: () => state,
    read: async () => { await new Promise<void>(resolve => { release = resolve; }); return [original]; },
    navigate: target => { calls.push(target); }, status() {}, log() {} });
  const first = controller.check("native"); state.active = false; release(); await first;
  assert.equal(calls.length, 0);
  state.active = true; const resumed = controller.check("resume"); release(); await resumed;
  assert.deepEqual(calls, [original]);
});
test("a silently uncommitted navigation retains native evidence and permits an explicit retry after its watchdog fails", async () => {
  const h = harness(); h.commit(false); await h.check("native");
  await h.check("tick"); assert.equal(h.calls.length, 1); assert.equal(h.queue.length, 1);
  h.time.advance(NAVIGATION_COMMIT_LIMIT_MS);
  h.commit(true); await h.check("retry"); assert.equal(h.calls.length, 2);
  await h.check("native"); assert.equal(h.calls.length, 2);
});
test("old completed handoffs cannot reopen after the latest completion marker advances to another morning", async () => {
  const h = harness(); h.state.data.wakeHandoffCompletions = { a: { sessionId: "tomorrow", completedAt: 300, pendingCleanup: [original.sessionId] } };
  h.failures(false, false, true); await h.check("native");
  assert.equal(h.calls.length, 0); assert.equal(h.statuses.at(-1), "clear");
});
test("explicitly deleted alarms are cancelled only after hydration establishes ownership", async () => {
  const h = harness(); h.state.ready = false; h.state.data.alarms = [];
  h.state.data.wakeHandoffCancellations = [alarm.id];
  await h.check(); assert.equal(h.acknowledgements.length, 0);
  h.state.ready = true; await h.check();
  assert.deepEqual(h.acknowledgements, [`${original.sessionId}:deleted`]); assert.equal(h.calls.length, 0);
});
test("a missing saved alarm without an explicit deletion never silently clears a durable handoff", async () => {
  const h = harness(); h.state.data.alarms = [];
  await h.check("resume");
  assert.equal(h.acknowledgements.length, 0); assert.equal(h.queue.length, 1);
  assert.equal(h.statuses.at(-1), "error");
});

test("navigation is confirmed only by a committed route with the requested alarm, session and occurrence", async () => {
  const h = harness(); await h.check("native");
  assert.ok(h.logs.includes("navigation.accepted:route_committed"));
  assert.equal(h.time.pending(), 0); h.time.advance(10000);
  assert.equal(h.statuses.at(-1), "pending"); assert.equal(h.calls.length, 1);
});
test("an immediate navigation exception has no active watchdog and never automatically loops", async () => {
  const h = harness(); h.failures(false, true); await h.check("native");
  assert.equal(h.details.at(-1)?.reason, "navigation_rejected"); assert.equal(h.time.pending(), 0);
  h.time.advance(60000);
  for (const trigger of ["tick", "native", "route", "resume"] as const) await h.check(trigger);
  assert.equal(h.calls.length, 1); assert.deepEqual(h.queue, [original]);
});
test("silent navigation failure reaches a recoverable error after five active seconds with native evidence intact", async () => {
  const h = harness(); h.commit(false); await h.check("native");
  h.time.advance(NAVIGATION_COMMIT_LIMIT_MS - 1); assert.equal(h.statuses.at(-1), "pending");
  h.time.advance(1); assert.equal(h.statuses.at(-1), "error");
  assert.equal(h.details.at(-1)?.reason, "navigation_commit_timeout");
  assert.deepEqual(h.details.at(-1)?.target, original); assert.deepEqual(h.queue, [original]);
  assert.equal(h.acknowledgements.length, 0); assert.equal(h.time.pending(), 0);
  for (let i = 0; i < 3; i++) { await h.check("native"); h.time.advance(5000); await h.check("tick"); }
  assert.equal(h.calls.length, 1); assert.equal(h.statuses.at(-1), "error");
});
test("slow navigation that commits before the deadline cancels the watchdog", async () => {
  const h = harness(); h.commit(false); await h.check("native"); h.time.advance(4900);
  h.state.route = { pathname: "/ringing", id: original.id, eventId: original.eventId, sessionId: original.sessionId };
  h.controller.observe(); h.time.advance(20000); await h.check("route");
  assert.equal(h.time.pending(), 0); assert.equal(h.statuses.at(-1), "pending"); assert.equal(h.calls.length, 1);
});
test("a late successful route commit clears the timeout error without requesting another screen", async () => {
  const h = harness(); h.commit(false); await h.check("native"); h.time.advance(5000);
  h.state.route = { pathname: "/ringing", id: original.id, eventId: original.eventId, sessionId: original.sessionId };
  h.controller.observe(); await h.check("retry");
  assert.equal(h.statuses.at(-1), "pending"); assert.equal(h.calls.length, 1);
});
test("background time never consumes the active-app navigation budget or issues another navigation", async () => {
  const h = harness(); h.commit(false); await h.check("native"); h.time.advance(4000);
  h.state.active = false; h.controller.observe(); assert.equal(h.time.pending(), 0);
  h.time.advance(60000); assert.equal(h.statuses.at(-1), "pending");
  h.state.active = true; await h.check("resume"); assert.equal(h.calls.length, 1);
  h.time.advance(999); assert.equal(h.statuses.at(-1), "pending");
  h.time.advance(1); assert.equal(h.details.at(-1)?.reason, "navigation_commit_timeout");
});
test("watchdog timing is suspended on background platforms that can still accept a native alarm route", async () => {
  const h = harness(); h.commit(false); await h.check("native");
  h.state.foreground = false; h.controller.observe(); h.time.advance(60000);
  assert.equal(h.time.pending(), 0); assert.equal(h.statuses.at(-1), "pending");
  h.state.foreground = true; h.controller.observe(); h.time.advance(5000);
  assert.equal(h.statuses.at(-1), "error");
});
test("manual retry replaces the failed destination once and keeps the same Mystery snapshot", async () => {
  const h = harness(); h.state.route = { pathname: "/journal" }; h.commit(false);
  h.state.data.wakeSessions = { a: { id: original.sessionId, occurrenceKey: "a:100", startedAt: 100,
    missions: [{ kind: "math", difficulty: "gentle" }, { kind: "shake", difficulty: "bright" }, { kind: "supplication", difficulty: "gentle", duaIds: ["protection", "waking"] }] } };
  const before = JSON.stringify(h.state.data.wakeSessions);
  await h.check("native"); h.time.advance(5000); h.commit(true); await h.check("retry");
  await h.check("retry"); await h.check("native");
  assert.deepEqual(h.modes, [false, true]); assert.equal(h.calls.length, 2);
  assert.equal(JSON.stringify(h.state.data.wakeSessions), before); assert.deepEqual(h.queue, [original]);
});
for (const [name, mutate] of [
  ["completed", (h: ReturnType<typeof harness>) => { h.state.data.wakeHandoffCompletions = { a: { sessionId: original.sessionId, completedAt: 1 } }; }],
  ["cancelled", (h: ReturnType<typeof harness>) => { h.state.data.wakeHandoffCancellations = ["a"]; }],
  ["snoozed", (h: ReturnType<typeof harness>) => { h.state.data.snoozed = { alarmId: "a", at: 1000, sessionId: original.sessionId, registration: { kind: "alarmkit", ids: ["snooze"] } }; }],
] as const) test(`the watchdog is cancelled when its target becomes ${name}`, async () => {
  const h = harness(); h.commit(false); await h.check("native"); mutate(h); h.controller.observe();
  assert.equal(h.time.pending(), 0); h.time.advance(60000);
  assert.equal(h.statuses.at(-1), "clear"); assert.equal(h.calls.length, 1);
});
test("a superseding timeout gets its own bounded request without changing the original session", async () => {
  const h = harness(); h.commit(false); await h.check("native"); h.time.advance(3000);
  const reminder = { ...original, eventId: "backup:200", createdAt: 200, reminder: "1" as const, kind: "timeout" as const };
  h.queue.push(reminder); await h.check("native"); assert.equal(h.calls.length, 2);
  h.time.advance(2000); assert.equal(h.statuses.at(-1), "pending");
  h.time.advance(3000); assert.equal(h.details.at(-1)?.target?.eventId, reminder.eventId);
  assert.equal(h.details.at(-1)?.target?.sessionId, original.sessionId);
});
test("a failed handoff survives coordinator disposal and a fresh app launch with the same identity", async () => {
  const first = harness(); first.commit(false); await first.check("native"); first.time.advance(5000);
  const disk = JSON.parse(JSON.stringify(first.queue)); first.controller.dispose();
  const relaunched = harness(disk); await relaunched.check("resume");
  assert.deepEqual(relaunched.calls, [original]); assert.deepEqual(relaunched.queue, [original]);
});
test("the watchdog can fail independently of a later stalled native read", async () => {
  const time = fakeClock(), state = harness().state, statuses: WakeRoutingStatus[] = [];
  let reads = 0, release!: (targets: WakeCandidate[]) => void, calls = 0;
  const controller = new WakeHandoffCoordinator({ ...time, snapshot: () => state,
    read: async () => ++reads === 1 ? [original] : new Promise(resolve => { release = resolve; }),
    navigate: () => { calls++; }, status: value => statuses.push(value), log() {} });
  await controller.check("native"); const blocked = controller.check("tick"); time.advance(5000);
  assert.equal(statuses.at(-1)?.reason, "navigation_commit_timeout");
  release([original]); await blocked; assert.equal(statuses.at(-1)?.state, "error"); assert.equal(calls, 1);
});
for (const [name, patch] of [
  ["another screen", { pathname: "/alarms" }], ["another alarm", { id: "b" }],
  ["another occurrence", { eventId: "wrong" }], ["another session", { sessionId: "wrong" }],
  ["a missing session parameter", { sessionId: undefined }], ["a preview", { preview: "1" }],
] as const) test(`navigation is not confirmed by ${name}`, async () => {
  const h = harness(); h.commit(false); await h.check("native");
  h.state.route = { pathname: "/ringing", id: original.id, eventId: original.eventId, sessionId: original.sessionId, ...patch };
  await h.check("route"); h.time.advance(5000);
  assert.equal(h.details.at(-1)?.reason, "navigation_commit_timeout"); assert.equal(h.calls.length, 1);
  assert.ok(!h.logs.some(log => log.startsWith("navigation.accepted")));
});

test("duplicate native callbacks cannot overwrite a manual retry queued during an in-flight lookup", async () => {
  const time = fakeClock(), state = harness().state;
  let reads = 0, calls = 0, release!: (targets: WakeCandidate[]) => void;
  const controller = new WakeHandoffCoordinator({ ...time, snapshot: () => state,
    read: async () => ++reads === 2 ? new Promise(resolve => { release = resolve; }) : [original],
    navigate: () => { calls++; }, status() {}, log() {} });
  await controller.check("native"); time.advance(5000);
  const blocked = controller.check("tick");
  await controller.check("retry"); await controller.check("native"); await controller.check("tick");
  release([original]); await blocked;
  assert.equal(calls, 2); assert.equal(reads, 3); controller.dispose();
});
