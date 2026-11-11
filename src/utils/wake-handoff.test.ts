import test from "node:test";
import assert from "node:assert/strict";
import { WakeHandoffCoordinator, type WakeCandidate, type WakeRoutingSnapshot, type WakeTrigger } from "./wake-handoff";
import type { Alarm } from "./alarms";
const alarm: Alarm = { id: "a", hour: 7, minute: 0, days: [0,1,2,3,4,5,6], label: "Wake", sound: "system", enabled: true, challenge: "math", difficulty: "gentle", snooze: 5 };
const original: WakeCandidate = { id: "a", eventId: "registration:morning", sessionId: "registration:morning", createdAt: 100, kind: "scheduled", durable: true, native: true };
function harness(queue: WakeCandidate[] = [{ ...original }]) {
  const state: WakeRoutingSnapshot = { ready: true, active: true, navigationReady: true, route: { pathname: "/" }, data: { alarms: [alarm] } };
  const calls: WakeCandidate[] = [], modes: boolean[] = [], statuses: string[] = [], logs: string[] = [], acknowledgements: string[] = [];
  let readFailure = false, navigationFailure = false, cleanupFailure = false, commit = true, reads = 0;
  const controller = new WakeHandoffCoordinator({
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
    status: value => statuses.push(value.state),
    log: (event, _id, reason) => logs.push(`${event}:${reason}`),
  });
  return { state, queue, calls, modes, statuses, logs, acknowledgements, controller, check: (trigger: WakeTrigger = "tick") => controller.check(trigger),
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
  const controller = new WakeHandoffCoordinator({ snapshot: () => state,
    read: async () => { if (initial) { initial = false; await new Promise<void>(resolve => { release = resolve; }); return []; } return [original]; },
    navigate: target => { calls.push(target); }, status: value => statuses.push(value.state), log() {} });
  const first = controller.check("route"); await controller.check("native"); release(); await first;
  assert.deepEqual(statuses, ["pending"]); assert.deepEqual(calls, [original]);
});
test("an app becoming inactive during a native read does not navigate until resume", async () => {
  let release!: () => void;
  const state: WakeRoutingSnapshot = { ready: true, active: true, navigationReady: true, route: { pathname: "/" }, data: { alarms: [alarm] } };
  const calls: WakeCandidate[] = [];
  const controller = new WakeHandoffCoordinator({ snapshot: () => state,
    read: async () => { await new Promise<void>(resolve => { release = resolve; }); return [original]; },
    navigate: target => { calls.push(target); }, status() {}, log() {} });
  const first = controller.check("native"); state.active = false; release(); await first;
  assert.equal(calls.length, 0);
  state.active = true; const resumed = controller.check("resume"); release(); await resumed;
  assert.deepEqual(calls, [original]);
});
test("a silently uncommitted navigation retains native evidence and permits a guarded retry on resume", async () => {
  const h = harness(); h.commit(false); await h.check("native");
  await h.check("tick"); assert.equal(h.calls.length, 1); assert.equal(h.queue.length, 1);
  h.commit(true); await h.check("resume"); assert.equal(h.calls.length, 2);
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
