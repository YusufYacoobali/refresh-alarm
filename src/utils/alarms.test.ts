import test from "node:test";
import assert from "node:assert/strict";
import {
  nextOccurrence,
  repeatLabel,
  displayTime,
  validateAlarm,
  mathQuestion,
  memoryDeck,
  Alarm,
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
