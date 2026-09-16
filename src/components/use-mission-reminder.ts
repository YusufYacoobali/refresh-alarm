import { useCallback, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import AndroidAlarm from "@/services/android-alarm";
import { Alarm } from "@/utils/alarms";
import { MISSION_IDLE_MS } from "@/utils/alarm-playback";

export function useMissionReminder(alarm: Alarm | undefined, preview: boolean, eventId?: string) {
  const deadline = useRef(0), occurrence = useRef<string | undefined>(undefined);
  const [error, setError] = useState(false);
  const enabled = !!alarm && !preview && alarm.missionReminder !== false;
  const activity = useCallback(() => {
    if (!enabled || !deadline.current) return;
    if (AndroidAlarm) {
      if (occurrence.current) void AndroidAlarm.missionActivity(occurrence.current)
        .then(() => setError(false)).catch(() => setError(true));
    } else if (Date.now() < deadline.current) deadline.current = Date.now() + MISSION_IDLE_MS;
  }, [enabled]);
  useFocusEffect(useCallback(() => {
    if (!enabled) return;
    deadline.current = Date.now() + MISSION_IDLE_MS;
    occurrence.current = eventId ?? AndroidAlarm?.activeAlarm()?.eventId;
    activity();
    // Android owns its deadline in the foreground service, independent of JS.
    const timer = !AndroidAlarm ? setInterval(() => {
      if (deadline.current && Date.now() >= deadline.current) {
        deadline.current = 0;
        router.replace({ pathname: "/ringing", params: { id: alarm!.id, reminder: "1" } });
      }
    }, 250) : undefined;
    return () => { clearInterval(timer); deadline.current = 0; };
  }, [enabled, alarm?.id, eventId, activity]));
  return { activity, error };
}
