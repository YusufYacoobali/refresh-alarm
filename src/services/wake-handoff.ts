import { Platform } from "react-native";
import AlarmKit from "./alarm-kit";
import AndroidAlarm from "./android-alarm";
import { readMissionTimeout } from "./mission-timeout";
import { wakeOccurrenceKey } from "@/utils/wake-session";
import type { NativeWakeHandoff, WakeCandidate, WakeRoutingData } from "@/utils/wake-handoff";

function token(value: string) {
  let result = 2166136261;
  for (let i = 0; i < value.length; i++) result = Math.imul(result ^ value.charCodeAt(i), 16777619) >>> 0;
  return result.toString(16);
}
export function logWakeHandoff(event: string, id = "", reason = "") {
  if (Platform.OS === "ios" && AlarmKit?.logWakeHandoff) AlarmKit.logWakeHandoff(event, id, reason);
  else if (__DEV__) console.info("[AlarmTiming]", { event, key: token(id), reason, at: Date.now() });
}
export const acknowledgeWakeup = async (target: WakeCandidate, reason: "completed" | "deleted") => {
  if (target.native) await AlarmKit?.completeWakeup?.(target.sessionId, reason);
};
function alarmForRegistration(data: WakeRoutingData, id: string) {
  return data.alarms.find(a => a.registration?.ids.includes(id))?.id ??
    (data.snoozed?.registration.ids.includes(id) ? data.snoozed.alarmId : undefined);
}
// Match Calendar.current's local-day identity for native legacy occurrences,
// including DST changes; neither a UTC date nor a rolling 24-hour window fits.
const occurrenceDate = (at: number) => new Date(at).toDateString();
function validateNative(record: NativeWakeHandoff) {
  if (!record || typeof record.alarmId !== "string" || !record.alarmId || typeof record.occurrenceId !== "string" || !record.occurrenceId ||
    typeof record.sessionId !== "string" || !record.sessionId || typeof record.registrationId !== "string" || !record.registrationId ||
    !Number.isFinite(record.createdAt) || !Number.isFinite(record.scheduledAt) ||
    !["scheduled", "snooze", "timeout"].includes(record.kind) || !["stop", "alerting", "legacy"].includes(record.source) || typeof record.deferred !== "boolean")
    throw new Error("Native wake-up handoff could not be read.");
}
/** Called by the single routing coordinator on boot, resume and native events.
 * A scheduled clock time by itself is never evidence of an AlarmKit delivery. */
export async function readNativeWakeups(data: WakeRoutingData): Promise<WakeCandidate[]> {
  if (AndroidAlarm) {
    const active = AndroidAlarm.activeAlarm();
    const reminder = active?.eventId.includes(":reminder:");
    const snoozed = data.snoozed;
    const snoozeDelivery = active && snoozed?.alarmId === active.alarmId &&
      snoozed.registration.ids.some(id => active.eventId.startsWith(`${id}:`));
    return active ? [{ id: active.alarmId, eventId: active.eventId,
      sessionId: (snoozeDelivery ? snoozed?.sessionId : undefined) ?? active.sessionId ??
        (reminder ? data.wakeSessions?.[active.alarmId]?.id : undefined) ?? active.eventId,
      kind: snoozeDelivery ? "snooze" : "scheduled",
      createdAt: 0, reminder: reminder ? "1" : undefined, durable: true }] : [];
  }
  if (Platform.OS !== "ios" || !AlarmKit?.isSupported()) return [];
  if (!AlarmKit.pendingWakeups) {
    // Compatibility is non-destructive. Never call consumePendingAlarm here.
    const pending = AlarmKit.activeAlarm?.();
    const observed = await AlarmKit.getAlarms().catch(error => {
      if (!pending) throw error;
      logWakeHandoff("handoff.observe.deferred", "", "legacy_pending_retained"); return [];
    });
    const ids = [...new Set([...(pending ? [pending] : []), ...observed.filter(a => a.state === "alerting").flatMap(a => {
      const id = alarmForRegistration(data, a.id); return id ? [id] : [];
    })])];
    return ids.flatMap(id => {
      const alarm = data.alarms.find(a => a.id === id);
      if (!alarm) return [];
      const sessionId = data.wakeSessions?.[id]?.id ?? wakeOccurrenceKey(alarm, Date.now());
      return [{ id, eventId: `${sessionId}:legacy-active`, sessionId, createdAt: 0, durable: true }];
    });
  }
  let records = await AlarmKit.pendingWakeups();
  records.forEach(validateNative);
  // Old scheduled registrations lack the new native mapping. Recover them only
  // after an actual .alerting observation, with native confirmation before write.
  // A different alarm's pending handoff must never hide an older registration.
  let active: Awaited<ReturnType<typeof AlarmKit.getAlarms>> = [];
  try { active = await AlarmKit.getAlarms(); }
  catch (error) {
    if (!records.length) throw error;
    logWakeHandoff("handoff.observe.deferred", "", "active_lookup_failed_pending_retained");
  }
  const observedDate = occurrenceDate(Date.now());
  const represented = new Set(records.filter(record => occurrenceDate(record.scheduledAt) === observedDate).map(record => record.registrationId));
  let captured = false, captureFailure: unknown;
  for (const native of active.filter(a => a.state === "alerting")) {
    if (represented.has(native.id)) continue;
    const id = alarmForRegistration(data, native.id);
    if (!id || !AlarmKit.captureAlertingWakeup) continue;
    try {
      await AlarmKit.captureAlertingWakeup(native.id, id);
      represented.add(native.id); captured = true;
    } catch (error) {
      captureFailure = error;
      logWakeHandoff("handoff.capture.deferred", native.id, "native_capture_failed");
    }
  }
  if (captured) {
    try {
      const recovered = await AlarmKit.pendingWakeups();
      recovered.forEach(validateNative);
      // Preserve the original queue positions, update duplicate identities in
      // place, then append recovered occurrences in native order.
      records = [...records, ...recovered];
    } catch (error) {
      if (!records.length) throw error;
      logWakeHandoff("handoff.observe.deferred", "", "capture_read_failed_pending_retained");
    }
  }
  if (captureFailure && !records.length) throw captureFailure;
  const unique = new Map<string, NativeWakeHandoff>();
  for (const record of records) unique.set(JSON.stringify([record.registrationId, record.occurrenceId]), record);
  const timeout = await readMissionTimeout().catch(() => { logWakeHandoff("timeout.read.failed", "", "native_pending_retained"); return null; });
  const candidates: WakeCandidate[] = [];
  for (const record of unique.values()) {
    let sessionId = record.sessionId;
    const saved = data.wakeSessions?.[record.alarmId];
    // Imports lack a historical date; explicit snooze/timeout registrations can
    // continue across midnight. A fresh morning must not adopt yesterday's routine.
    const undatedImport = record.occurrenceId === `legacy:${record.alarmId}:imported`;
    const snoozed = data.snoozed;
    const continuation = (snoozed?.alarmId === record.alarmId && snoozed.registration.ids.includes(record.registrationId) &&
      (!snoozed.sessionId || snoozed.sessionId === saved?.id)) ||
      (timeout?.alarmId === record.alarmId && timeout.registration.ids.includes(record.registrationId) &&
      (!timeout.sessionId || timeout.sessionId === saved?.id));
    if (record.source === "legacy" && saved && saved.id !== sessionId &&
        (undatedImport || continuation || occurrenceDate(record.scheduledAt) === occurrenceDate(saved.startedAt))) {
      await AlarmKit.adoptWakeup?.(record.occurrenceId, saved.id);
      sessionId = saved.id;
    }
    const expiredMission = timeout?.alarmId === record.alarmId && timeout.deadline <= Date.now() &&
      (!timeout.sessionId || timeout.sessionId === sessionId);
    const reminderEvent = expiredMission && record.kind !== "timeout" && timeout.registration.kind === "alarmkit" && timeout.registration.ids[0]
      ? `${timeout.registration.ids[0]}:${timeout.deadline}` : record.occurrenceId;
    candidates.push({ id: record.alarmId, eventId: reminderEvent,
      sessionId, createdAt: record.createdAt, reminder: record.kind === "timeout" || expiredMission ? "1" : undefined,
      kind: record.kind, deferred: record.deferred, durable: true, native: true });
  }
  return candidates;
}
