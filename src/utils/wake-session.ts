import { GAMEPLAY_KINDS, missionRounds, nextOccurrence, validateMissions, validateMystery, type Alarm, type GameplayKind, type Mission, type MysterySettings, type Registration } from "./alarms";
import { generateMysterySequence, shuffled } from "./mystery-sequence";
import { supplications } from "./supplications";

type Occurrence = { id: string; occurrenceKey: string; startedAt: number };
export type WakeSession = Occurrence & {
  missions: Mission[];
  config?: MysterySettings;
  fajrIndex?: number;
  /** Only created after the user explicitly accepts recovery. */
  fallback?: "duas-only";
  /** Read compatibility for the first v3 implementation; cleaned on hydration. */
  completed?: boolean;
};
export type WakeHistory = Occurrence & { gameplay: GameplayKind[]; completedAt?: number };
export type WakeRecovery = { reason: string; saved: unknown };
export type WakeData = {
  wakeSessions?: Record<string, WakeSession>;
  mysteryHistory?: Record<string, WakeHistory>;
  wakeSessionRecovery?: Record<string, WakeRecovery>;
};
export type WakeIdentity = { eventId?: string; sessionId?: string; reminder?: boolean };
export type SnoozedWake = { alarmId: string; at: number; registration: Registration; sessionId?: string };
export class WakeRoutineError extends Error {
  constructor(message: string, public recoverable = true) { super(message); }
}

export function validateWakeSession(_alarm: Alarm, session: WakeSession) {
  if (!session || typeof session.id !== "string" || !session.id || typeof session.occurrenceKey !== "string" ||
      !session.occurrenceKey || !Number.isFinite(session.startedAt) || !Array.isArray(session.missions) ||
      (session.completed !== undefined && typeof session.completed !== "boolean") ||
      (session.fallback !== undefined && session.fallback !== "duas-only") ||
      (session.fajrIndex !== undefined && (!Number.isInteger(session.fajrIndex) || session.fajrIndex < 0 || session.fajrIndex >= 5)))
    throw new WakeRoutineError("The saved routine could not be read. Your alarm will keep ringing.");
  // Validate the snapshot independently of today's edited alarm configuration.
  validateMissions(session.missions);
  if (session.config) validateMystery(session.config);
  const games = session.missions.filter(m => GAMEPLAY_KINDS.includes(m.kind as GameplayKind));
  const ending = session.missions.slice(games.length);
  // Legacy snapshots and explicit dua recovery still require supplication.
  // Newly generated snapshots may explicitly configure no duas.
  const requiresDuas = session.fallback === "duas-only" || !session.config || session.config.duaIds.length > 0;
  if ((session.fallback === "duas-only" ? games.length !== 0 : games.length < 2 || games.length > 4) ||
      session.missions.slice(0, games.length).some(m => !GAMEPLAY_KINDS.includes(m.kind as GameplayKind)) ||
      ending.length > 2 || (requiresDuas && !ending.some(m => m.kind === "supplication" && m.duaIds?.length)) ||
      (!requiresDuas && ending.some(m => m.kind === "supplication")) ||
      ending.some(m => m.kind !== "supplication" && m.kind !== "fajr_reminder"))
    throw new WakeRoutineError("The saved routine is incomplete. Your alarm will keep ringing.");
  if (session.config) {
    const ids = ending.find(m => m.kind === "supplication")?.duaIds ?? [];
    if (games.some(m => !session.config!.games.some(g => g.kind === m.kind && g.difficulty === m.difficulty && missionRounds(g) === missionRounds(m))) ||
        ids.length !== session.config.duaIds.length || ids.some(id => !session.config!.duaIds.includes(id)) ||
        ending.some(m => m.kind === "fajr_reminder") !== session.config.fajr)
      throw new WakeRoutineError("The saved routine does not match its original settings. Your alarm will keep ringing.");
  }
}

/** iOS activeAlarm identifies the alarm, not its daily occurrence. */
export function wakeOccurrenceKey(alarm: Alarm, now: number): string {
  if (!alarm.days.length && alarm.nextAt) return `${alarm.id}:${alarm.nextAt}`;
  for (let offset = 0; offset <= 7; offset++) {
    const date = new Date(now);
    date.setDate(date.getDate() - offset);
    date.setHours(alarm.hour, alarm.minute, 0, 0);
    if (+date <= now && (!alarm.days.length || alarm.days.includes(date.getDay()))) return `${alarm.id}:${+date}`;
  }
  throw new WakeRoutineError("Could not identify this wake-up.");
}

function wakeIdentityId(alarm: Alarm, previous: Occurrence | undefined, identity: WakeIdentity, snoozed: SnoozedWake | undefined, now: number) {
  const event = identity.eventId;
  const snoozeEvent = snoozed?.alarmId === alarm.id && now >= snoozed.at &&
    (event === `snooze-${snoozed.at}` || snoozed.registration.ids.some(id => event?.startsWith(`${id}:`) || event === id) ||
      ((!event || event === `${alarm.id}:active`) && previous?.occurrenceKey === wakeOccurrenceKey(alarm, now)));
  return snoozeEvent && snoozed.sessionId ? snoozed.sessionId : identity.sessionId;
}
export function sameWakeSession(alarm: Alarm, previous: Occurrence, identity: WakeIdentity, snoozed?: SnoozedWake, now = Date.now()) {
  const id = wakeIdentityId(alarm, previous, identity, snoozed, now);
  return id ? id === previous.id : !!(identity.reminder || identity.eventId?.includes(":reminder:") ||
    previous.occurrenceKey === wakeOccurrenceKey(alarm, now) || +nextOccurrence(alarm, new Date(previous.startedAt)) > now);
}
export function wakeHistory(session: WakeSession, completedAt?: number): WakeHistory {
  return { id: session.id, occurrenceKey: session.occurrenceKey, startedAt: session.startedAt,
    gameplay: session.missions.filter(m => GAMEPLAY_KINDS.includes(m.kind as GameplayKind)).map(m => m.kind as GameplayKind),
    ...(completedAt !== undefined ? { completedAt } : {}) };
}
export function completeWakeSession(data: WakeData, alarmId: string, now = Date.now()): WakeData {
  const session = data.wakeSessions?.[alarmId];
  const sessions = { ...data.wakeSessions };
  const recovery = { ...data.wakeSessionRecovery };
  delete sessions[alarmId];
  delete recovery[alarmId];
  return { wakeSessions: sessions, mysteryHistory: { ...data.mysteryHistory,
    ...(session ? { [alarmId]: wakeHistory(session, now) } : {}) }, wakeSessionRecovery: recovery };
}

/** Drop orphan records and old completed snapshots. Quarantine broken active
 * records for explicit recovery; never block alarm hydration or quietly reroll. */
export function cleanWakeData(alarms: Alarm[], data: WakeData): Required<WakeData> {
  const result: Required<WakeData> = { wakeSessions: {}, mysteryHistory: {}, wakeSessionRecovery: {} };
  for (const alarm of alarms) {
    const history = data.mysteryHistory?.[alarm.id];
    if (history && typeof history.id === "string" && !!history.id && typeof history.occurrenceKey === "string" && !!history.occurrenceKey && Number.isFinite(history.startedAt) &&
        Array.isArray(history.gameplay) && history.gameplay.length <= 4 && new Set(history.gameplay).size === history.gameplay.length &&
        history.gameplay.every(kind => GAMEPLAY_KINDS.includes(kind)) &&
        (history.completedAt === undefined || Number.isFinite(history.completedAt))) result.mysteryHistory[alarm.id] = history;
    const recovery = data.wakeSessionRecovery?.[alarm.id];
    if (recovery && typeof recovery.reason === "string") result.wakeSessionRecovery[alarm.id] = recovery;
    const raw = data.wakeSessions;
    const session = raw?.[alarm.id];
    if (raw === undefined || (raw && typeof raw === "object" && !Array.isArray(raw) && !Object.hasOwn(raw, alarm.id))) continue;
    if ((!raw || typeof raw !== "object" || Array.isArray(raw)) && alarm.missionMode !== "mystery") continue;
    try {
      validateWakeSession(alarm, session!);
      delete result.wakeSessionRecovery[alarm.id];
      if (session!.completed) result.mysteryHistory[alarm.id] = wakeHistory(session!, session!.startedAt);
      else result.wakeSessions[alarm.id] = session!;
    } catch {
      result.wakeSessionRecovery[alarm.id] = {
        reason: "The saved routine is damaged. Keep the alarm ringing while repairing it, or choose morning duas for this wake-up.",
        saved: session ?? raw,
      };
    }
  }
  return result;
}

export function resolveMysterySession(alarm: Alarm, previous: WakeSession | undefined, identity: WakeIdentity = {}, snoozed?: SnoozedWake, now = Date.now(), random = Math.random, history?: WakeHistory): WakeSession {
  if (previous && sameWakeSession(alarm, previous, identity, snoozed, now)) {
    if (previous.completed) throw new WakeRoutineError("This wake-up has already been completed.", false);
    return previous;
  }
  if (history?.completedAt !== undefined && sameWakeSession(alarm, history, identity, snoozed, now))
    throw new WakeRoutineError("This wake-up has already been completed.", false);
  try { validateMystery(alarm.mystery!); }
  catch { throw new WakeRoutineError("Your Mystery settings need repair. The alarm will keep ringing until you choose how to continue."); }
  const config = { ...alarm.mystery!, games: alarm.mystery!.games.map(m => ({ ...m })), duaIds: [...alarm.mystery!.duaIds] };
  return {
    id: wakeIdentityId(alarm, previous ?? history, identity, snoozed, now) ?? wakeOccurrenceKey(alarm, now),
    occurrenceKey: wakeOccurrenceKey(alarm, now), startedAt: now, config,
    missions: generateMysterySequence(config, previous ? wakeHistory(previous).gameplay : history?.gameplay, random),
  };
}

/** Explicit recovery never adds an excluded game. Persisted like any other
 * session, so its dua/Fajr order also stays fixed through a timeout or snooze. */
export function createDuaRecoverySession(alarm: Alarm, identity: WakeIdentity, snoozed?: SnoozedWake, now = Date.now(), random = Math.random): WakeSession {
  const ids = Array.isArray(alarm.mystery?.duaIds) ? supplications.filter(d => alarm.mystery!.duaIds.includes(d.id)).map(d => d.id) : [];
  const missions: Mission[] = [{ kind: "supplication", difficulty: "gentle", duaIds: shuffled(ids.length ? ids : supplications.map(d => d.id), random) }];
  if (alarm.mystery?.fajr === true) missions.splice(random() < .5 ? 0 : 1, 0, { kind: "fajr_reminder", difficulty: "gentle" });
  return { id: wakeIdentityId(alarm, undefined, identity, snoozed, now) ?? wakeOccurrenceKey(alarm, now),
    occurrenceKey: wakeOccurrenceKey(alarm, now), startedAt: now, fallback: "duas-only", missions };
}
