import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alarm, Registration } from "@/utils/alarms";
import { alarmKitAvailable, cancelRegistration, scheduleAlarm } from "./scheduler";

export type MissionTimeout = { token: string; alarmId: string; deadline: number; registration: Registration; superseded?: Registration[] };
const KEY = "daybreak.mission-timeout.v1";
let queue: Promise<unknown> = Promise.resolve();

// Serialize setup and cleanup so late cleanup cannot cancel the next mission.
function enqueue<T>(work: () => Promise<T>): Promise<T> {
  const result = queue.then(work, work);
  queue = result.catch(() => {});
  return result;
}

export async function readMissionTimeout(): Promise<MissionTimeout | null> {
  const saved = await AsyncStorage.getItem(KEY);
  return saved ? JSON.parse(saved) as MissionTimeout : null;
}

export function startMissionTimeout(alarm: Alarm, deadline: number, token: string) {
  if (!alarmKitAvailable()) return Promise.resolve();
  return enqueue(async () => {
    const previous = await readMissionTimeout();
    const registration = await scheduleAlarm(alarm, new Date(deadline));
    const superseded = previous ? [previous.registration, ...(previous.superseded ?? [])] : [];
    const record: MissionTimeout = { token, alarmId: alarm.id, deadline, registration, superseded };
    try {
      await AsyncStorage.setItem(KEY, JSON.stringify(record));
    } catch (error) {
      await cancelRegistration(registration);
      throw error;
    }
    // Keep the previous safety alarm until its replacement is safely persisted.
    // Persist all IDs until cancellation succeeds, so failed cleanup is retryable.
    for (const old of superseded) await cancelRegistration(old);
    if (superseded.length) await AsyncStorage.setItem(KEY, JSON.stringify({ ...record, superseded: [] }));
  });
}

export function cancelMissionTimeout(token?: string) {
  return enqueue(async () => {
    const current = await readMissionTimeout();
    if (!current || (token && current.token !== token)) return;
    await cancelRegistration(current.registration);
    for (const old of current.superseded ?? []) await cancelRegistration(old);
    await AsyncStorage.removeItem(KEY);
  });
}
