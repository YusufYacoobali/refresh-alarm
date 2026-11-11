import test from "node:test";
import assert from "node:assert/strict";
import { alarmMissions, copyAlarm, defaultMysterySettings, GAMEPLAY_KINDS, validateAlarm, validateMystery, type Alarm, type GameplayKind } from "./alarms";
import { generateMysterySequence } from "./mystery-sequence";
import { orderedSupplications, selectedSupplications, supplications } from "./supplications";
import { resolveMysterySession, validateWakeSession, wakeOccurrenceKey } from "./wake-session";

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
  for (const duaIds of [[], ["unknown"], ["waking", "waking"]]) assert.throws(() => validateMystery({ ...settings, duaIds } as any));
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
  assert.equal(resolveMysterySession(alarm, completed, { eventId: "test:active" }, undefined, morning + 60000), completed);
  const next = resolveMysterySession(alarm, completed, { eventId: "test:active" }, undefined, morning + 86400000);
  assert.notEqual(next.id, first.id);
  assert.deepEqual(GAMEPLAY_KINDS.length, 6);
  const weekly = { ...alarm, days: [5] };
  assert.equal(wakeOccurrenceKey(weekly, morning + 86400000), wakeOccurrenceKey(weekly, morning));
});
