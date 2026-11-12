import test from "node:test";
import assert from "node:assert/strict";
import { alarmMissions, copyAlarm, defaultMysterySettings, editableMysterySettings, GAMEPLAY_KINDS, sameAlarmDeliverySettings, validateAlarm, validateMystery, validateMissions, missionSummary, type Alarm, type GameplayKind } from "./alarms";
import { generateMysterySequence } from "./mystery-sequence";
import { orderedSupplications, selectedSupplications, supplications } from "./supplications";
import { cleanWakeData, completeWakeSession, createDuaRecoverySession, resolveMysterySession, sameWakeSession, validateWakeSession, wakeHistory, wakeOccurrenceKey, WakeRoutineError } from "./wake-session";

function rng(seed: number) { return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32); }
const settings = defaultMysterySettings();
const alarm: Alarm = { id: "test", hour: 7, minute: 0, days: [0, 1, 2, 3, 4, 5, 6], label: "Test", enabled: true, sound: "system", challenge: "math", difficulty: "gentle", snooze: 5, missionMode: "mystery", mystery: settings };
const morning = +new Date(2026, 8, 18, 7, 0);

test("all pool sizes choose 2–4 distinct eligible games and keep exact per-game settings", () => {
  for (let size = 2; size <= 6; size++) {
    const config = { ...settings, games: settings.games.slice(0, size).map((m, i) => ({ ...m, difficulty: i % 2 ? "bright" as const : "gentle" as const, rounds: i + 1 })) };
    const before = JSON.stringify(config);
    const counts = new Set<number>(), orders = new Set<string>();
    for (let seed = 1; seed < 120; seed++) {
      const sequence = generateMysterySequence(config, [], rng(seed * 9187));
      const games = sequence.slice(0, -1);
      assert.ok(games.length >= 2 && games.length <= Math.min(4, size));
      assert.equal(new Set(games.map(m => m.kind)).size, games.length);
      for (const m of games) assert.deepEqual(m, config.games.find(g => g.kind === m.kind));
      counts.add(games.length); orders.add(games.map(m => m.kind).join(","));
      assert.equal(sequence.at(-1)!.kind, "supplication");
    }
    assert.deepEqual([...counts].sort(), Array.from({ length: Math.min(4, size) - 1 }, (_, i) => i + 2));
    assert.ok(orders.size > 1);
    assert.equal(JSON.stringify(config), before);
  }
});

test("individual duas shuffle without losing choices, order, or recitation counts", () => {
  const orders = new Set<string>();
  for (let seed = 1; seed <= 100; seed++) {
    const sequence = generateMysterySequence(settings, [], rng(seed * 37));
    const ids = sequence.at(-1)!.duaIds!;
    assert.deepEqual([...ids].sort(), [...settings.duaIds].sort());
    assert.deepEqual(orderedSupplications(ids).map(d => d.id), ids);
    for (const dua of orderedSupplications(ids)) assert.equal(dua.repetitions, supplications.find(d => d.id === dua.id)!.repetitions);
    orders.add(ids.join(","));
  }
  assert.ok(orders.size > 1);
  assert.deepEqual(selectedSupplications(["protection", "waking"]).map(d => d.id), ["waking", "protection"]);
  const single = generateMysterySequence({ ...settings, duaIds: ["protection"] });
  assert.deepEqual(single.at(-1)!.duaIds, ["protection"]);
});

test("optional Fajr occurs on either side of supplication after every game", () => {
  const positions = new Set<number>();
  for (let seed = 1; seed < 100; seed++) {
    const sequence = generateMysterySequence({ ...settings, fajr: true }, [], rng(seed * 931));
    const fajr = sequence.findIndex(m => m.kind === "fajr_reminder");
    const dua = sequence.findIndex(m => m.kind === "supplication");
    assert.equal(Math.abs(fajr - dua), 1);
    assert.equal(Math.min(fajr, dua), sequence.length - 2);
    positions.add(fajr - dua);
  }
  assert.deepEqual([...positions].sort(), [-1, 1]);
  assert.ok(generateMysterySequence(settings).every(m => m.kind !== "fajr_reminder"));
});

test("a repeated gameplay sequence is avoided even with a constant RNG and a two-game pool", () => {
  const config = { ...settings, games: settings.games.slice(0, 2) };
  const first = generateMysterySequence(config, [], () => 0);
  const previous = first.slice(0, 2).map(m => m.kind as GameplayKind);
  const second = generateMysterySequence(config, previous, () => 0);
  assert.deepEqual(second.slice(0, 2).map(m => m.kind), [...previous].reverse());
});

test("invalid pools, duplicate games, settings, duas and modes cannot be saved", () => {
  for (const games of [[], settings.games.slice(0, 1), [settings.games[0], settings.games[0]], [{ kind: "supplication", difficulty: "gentle" }], [{ ...settings.games[0], rounds: 11 }, settings.games[1]]])
    assert.throws(() => validateMystery({ ...settings, games } as any));
  for (const duaIds of [undefined, ["unknown"], ["waking", "waking"]]) assert.throws(() => validateMystery({ ...settings, duaIds } as any));
  assert.throws(() => validateAlarm({ ...alarm, mystery: undefined }));
  assert.throws(() => validateAlarm({ ...alarm, missionMode: "random" as any }));
  assert.doesNotThrow(() => validateAlarm(alarm));
});

test("legacy alarms remain Manual and copies have independent Mystery settings", () => {
  const { missionMode: _, mystery: __, ...legacy } = alarm;
  assert.doesNotThrow(() => validateAlarm(legacy));
  assert.deepEqual(alarmMissions(legacy), [{ kind: "math", difficulty: "gentle" }]);
  assert.equal((legacy as Alarm).missionMode, undefined);
  const copy = copyAlarm(alarm, "copy", []);
  copy.mystery!.games[0].rounds = 9;
  copy.mystery!.duaIds.pop();
  assert.equal(settings.games[0].rounds, undefined);
  assert.equal(settings.duaIds.length, 3);
});

test("Android reminders retain the original session across timeout IDs and cold launches", () => {
  const first = resolveMysterySession(alarm, undefined, { eventId: "native:initial", sessionId: "native:initial" }, undefined, morning, rng(1));
  const same = resolveMysterySession(alarm, first, { eventId: "native:reminder:1", sessionId: first.id }, undefined, morning + 60000, rng(3));
  assert.equal(same, first);
  const cold = JSON.parse(JSON.stringify(first));
  assert.deepEqual(resolveMysterySession(alarm, cold, { eventId: "native:reminder:2", sessionId: first.id }, undefined, morning + 120000), first);
  // Older binaries have no sessionId. Both native and JS reminder IDs still reuse it.
  assert.equal(resolveMysterySession(alarm, first, { eventId: "native:reminder:3" }, undefined, morning + 180000), first);
  assert.equal(resolveMysterySession(alarm, first, { reminder: true }, undefined, morning + 86400000), first);
});

test("persisted routines validate after settings changes and reject incomplete or corrupt sequences", () => {
  const first = resolveMysterySession(alarm, undefined, {}, undefined, morning);
  assert.doesNotThrow(() => validateWakeSession(alarm, JSON.parse(JSON.stringify(first))));
  assert.doesNotThrow(() => validateWakeSession({ ...alarm, mystery: { ...settings, games: settings.games.slice(0, 2) } }, first));
  assert.throws(() => validateWakeSession(alarm, { ...first, missions: first.missions.slice(0, 1) }));
  assert.throws(() => validateWakeSession(alarm, { ...first, missions: [...first.missions].reverse() }));
  assert.throws(() => validateWakeSession(alarm, { ...first, startedAt: NaN }));
  assert.throws(() => validateWakeSession(alarm, { ...first, missions: first.missions.map((m, i) => i === 0 ? { ...m, rounds: 10 } : m) }));
});

test("snooze retains the sequence; a genuine scheduled wake-up replaces it even with a pending snooze", () => {
  const first = resolveMysterySession(alarm, undefined, { sessionId: "original" }, undefined, morning);
  const snoozed = { alarmId: alarm.id, at: morning + 300000, sessionId: first.id, registration: { kind: "android" as const, ids: ["snooze-native"] } };
  assert.equal(resolveMysterySession(alarm, first, { eventId: "snooze-native:time", sessionId: "new-native-id" }, snoozed, snoozed.at), first);
  assert.equal(resolveMysterySession(alarm, first, { eventId: `snooze-${snoozed.at}` }, snoozed, snoozed.at), first);
  const next = resolveMysterySession(alarm, first, { eventId: "scheduled:tomorrow", sessionId: "tomorrow" }, snoozed, morning + 86400000);
  assert.notEqual(next.id, first.id);
});

test("iOS active identifiers and browser launches reuse persisted occurrences and change at the next scheduled wake-up", () => {
  const first = resolveMysterySession(alarm, undefined, { eventId: "test:active" }, undefined, morning);
  const completed = { ...first, completed: true };
  assert.throws(() => resolveMysterySession(alarm, completed, { eventId: "test:active" }, undefined, morning + 60000), WakeRoutineError);
  const next = resolveMysterySession(alarm, completed, { eventId: "test:active" }, undefined, morning + 86400000);
  assert.notEqual(next.id, first.id);
  assert.deepEqual(GAMEPLAY_KINDS.length, 6);
  const weekly = { ...alarm, days: [5] };
  assert.equal(wakeOccurrenceKey(weekly, morning + 86400000), wakeOccurrenceKey(weekly, morning));
});

test("only the active configuration validates, and corrupt inactive choices remain preserved", () => {
  const manual = { ...alarm, missionMode: "manual" as const, mystery: { ...settings, games: [] } };
  assert.doesNotThrow(() => validateAlarm(manual));
  const mystery = { ...alarm, missions: [{ kind: "unknown" }] as any };
  assert.doesNotThrow(() => validateAlarm(mystery));
  assert.throws(() => validateAlarm({ ...manual, missionMode: "mystery" }));
  assert.doesNotThrow(() => validateAlarm({ ...manual, missionMode: "mystery" }, { missionConfig: false }));
  const editable = editableMysterySettings({ games: [], duaIds: [], fajr: false });
  assert.deepEqual(editable.games, []);
  assert.deepEqual(editable.duaIds, []);
});

test("active snapshots survive mode, schedule, pool and difficulty changes", () => {
  const first = resolveMysterySession(alarm, undefined, {}, undefined, morning);
  const changed = { ...alarm, missionMode: "manual" as const, hour: 8, mystery: { ...settings, games: [] } };
  assert.doesNotThrow(() => validateWakeSession(changed, first));
  assert.equal(resolveMysterySession(changed, first, { eventId: "test:active" }, undefined, morning + 60000), first);
  assert.equal(resolveMysterySession(changed, first, { reminder: true }, undefined, morning + 86400000), first);
  assert.equal(sameWakeSession(changed, first, { sessionId: "tomorrow" }, undefined, morning + 86400000), false);
});

test("mission-only edits preserve native delivery settings while delivery changes remain distinguishable", () => {
  assert.equal(sameAlarmDeliverySettings(alarm, { ...alarm, missionMode: "manual", missions: [], mystery: { ...settings, games: [] }, wallpaper: "local-photo" }), true);
  assert.equal(sameAlarmDeliverySettings(alarm, { ...alarm, sound: "lofi" }), false);
  assert.equal(sameAlarmDeliverySettings(alarm, { ...alarm, hour: 9 }), false);
  const inactiveCorrupt = { ...alarm, missionMode: "manual" as const, mystery: { games: null } as any };
  assert.doesNotThrow(() => copyAlarm(inactiveCorrupt, "copy", []));
});

test("completed sessions clear their full snapshot and retain only bounded history for next-occurrence avoidance", () => {
  const config = { ...settings, games: settings.games.slice(0, 2) };
  const configured = { ...alarm, mystery: config };
  const first = resolveMysterySession(configured, undefined, {}, undefined, morning, () => 0);
  const before = { wakeSessions: { test: first }, mysteryHistory: {} };
  const done = completeWakeSession(before, "test", morning + 1000);
  assert.deepEqual(done.wakeSessions, {});
  assert.equal(before.wakeSessions.test, first);
  const history = done.mysteryHistory!.test;
  assert.equal("missions" in history, false);
  assert.equal("config" in history, false);
  assert.throws(() => resolveMysterySession(configured, undefined, {}, undefined, morning + 2000, () => 0, history), WakeRoutineError);
  const next = resolveMysterySession(configured, undefined, {}, undefined, morning + 86400000, () => 0, history);
  assert.notDeepEqual(wakeHistory(next).gameplay, history.gameplay);
});

test("hydration migrates completed v3 records, prunes deleted alarms, and quarantines corrupt sessions", () => {
  const first = resolveMysterySession(alarm, undefined, {}, undefined, morning);
  const cleaned = cleanWakeData([alarm], { wakeSessions: { test: { ...first, completed: true }, deleted: first } });
  assert.deepEqual(cleaned.wakeSessions, {});
  assert.deepEqual(Object.keys(cleaned.mysteryHistory), ["test"]);
  const corrupt = { ...first, missions: [] };
  const restored = cleanWakeData([alarm], { wakeSessions: { test: corrupt }, mysteryHistory: { deleted: wakeHistory(first) } });
  assert.deepEqual(restored.wakeSessions, {});
  assert.deepEqual(restored.mysteryHistory, {});
  assert.deepEqual(restored.wakeSessionRecovery.test.saved, corrupt);
  for (const value of [null, [], "broken", { test: null }])
    assert.ok(cleanWakeData([alarm], { wakeSessions: value as any }).wakeSessionRecovery.test);
  assert.deepEqual(cleanWakeData([{ ...alarm, missionMode: "manual" }], { wakeSessions: null as any }).wakeSessionRecovery, {});
});

test("different alarms on the same day retain independent sessions and cleanup", () => {
  const otherAlarm = { ...alarm, id: "other" };
  const first = resolveMysterySession(alarm, undefined, {}, undefined, morning);
  const other = resolveMysterySession(otherAlarm, undefined, {}, undefined, morning);
  assert.notEqual(first.id, other.id);
  const done = completeWakeSession({ wakeSessions: { test: first, other } }, "test");
  assert.deepEqual(done.wakeSessions, { other });
  assert.deepEqual(cleanWakeData([otherAlarm], done).mysteryHistory, {});
});

test("explicit dua recovery introduces no games and stays stable after settings are repaired", () => {
  const broken = { ...alarm, mystery: { games: [], duaIds: ["protection" as const], fajr: true } };
  const recovered = createDuaRecoverySession(broken, { sessionId: "original" }, undefined, morning, () => 0);
  assert.doesNotThrow(() => validateWakeSession(broken, recovered));
  assert.deepEqual(recovered.missions.map(m => m.kind), ["fajr_reminder", "supplication"]);
  assert.deepEqual(recovered.missions[1].duaIds, ["protection"]);
  assert.equal(resolveMysterySession(alarm, recovered, { sessionId: "original", reminder: true }, undefined, morning + 60000), recovered);
  assert.deepEqual(wakeHistory(recovered).gameplay, []);
});

test("Random Pick accepts no duas without changing Set Order or legacy supplication validation", () => {
  const config = { ...settings, duaIds: [] };
  assert.doesNotThrow(() => validateMystery(config));
  assert.doesNotThrow(() => validateAlarm({ ...alarm, mystery: config }));
  assert.deepEqual(editableMysterySettings(config).duaIds, []);
  assert.deepEqual(copyAlarm({ ...alarm, mystery: config }, "copy", []).mystery!.duaIds, []);
  assert.ok(!missionSummary({ ...alarm, mystery: config }).includes("Morning duas"));
  assert.ok(missionSummary({ ...alarm, mystery: { ...config, fajr: true } }).endsWith("Fajr"));
  assert.throws(() => validateMissions([{ kind: "supplication", difficulty: "gentle", duaIds: [] }]));
  assert.deepEqual(selectedSupplications().map(d => d.id), settings.duaIds);
});

for (const fajr of [false, true]) test(`routines without duas choose distinct games with Fajr ${fajr ? "last" : "omitted"}`, () => {
  for (let size = 2; size <= 6; size++) {
    const config = { ...settings, games: settings.games.slice(0, size), duaIds: [], fajr };
    const before = JSON.stringify(config);
    for (let seed = 1; seed <= 50; seed++) {
      const routine = generateMysterySequence(config, [], rng(seed * 9187));
      const games = routine.filter(m => GAMEPLAY_KINDS.includes(m.kind as GameplayKind));
      assert.ok(games.length >= 2 && games.length <= Math.min(4, size));
      assert.equal(new Set(games.map(m => m.kind)).size, games.length);
      assert.ok(!routine.some(m => m.kind === "supplication"));
      assert.equal(routine.length, games.length + Number(fajr));
      if (fajr) assert.equal(routine.at(-1)!.kind, "fajr_reminder");
      for (const game of games) assert.deepEqual(game, config.games.find(m => m.kind === game.kind));
    }
    assert.equal(JSON.stringify(config), before);
  }
});

for (const fajr of [false, true]) test(`no-dua snapshots with Fajr ${fajr ? "on" : "off"} survive hydration, timeout and snooze`, () => {
  const configured = { ...alarm, mystery: { ...settings, games: settings.games.slice(0, 2), duaIds: [], fajr } };
  const first = resolveMysterySession(configured, undefined, { sessionId: "no-duas" }, undefined, morning, rng(4));
  const restored = cleanWakeData([configured], JSON.parse(JSON.stringify({ wakeSessions: { test: first } })));
  assert.deepEqual(restored.wakeSessions.test, first); assert.deepEqual(restored.wakeSessionRecovery, {});
  assert.equal(resolveMysterySession(configured, first, { sessionId: first.id, reminder: true }, undefined, morning + 60000), first);
  const snoozed = { alarmId: alarm.id, at: morning + 300000, registration: { kind: "alarmkit" as const, ids: ["snooze"] }, sessionId: first.id };
  assert.equal(resolveMysterySession(configured, first, { eventId: "snooze:delivery" }, snoozed, snoozed.at), first);
  const next = resolveMysterySession(configured, first, { sessionId: "tomorrow" }, undefined, morning + 86400000, rng(5));
  assert.notEqual(next.id, first.id); assert.ok(!next.missions.some(m => m.kind === "supplication"));
  assert.doesNotThrow(() => validateWakeSession(configured, next));
  assert.throws(() => validateWakeSession(configured, { ...first, config: undefined }));
  assert.throws(() => validateWakeSession(configured, { ...first, missions: [...first.missions, { kind: "supplication", difficulty: "gentle" }] }));
  const existing = resolveMysterySession(alarm, undefined, { sessionId: "with-duas" }, undefined, morning, rng(1));
  assert.equal(resolveMysterySession(configured, existing, { sessionId: existing.id }, undefined, morning + 60000), existing);
  assert.throws(() => validateWakeSession(configured, { ...existing, missions: existing.missions.filter(m => m.kind !== "supplication") }));
});
