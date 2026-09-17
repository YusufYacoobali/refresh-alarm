import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { useApp } from "@/state/app-state";
import AndroidAlarm from "@/services/android-alarm";
import AlarmKit from "@/services/alarm-kit";
import { readMissionTimeout, cancelMissionTimeout } from "@/services/mission-timeout";

export default function Index() {
  const { data } = useApp();
  const [target, setTarget] = useState<{ id: string; eventId: string; reminder?: string } | null | undefined>(undefined);
  useEffect(() => {
    let disposed = false;
    const boot = async () => {
      const android = AndroidAlarm?.activeAlarm();
      if (android && data.alarms.some(a => a.id === android.alarmId))
        return { id: android.alarmId, eventId: android.eventId };
      if (!AlarmKit?.isSupported()) return null;
      const reminder = await readMissionTimeout().catch(() => null);
      if (reminder && reminder.deadline <= Date.now()) {
        await cancelMissionTimeout(reminder.token).catch(() => {});
        if (data.alarms.some(a => a.id === reminder.alarmId)) {
          AlarmKit.beginAlarm?.(reminder.alarmId);
          return { id: reminder.alarmId, eventId: `${reminder.alarmId}:reminder:${reminder.deadline}`, reminder: "1" };
        }
      }
      const pending = AlarmKit.activeAlarm ? AlarmKit.activeAlarm() : AlarmKit.consumePendingAlarm();
      if (pending && data.alarms.some(a => a.id === pending)) return { id: pending, eventId: `${pending}:active` };
      for (const native of (await AlarmKit.getAlarms()).filter(a => a.state === "alerting")) {
        const id = data.alarms.find(a => a.registration?.ids.includes(native.id))?.id ??
          (data.snoozed?.registration.ids.includes(native.id) ? data.snoozed.alarmId : undefined);
        if (id) {
          AlarmKit.beginAlarm?.(id);
          return { id, eventId: `${id}:active` };
        }
      }
      return null;
    };
    void boot().then(value => { if (!disposed) setTarget(value); }).catch(() => { if (!disposed) setTarget(null); });
    return () => { disposed = true; };
  }, []);
  // Resolve a native handoff before exposing any tab on a cold launch.
  if (target === undefined) return null;
  if (target) return <Redirect href={{ pathname: "/ringing", params: target }} />;
  return <Redirect href={data.onboarded ? "/(tabs)/alarms" : "/onboarding"} />;
}
