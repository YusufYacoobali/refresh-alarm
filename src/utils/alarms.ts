import { sounds, soundName, validSound } from "./sounds";
import type { SoundId } from "./sounds";
export { sounds, soundName };
export type { SoundId };
export type Challenge = "none" | "math" | "memory" | "shake";
export type Mission = { kind: Exclude<Challenge, "none">; difficulty: "gentle" | "bright" };
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
  snooze: number;
  registration?: Registration;
  nextAt?: number;
};
export const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const challengeNames: Record<Challenge, string> = {
  none: "Simple dismiss",
  math: "Math puzzle",
  memory: "Memory match",
  shake: "Shake to wake",
};
export function alarmMissions(alarm: Pick<Alarm, "missions" | "challenge" | "difficulty">): Mission[] {
  return alarm.missions ?? (alarm.challenge === "none" ? [] : [{ kind: alarm.challenge, difficulty: alarm.difficulty }]);
}
export function missionSummary(alarm: Pick<Alarm, "missions" | "challenge" | "difficulty">) {
  const missions = alarmMissions(alarm);
  return missions.length ? missions.map(m => challengeNames[m.kind]).join(" → ") : "No missions";
}
export function missionDescription(kind: Mission["kind"], difficulty: Mission["difficulty"]) {
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
  if (!["none", "math", "memory", "shake"].includes(a.challenge))
    throw new Error("Choose a wake-up challenge.");
  if (
    !["gentle", "bright"].includes(a.difficulty) ||
    ![0, 5, 10, 15].includes(a.snooze)
  )
    throw new Error("Choose valid challenge and snooze settings.");
  if (a.missions !== undefined && (!Array.isArray(a.missions) || a.missions.length > 3 ||
    a.missions.some(m => !m || !["math", "memory", "shake"].includes(m.kind) || !["gentle", "bright"].includes(m.difficulty)) ||
    new Set(a.missions.map(m => m.kind)).size !== a.missions.length))
    throw new Error("Choose each mission once and set its difficulty.");
  if (!validSound(a.sound))
    throw new Error("Choose a valid sound preference.");
  if (a.silentMissions !== undefined && typeof a.silentMissions !== "boolean")
    throw new Error("Choose a valid mission sound preference.");
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

