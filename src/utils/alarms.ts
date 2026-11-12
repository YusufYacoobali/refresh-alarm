import { sounds, soundName, validSound } from "./sounds";
import { APP_BLOCK_MINUTES } from "./app-blocking";
import { selectedSupplications, supplications, type SupplicationId } from "./supplications";
import type { SoundId } from "./sounds";
export { sounds, soundName };
export type { SoundId };
// Keep saved names and their editor available, but hide naming throughout the UI.
export const ALARM_NAMING_ENABLED = false;
export function alarmDisplayLabel(alarm: Pick<Alarm, "label" | "hour" | "minute">) {
  return ALARM_NAMING_ENABLED ? alarm.label : `alarm at ${displayTime(alarm)} ${alarm.hour < 12 ? "AM" : "PM"}`;
}
export type Challenge = "none" | "math" | "memory" | "shake" | "supplication" | "number_order" | "color_focus" | "sequence" | "fajr_reminder";
export type Mission = {
  kind: Exclude<Challenge, "none">;
  difficulty: "gentle" | "bright";
  /** Challenge rounds; ignored for Fajr reminder and supplication. */
  rounds?: number;
  duaIds?: SupplicationId[];
};
export const GAMEPLAY_KINDS = ["math", "memory", "shake", "number_order", "color_focus", "sequence"] as const;
export type GameplayKind = (typeof GAMEPLAY_KINDS)[number];
export type MysterySettings = {
  games: (Mission & { kind: GameplayKind })[];
  duaIds: SupplicationId[];
  fajr: boolean;
};
export function defaultMysterySettings(): MysterySettings {
  return { games: GAMEPLAY_KINDS.map(kind => ({ kind, difficulty: "gentle" })), duaIds: supplications.map(d => d.id), fajr: false };
}
/** Salvage readable choices for the editor without silently enabling games
 * from a corrupt pool. Saving still requires the active-mode validation. */
export function editableMysterySettings(settings: MysterySettings): MysterySettings {
  const games = Array.isArray(settings?.games) ? settings.games.filter((m, index, all) => m &&
    GAMEPLAY_KINDS.includes(m.kind) && all.findIndex(other => other?.kind === m.kind) === index).map(m => ({
      kind: m.kind, difficulty: m.difficulty === "bright" ? "bright" as const : "gentle" as const,
      ...(m.rounds !== undefined ? { rounds: missionRounds(m) } : {}),
    })) : [];
  return { games, duaIds: Array.isArray(settings?.duaIds) ? supplications.filter(d => settings.duaIds.includes(d.id)).map(d => d.id) : [], fajr: settings?.fajr === true };
}
export function validateMystery(settings: MysterySettings) {
  if (!settings || !Array.isArray(settings.games) || settings.games.length < 2 || settings.games.length > 6 ||
      new Set(settings.games.map(m => m?.kind)).size !== settings.games.length ||
      settings.games.some(m => !m || !GAMEPLAY_KINDS.includes(m.kind) || !["gentle", "bright"].includes(m.difficulty) || m.duaIds !== undefined ||
        (m.rounds !== undefined && (!Number.isInteger(m.rounds) || m.rounds < 1 || m.rounds > MAX_MISSION_ROUNDS))))
    throw new Error("Choose at least two different Mystery games with valid difficulty and rounds.");
  if (!Array.isArray(settings.duaIds) || new Set(settings.duaIds).size !== settings.duaIds.length ||
      settings.duaIds.some(id => !supplications.some(d => d.id === id)))
    throw new Error("Choose valid morning duas for Random Pick.");
  if (typeof settings.fajr !== "boolean") throw new Error("Choose a valid Fajr reminder preference.");
}
export const MAX_MISSION_ROUNDS = 10;
export const missionSupportsRounds = (kind?: Mission["kind"]) => kind !== "fajr_reminder" && kind !== "supplication";
export function missionRounds(mission?: Pick<Mission, "rounds"> & Partial<Pick<Mission, "kind">>) {
  if (!missionSupportsRounds(mission?.kind)) return 1;
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
  /** Absent on legacy alarms: always Manual. Manual settings remain in missions. */
  missionMode?: "manual" | "mystery";
  mystery?: MysterySettings;
  /** Older alarms keep ringing during missions unless explicitly silenced. */
  silentMissions?: boolean;
  /** Undefined preserves the device volume for alarms saved before volume controls. */
  volume?: number;
  volumeRampSeconds?: number;
  missionReminder?: boolean;
  /** Native app selection is opaque on iOS; Android stores package names. */
  appBlock?: { enabled: boolean; selection: string; count: number; minutes?: number; group?: "social" | "custom" };
  snooze: number;
  registration?: Registration;
  nextAt?: number;
};
/** Mission/background edits live in JS. These fields affect future native
 * deliveries and cannot be replaced while their alarm is actively ringing. */
export function sameAlarmDeliverySettings(a: Alarm, b: Alarm) {
  const fields: (keyof Alarm)[] = ["hour", "minute", "days", "enabled", "label", "sound", "volume", "volumeRampSeconds", "appBlock"];
  return fields.every(key => JSON.stringify(a[key]) === JSON.stringify(b[key]));
}
/** Manual order takes precedence; new alarms follow it in clock-time order. */
export function orderAlarms(alarms: Alarm[], order?: string[]): Alarm[] {
  const ranks = new Map((order ?? []).map((id, index) => [id, index]));
  return [...alarms].sort((a, b) => {
    const rankA = ranks.get(a.id), rankB = ranks.get(b.id);
    if (rankA !== undefined || rankB !== undefined)
      return (rankA ?? Infinity) - (rankB ?? Infinity);
    return a.hour * 60 + a.minute - (b.hour * 60 + b.minute);
  });
}
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
  // Stored mission settings are JSON data. Clone both modes independently,
  // including inactive damaged data that the editor may need to repair.
  return { ...settings, id, label, days: [...alarm.days], ...(alarm.appBlock ? { appBlock: { ...alarm.appBlock } } : {}),
    ...(alarm.mystery !== undefined ? { mystery: JSON.parse(JSON.stringify(alarm.mystery)) } : {}),
    missions: alarm.missions === undefined ? undefined : JSON.parse(JSON.stringify(alarm.missions)) };
}
export const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const challengeNames: Record<Challenge, string> = {
  none: "Simple dismiss",
  math: "Math puzzle",
  memory: "Memory match",
  shake: "Shake to wake",
  supplication: "Islamic supplication",
  number_order: "Number trail",
  color_focus: "Tile recall",
  sequence: "Pattern echo",
  fajr_reminder: "Fajr reminder",
};
export function alarmMissions(alarm: Pick<Alarm, "missions" | "challenge" | "difficulty">): Mission[] {
  const missions = alarm.missions ?? (alarm.challenge === "none" ? [] : [{ kind: alarm.challenge, difficulty: alarm.difficulty }]);
  return missions.map(mission => {
    if (missionSupportsRounds(mission.kind)) return mission;
    const { rounds: _rounds, ...selection } = mission;
    return selection;
  });
}
export function missionSummary(alarm: Pick<Alarm, "missions" | "challenge" | "difficulty" | "missionMode" | "mystery">) {
  if (alarm.missionMode === "mystery") {
    const count = Array.isArray(alarm.mystery?.games) ? alarm.mystery.games.length : 0;
    return count < 2 ? "Mystery · Repair game selection" : `Mystery · ${count === 2 ? "2" : `2–${Math.min(4, count)}`} random games${alarm.mystery?.duaIds?.length ? " · Morning duas" : ""}${alarm.mystery?.fajr ? " · Fajr" : ""}`;
  }
  const missions = alarmMissions(alarm);
  return missions.length ? missions.map(missionLabel).join(" → ") : "No missions";
}
export function missionLabel(mission: Mission) {
  const rounds = missionRounds(mission);
  const duas = mission.kind === "supplication" ? ` · ${selectedSupplications(mission.duaIds).map(d => d.title).join(", ")}` : "";
  return `${challengeNames[mission.kind]}${duas}${rounds > 1 ? ` · ${rounds} rounds` : ""}`;
}
export function missionDescription(kind: Mission["kind"], difficulty: Mission["difficulty"], duaIds?: SupplicationId[]) {
  if (kind === "supplication") return selectedSupplications(duaIds).map(d => `${d.title} · ${d.repetitions}×`).join(" / ");
  if (kind === "fajr_reminder") return "One full hadith · Rotates through five reminders";
  const hard = difficulty === "bright";
  if (kind === "number_order") return hard ? "12 numbers · Tap from largest to smallest" : "8 numbers · Tap from smallest to largest";
  if (kind === "color_focus") return `${hard ? "6×6" : "4×4"} grid · Remember ${hard ? 8 : 3} tiles · 2-second preview`;
  if (kind === "sequence") return hard ? "Remember a 6-tile sequence" : "Remember a 4-tile sequence";
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
export function validateMissions(missions: Mission[] | undefined) {
  if (missions !== undefined && (!Array.isArray(missions) || missions.length > 8 ||
    missions.some(m => !m || (m.kind as string) === "none" || !Object.hasOwn(challengeNames, m.kind) || !["gentle", "bright"].includes(m.difficulty) ||
      (m.duaIds !== undefined && (m.kind !== "supplication" || !Array.isArray(m.duaIds) || !m.duaIds.length || new Set(m.duaIds).size !== m.duaIds.length || m.duaIds.some(id => !supplications.some(d => d.id === id)))) ||
      (m.rounds !== undefined && (!Number.isInteger(m.rounds) || m.rounds < 1 || m.rounds > MAX_MISSION_ROUNDS))) ||
    new Set(missions.map(m => m.kind)).size !== missions.length))
    throw new Error(`Choose each mission once, with a valid difficulty and 1–${MAX_MISSION_ROUNDS} rounds.`);
}
/** Hydration checks core alarm data separately so a broken Mystery selection
 * cannot hide saved alarms or block the native ringing handoff. */
export function validateAlarm(a: Alarm, options: { missionConfig?: boolean } = {}) {
  const checkMissions = options.missionConfig !== false;
  if (checkMissions && a.missionMode !== undefined && !["manual", "mystery"].includes(a.missionMode))
    throw new Error("Choose Manual or Mystery Mode.");
  if (checkMissions && a.missionMode === "mystery") validateMystery(a.mystery!);
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
  if (checkMissions && a.missionMode !== "mystery" && !Object.hasOwn(challengeNames, a.challenge))
    throw new Error("Choose a wake-up challenge.");
  if (
    (checkMissions && a.missionMode !== "mystery" && !["gentle", "bright"].includes(a.difficulty)) ||
    ![0, 5, 10, 15].includes(a.snooze)
  )
    throw new Error("Choose valid challenge and snooze settings.");
  if (checkMissions && a.missionMode !== "mystery") validateMissions(a.missions);
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
  if (a.appBlock !== undefined && (!a.appBlock || typeof a.appBlock.enabled !== "boolean" ||
    typeof a.appBlock.selection !== "string" || !Number.isInteger(a.appBlock.count) || a.appBlock.count < 0 ||
    (a.appBlock.enabled && (!a.appBlock.selection || a.appBlock.count === 0))))
    throw new Error("Choose the apps to block before enabling app blocking.");
  if (a.appBlock?.minutes !== undefined && !APP_BLOCK_MINUTES.some(minutes => minutes === a.appBlock!.minutes))
    throw new Error("Choose a valid app-block duration.");
  if (a.appBlock?.group !== undefined && !["social", "custom"].includes(a.appBlock.group))
    throw new Error("Choose a valid app group.");
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

