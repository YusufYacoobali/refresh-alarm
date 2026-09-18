import test from "node:test";
import assert from "node:assert/strict";
import { missionSecondsLeft } from "./alarm-playback";

test("mission countdown uses elapsed wall time, including time spent asleep", () => {
  const deadline = 100_000;
  assert.equal(missionSecondsLeft(deadline, 40_000), 60);
  assert.equal(missionSecondsLeft(deadline, 99_001), 1);
  assert.equal(missionSecondsLeft(deadline, 100_000), 0);
  assert.equal(missionSecondsLeft(deadline, 180_000), 0);
});
import {
  nextOccurrence,
  nextAlarmAt,
  repeatLabel,
  displayTime,
  validateAlarm,
  mathQuestion,
  memoryDeck,
  Alarm,
  alarmMissions,
  missionDescription,
  missionRounds,
  missionSummary,
  copyAlarm,
  orderAlarms,
} from "./alarms";
const alarm: Alarm = {
  id: "test",
  hour: 7,
  minute: 0,
  days: [1, 2, 3, 4, 5],
  label: "Morning",
  enabled: true,
  challenge: "math",
  difficulty: "gentle",
  sound: "system",
  snooze: 5,
};

test("alarm ordering defaults to clock time and preserves ties without mutating records", () => {
  const input = [{ ...alarm, id: "evening", hour: 19 }, { ...alarm, id: "later", minute: 30 },
    { ...alarm, id: "morning", enabled: false }, { ...alarm, id: "same" }, { ...alarm, id: "midnight", hour: 0 }];
  assert.deepEqual(orderAlarms(input).map(a => a.id), ["midnight", "morning", "same", "later", "evening"]);
  assert.equal(input[0].id, "evening");
  assert.equal(orderAlarms(input)[1], input[2]);
});

test("manual ordering tolerates deleted alarms and appends new alarms by time", () => {
  const input = [{ ...alarm, id: "one" }, { ...alarm, id: "two", hour: 8 },
    { ...alarm, id: "new-late", hour: 23 }, { ...alarm, id: "new-early", hour: 1 }];
  assert.deepEqual(orderAlarms(input, ["two", "deleted", "one"]).map(a => a.id), ["two", "one", "new-early", "new-late"]);
});

test("duplicating an alarm preserves its settings with independent identity and mission data", () => {
  const original: Alarm = { ...alarm, missions: [{ kind: "memory", difficulty: "bright", rounds: 3 }],
    wallpaper: "file:///wallpaper.png", volume: .6, silentMissions: true,
    registration: { kind: "alarmkit", ids: ["native-id"] }, nextAt: 12345 };
  const copy = copyAlarm(original, "new-id", [original.label]);
  assert.equal(copy.id, "new-id");
  assert.equal(copy.label, "Morning (copy)");
  assert.equal(copy.registration, undefined);
  assert.equal(copy.nextAt, undefined);
  assert.equal(copy.wallpaper, original.wallpaper);
  assert.equal(copy.volume, original.volume);
  assert.equal(copy.enabled, original.enabled);
  assert.deepEqual(copy.missions, original.missions);
  copy.missions![0].rounds = 1;
  copy.days.push(0);
  assert.equal(original.missions![0].rounds, 3);
  assert.deepEqual(original.days, [1, 2, 3, 4, 5]);
  assert.doesNotThrow(() => validateAlarm(copy));
});

test("duplicate names are unique and stay within the label length limit", () => {
  assert.equal(copyAlarm(alarm, "copy-2", ["Morning (copy)"]).label, "Morning (copy 2)");
  const long = { ...alarm, label: "A".repeat(48), enabled: false };
  const copy = copyAlarm(long, "copy", []);
  assert.equal(copy.label.length, 48);
  assert.equal(copy.enabled, false);
  assert.doesNotThrow(() => validateAlarm(copy));
});

test("next alarm ignores disabled alarms and passed one-offs", () => {
  const now = new Date(2026, 8, 18, 8, 0);
  const monday = new Date(2026, 8, 21, 7, 0);
  assert.equal(+nextAlarmAt([
    { ...alarm, enabled: false, hour: 9 },
    { ...alarm, days: [], nextAt: +now - 60000 },
    alarm,
  ], undefined, now)!, +monday);
  assert.equal(nextAlarmAt([{ ...alarm, enabled: false }], undefined, now), null);
  assert.equal(nextAlarmAt([], undefined, now), null);
});

test("next alarm selects the earliest saved one-off or snooze", () => {
  const now = new Date(2026, 8, 18, 6, 0);
  const once = { ...alarm, id: "once", days: [], nextAt: +now + 600000 };
  assert.equal(+nextAlarmAt([alarm, once], undefined, now)!, once.nextAt);
  assert.equal(+nextAlarmAt([alarm, once], { alarmId: "test", at: +now + 300000 }, now)!, +now + 300000);
  assert.equal(+nextAlarmAt([alarm, once], { alarmId: "test", at: +now + 1200000 }, now)!, once.nextAt);
  assert.equal(+nextAlarmAt([alarm, once], { alarmId: "test", at: +now - 1 }, now)!, once.nextAt);
});
test("a passed Friday alarm advances to Monday, preserving local wall time", () => {
  const now = new Date(2026, 8, 18, 8, 0);
  const next = nextOccurrence(alarm, now);
  assert.equal(next.getDay(), 1);
  assert.equal(next.getDate(), 21);
  assert.equal(next.getHours(), 7);
});
test("one-off alarm at the current minute is tomorrow, never immediately", () => {
  const now = new Date(2026, 8, 15, 7, 0, 30);
  const next = nextOccurrence({ ...alarm, days: [] }, now);
  assert.equal(next.getDate(), 16);
  assert.equal(next.getHours(), 7);
});
test("single-day recurrence rolls a full week when today’s time passed", () => {
  const now = new Date(2026, 8, 15, 8, 0);
  const next = nextOccurrence({ ...alarm, days: [2] }, now);
  assert.equal(next.getDate(), 22);
});
test("midnight and noon display correctly", () => {
  assert.equal(displayTime({ hour: 0, minute: 5 }), "12:05");
  assert.equal(displayTime({ hour: 12, minute: 0 }), "12:00");
});
test("invalid schedules are rejected before notification requests", () => {
  for (const patch of [
    { hour: 24 },
    { minute: -1 },
    { days: [7] },
    { days: [1, 1] },
    { label: " " },
  ])
    assert.throws(() => validateAlarm({ ...alarm, ...patch }));
});
test("repeat labels distinguish weekdays, weekends, and once", () => {
  assert.equal(repeatLabel([1, 2, 3, 4, 5]), "Weekdays");
  assert.equal(repeatLabel([6, 0]), "Weekends");
  assert.equal(repeatLabel([]), "Once");
});
test("memory decks always contain exactly four pairs", () => {
  for (let i = 0; i < 100; i++) {
    const deck = memoryDeck();
    assert.equal(deck.length, 8);
    for (let n = 0; n < 4; n++)
      assert.equal(deck.filter((v) => v === n).length, 2);
  }
});
test("gentle and bright questions return correct arithmetic", () => {
  const gentle = mathQuestion("gentle", () => 0.5),
    bright = mathQuestion("bright", () => 0.5);
  assert.equal(gentle.text, "6 + 6");
  assert.equal(gentle.answer, 12);
  assert.equal(bright.text, "9 × 6");
  assert.equal(bright.answer, 54);
});
test("legacy alarms retain their mission and new empty sequences mean no missions", () => {
  assert.deepEqual(alarmMissions(alarm), [{ kind: "math", difficulty: "gentle" }]);
  assert.deepEqual(alarmMissions({ ...alarm, missions: [] }), []);
  const missions = [{ kind: "shake" as const, difficulty: "bright" as const }, { kind: "math" as const, difficulty: "gentle" as const }];
  assert.deepEqual(alarmMissions({ ...alarm, missions }), missions);
  assert.doesNotThrow(() => validateAlarm({ ...alarm, missions, snooze: 0 }));
});
test("mission validation rejects duplicates, invalid difficulty, and unknown kinds", () => {
  for (const missions of [
    [{ kind: "math", difficulty: "gentle" }, { kind: "math", difficulty: "bright" }],
    [{ kind: "memory", difficulty: "unknown" }],
    [{ kind: "none", difficulty: "gentle" }],
    [null],
  ]) assert.throws(() => validateAlarm({ ...alarm, missions } as Alarm));
  assert.throws(() => validateAlarm({ ...alarm, snooze: -1 }));
  assert.equal(missionDescription("shake", "bright"), "20 separate shakes");
  assert.equal(missionDescription("memory", "gentle"), "4 pairs · 2-second preview");
});

test("supplication can be saved alone, in legacy format, or with all other missions", () => {
  const supplication = { kind: "supplication" as const, difficulty: "gentle" as const };
  assert.doesNotThrow(() => validateAlarm({ ...alarm, challenge: "supplication", missions: [supplication] }));
  assert.deepEqual(alarmMissions({ ...alarm, challenge: "supplication" }), [supplication]);
  assert.doesNotThrow(() => validateAlarm({ ...alarm, missions: [
    supplication,
    { kind: "math", difficulty: "gentle" },
    { kind: "memory", difficulty: "bright" },
    { kind: "shake", difficulty: "gentle" },
  ] }));
  assert.throws(() => validateAlarm({ ...alarm, missions: [supplication, supplication] }));
  assert.equal(missionDescription("supplication", "gentle"), missionDescription("supplication", "bright"));
});

test("mission rounds default to one and persist independently in summaries", () => {
  assert.equal(missionRounds(), 1);
  assert.equal(missionRounds({}), 1);
  assert.equal(missionRounds({ rounds: 3 }), 3);
  const missions = [
    { kind: "memory" as const, difficulty: "gentle" as const, rounds: 3 },
    { kind: "math" as const, difficulty: "bright" as const, rounds: 2 },
  ];
  assert.doesNotThrow(() => validateAlarm({ ...alarm, missions }));
  assert.equal(missionSummary({ ...alarm, missions }), "Memory match · 3 rounds → Math puzzle · 2 rounds");
  for (const rounds of [0, -1, 1.5, 11, NaN, Infinity, null, "3"]) {
    assert.throws(() => validateAlarm({ ...alarm, missions: [{ ...missions[0], rounds }] } as Alarm));
  }
  assert.doesNotThrow(() => validateAlarm({ ...alarm, missions: [{ ...missions[0], rounds: 10 }] }));
});

test("alarm volume, gradual volume and reminder validate without breaking older alarms", () => {
  assert.doesNotThrow(() => validateAlarm(alarm));
  assert.doesNotThrow(() => validateAlarm({ ...alarm, volume: .8, volumeRampSeconds: 60, missionReminder: true }));
  for (const volume of [0, -1, 1.1, NaN, Infinity]) assert.throws(() => validateAlarm({ ...alarm, volume }));
  for (const volumeRampSeconds of [-1, 15, NaN]) assert.throws(() => validateAlarm({ ...alarm, volumeRampSeconds }));
  assert.throws(() => validateAlarm({ ...alarm, missionReminder: "false" } as unknown as Alarm));
});

test("silent missions is optional for existing alarms and validates saved preferences", () => {
  assert.doesNotThrow(() => validateAlarm(alarm));
  assert.doesNotThrow(() => validateAlarm({ ...alarm, silentMissions: true }));
  assert.doesNotThrow(() => validateAlarm({ ...alarm, silentMissions: false }));
  assert.throws(() => validateAlarm({ ...alarm, silentMissions: "false" } as unknown as Alarm));
});
