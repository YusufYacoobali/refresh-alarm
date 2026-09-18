import { sounds, soundName, validSound } from "./sounds";
import type { SoundId } from "./sounds";
export { sounds, soundName };
export type { SoundId };
export type Challenge = "none" | "math" | "memory" | "shake" | "supplication";
export type Mission = {
  kind: Exclude<Challenge, "none">;
  difficulty: "gentle" | "bright";
  /** Older saved missions play one round. */
  rounds?: number;
};
export const MAX_MISSION_ROUNDS = 10;
export function missionRounds(mission?: Pick<Mission, "rounds">) {
  const rounds = mission?.rounds ?? 1;
  return Number.isInteger(rounds) && rounds >= 1 && rounds <= MAX_MISSION_ROUNDS ? rounds : 1;
}
export type Registration = {
  kind: "alarmkit" | "android" | "notifications" | "preview";
  ids: string[];
};
export type Alarm = {
  id: string;
  hour: number;
  minute: number;
  days: number[];
  label: string;
  enabled: boolean;
  sound: SoundId;
  wallpaper?: string;
  challenge: Challenge;
  difficulty: "gentle" | "bright";
  /** Ordered missions. Undefined reads the legacy single-mission settings. */
  missions?: Mission[];
  /** Older alarms keep ringing during missions unless explicitly silenced. */
  silentMissions?: boolean;
  /** Undefined preserves the device volume for alarms saved before volume controls. */
  volume?: number;
  volumeRampSeconds?: number;
  missionReminder?: boolean;
  snooze: number;
  registration?: Registration;
  nextAt?: number;
};
export function copyAlarm(alarm: Alarm, id: string, existingLabels: string[]): Alarm {
  const { registration: _registration, nextAt: _nextAt, ...settings } = alarm;
  const labels = new Set(existingLabels);
  let number = 1;
  let label: string;
  do {
    const suffix = number === 1 ? " (copy)" : ` (copy ${number})`;
    label = `${alarm.label.slice(0, 48 - suffix.length).trimEnd()}${suffix}`;
    number += 1;
  } while (labels.has(label));
  return { ...settings, id, label, days: [...alarm.days], missions: alarm.missions?.map(m => ({ ...m })) };
}
export const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const challengeNames: Record<Challenge, string> = {
  none: "Simple dismiss",
  math: "Math puzzle",
  memory: "Memory match",
  shake: "Shake to wake",
  supplication: "Islamic supplication",
};
export function alarmMissions(alarm: Pick<Alarm, "missions" | "challenge" | "difficulty">): Mission[] {
  return alarm.missions ?? (alarm.challenge === "none" ? [] : [{ kind: alarm.challenge, difficulty: alarm.difficulty }]);
}
export function missionSummary(alarm: Pick<Alarm, "missions" | "challenge" | "difficulty">) {
  const missions = alarmMissions(alarm);
  return missions.length ? missions.map(missionLabel).join(" → ") : "No missions";
}
export function missionLabel(mission: Mission) {
  const rounds = missionRounds(mission);
  return `${challengeNames[mission.kind]}${rounds > 1 ? ` · ${rounds} rounds` : ""}`;
}
export function missionDescription(kind: Mission["kind"], difficulty: Mission["difficulty"]) {
  if (kind === "supplication") return "3 duas · Recite once, then 3 times each";
  const hard = difficulty === "bright";
  if (kind === "math") return hard ? "3 multiplication questions" : "3 addition questions";
  if (kind === "memory") return hard ? "4 pairs · 0.8-second preview" : "4 pairs · 2-second preview";
  return hard ? "20 separate shakes" : "12 separate shakes";
}
export function displayTime(a: Pick<Alarm, "hour" | "minute">) {
  return `${a.hour % 12 || 12}:${String(a.minute).padStart(2, "0")}`;
}
export function repeatLabel(days: number[]) {
  if (!days.length) return "Once";
  if (days.length === 7) return "Every day";
  if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d)))
    return "Weekdays";
  if (days.length === 2 && days.includes(0) && days.includes(6))
    return "Weekends";
  return [...days]
    .sort((a, b) => a - b)
    .map((d) => dayNames[d])
    .join(", ");
}
export function nextOccurrence(
  alarm: Pick<Alarm, "hour" | "minute" | "days">,
  now = new Date(),
): Date {
  for (let offset = 0; offset <= 7; offset++) {
    const candidate = new Date(now);
    candidate.setDate(candidate.getDate() + offset);
    candidate.setHours(alarm.hour, alarm.minute, 0, 0);
    if (
      candidate > now &&
      (!alarm.days.length || alarm.days.includes(candidate.getDay()))
    )
      return candidate;
  }
  throw new Error("Invalid repeat schedule");
}
export function timeUntil(date: Date, now = new Date()) {
  const total = Math.max(1, Math.ceil((+date - +now) / 60000));
  return `${Math.floor(total / 60) ? `${Math.floor(total / 60)}h ` : ""}${total % 60}m`;
}
export function nextAlarmAt(
  alarms: Alarm[],
  snoozed?: { alarmId: string; at: number },
  now = new Date(),
): Date | null {
  const times = alarms.filter(a => a.enabled).map(a =>
    // A saved one-off must not appear to repeat tomorrow after it has rung.
    !a.days.length && a.nextAt !== undefined ? a.nextAt : +nextOccurrence(a, now),
  );
  if (snoozed && alarms.some(a => a.id === snoozed.alarmId)) times.push(snoozed.at);
  const next = Math.min(...times.filter(at => at > +now));
  return Number.isFinite(next) ? new Date(next) : null;
}
export function validateAlarm(a: Alarm) {
  if (
    !Number.isInteger(a.hour) ||
    a.hour < 0 ||
    a.hour > 23 ||
    !Number.isInteger(a.minute) ||
    a.minute < 0 ||
    a.minute > 59
  )
    throw new Error("Choose a valid time.");
  if (
    a.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6) ||
    new Set(a.days).size !== a.days.length
  )
    throw new Error("Choose valid repeat days.");
  if (!a.label.trim() || a.label.length > 48)
    throw new Error("Give your alarm a name (up to 48 characters).");
  if (!["none", "math", "memory", "shake", "supplication"].includes(a.challenge))
    throw new Error("Choose a wake-up challenge.");
  if (
    !["gentle", "bright"].includes(a.difficulty) ||
    ![0, 5, 10, 15].includes(a.snooze)
  )
    throw new Error("Choose valid challenge and snooze settings.");
  if (a.missions !== undefined && (!Array.isArray(a.missions) || a.missions.length > 4 ||
    a.missions.some(m => !m || !["math", "memory", "shake", "supplication"].includes(m.kind) || !["gentle", "bright"].includes(m.difficulty) ||
      (m.rounds !== undefined && (!Number.isInteger(m.rounds) || m.rounds < 1 || m.rounds > MAX_MISSION_ROUNDS))) ||
    new Set(a.missions.map(m => m.kind)).size !== a.missions.length))
    throw new Error(`Choose each mission once, with a valid difficulty and 1–${MAX_MISSION_ROUNDS} rounds.`);
  if (!validSound(a.sound))
    throw new Error("Choose a valid sound preference.");
  if (a.silentMissions !== undefined && typeof a.silentMissions !== "boolean")
    throw new Error("Choose a valid mission sound preference.");
  if (a.volume !== undefined && (!Number.isFinite(a.volume) || a.volume < 0.1 || a.volume > 1))
    throw new Error("Choose an alarm volume between 10% and 100%.");
  if (a.volumeRampSeconds !== undefined && ![0, 30, 60, 120].includes(a.volumeRampSeconds))
    throw new Error("Choose a valid gradual volume duration.");
  if (a.missionReminder !== undefined && typeof a.missionReminder !== "boolean")
    throw new Error("Choose a valid mission reminder preference.");
}
export function mathQuestion(level: Alarm["difficulty"], random = Math.random) {
  const a = Math.floor(random() * (level === "bright" ? 15 : 8)) + 2;
  const b = Math.floor(random() * 8) + 2;
  const multiply = level === "bright";
  return {
    text: `${a} ${multiply ? "×" : "+"} ${b}`,
    answer: multiply ? a * b : a + b,
  };
}
export function memoryDeck(random = Math.random) {
  const cards = [0, 1, 2, 3, 0, 1, 2, 3];
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

