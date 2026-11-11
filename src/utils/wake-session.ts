import { GAMEPLAY_KINDS, validateAlarm, type Alarm, type GameplayKind, type Mission, type Registration } from "./alarms";
import { generateMysterySequence } from "./mystery-sequence";

export type WakeSession = {
  id: string;
  occurrenceKey: string;
  startedAt: number;
  missions: Mission[];
  completed?: boolean;
};
export type WakeIdentity = { eventId?: string; sessionId?: string; reminder?: boolean };
export type SnoozedWake = { alarmId: string; at: number; registration: Registration; sessionId?: string };

export function validateWakeSession(alarm: Alarm, session: WakeSession) {
  if (!session || typeof session.id !== "string" || !session.id || typeof session.occurrenceKey !== "string" ||
      !session.occurrenceKey || !Number.isFinite(session.startedAt) || !Array.isArray(session.missions) ||
      (session.completed !== undefined && typeof session.completed !== "boolean"))
    throw new Error("Saved wake-up session could not be read.");
  validateAlarm({ ...alarm, missions: session.missions });
  const games = session.missions.filter(m => GAMEPLAY_KINDS.includes(m.kind as GameplayKind));
  const ending = session.missions.slice(games.length);
  if (games.length < 2 || games.length > 4 || session.missions.slice(0, games.length).some(m => !GAMEPLAY_KINDS.includes(m.kind as GameplayKind)) ||
      ![1, 2].includes(ending.length) || !ending.some(m => m.kind === "supplication" && m.duaIds?.length) ||
      ending.some(m => m.kind !== "supplication" && m.kind !== "fajr_reminder"))
    throw new Error("Saved Mystery routine could not be read.");
}

/** iOS activeAlarm identifies the alarm, not its daily occurrence. Derive the
 * latest scheduled wake-up in local time, including weekly and overnight use. */
export function wakeOccurrenceKey(alarm: Alarm, now: number): string {
  if (!alarm.days.length && alarm.nextAt) return `${alarm.id}:${alarm.nextAt}`;
  for (let offset = 0; offset <= 7; offset++) {
    const date = new Date(now);
    date.setDate(date.getDate() - offset);
    date.setHours(alarm.hour, alarm.minute, 0, 0);
    if (+date <= now && (!alarm.days.length || alarm.days.includes(date.getDay()))) return `${alarm.id}:${+date}`;
  }
  throw new Error("Could not identify this wake-up.");
}

export function resolveMysterySession(alarm: Alarm, previous: WakeSession | undefined, identity: WakeIdentity = {}, snoozed?: SnoozedWake, now = Date.now(), random = Math.random): WakeSession {
  if (!alarm.mystery) throw new Error("Choose your Mystery games first.");
  const occurrenceKey = wakeOccurrenceKey(alarm, now);
  const event = identity.eventId;
  const snoozeEvent = snoozed?.alarmId === alarm.id && now >= snoozed.at &&
    (event === `snooze-${snoozed.at}` || snoozed.registration.ids.some(id => event?.startsWith(`${id}:`) || event === id) ||
      ((!event || event === `${alarm.id}:active`) && previous?.occurrenceKey === occurrenceKey));
  const id = snoozeEvent && snoozed.sessionId ? snoozed.sessionId : identity.sessionId;
  if (previous && (id === previous.id || (!id && (
    identity.reminder || event?.includes(":reminder:") || snoozeEvent || previous.occurrenceKey === occurrenceKey
  )))) return previous;
  return {
    id: id ?? occurrenceKey,
    occurrenceKey,
    startedAt: now,
    missions: generateMysterySequence(alarm.mystery, previous?.missions.filter(m => GAMEPLAY_KINDS.includes(m.kind as GameplayKind)).map(m => m.kind as GameplayKind), random),
  };
}
