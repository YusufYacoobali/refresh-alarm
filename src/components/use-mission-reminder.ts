import { useCallback, useRef, useState } from "react";
import { AppState } from "react-native";
import { router, useFocusEffect } from "expo-router";
import AndroidAlarm from "@/services/android-alarm";
import { cancelMissionTimeout, startMissionTimeout } from "@/services/mission-timeout";
import { Alarm, Challenge } from "@/utils/alarms";
import { MISSION_LIMIT_MS, missionSecondsLeft } from "@/utils/alarm-playback";

export function useMissionReminder(alarm: Alarm | undefined, preview: boolean, eventId: string | undefined, missionStep: number | string, completed: boolean,
  previewOptions?: { kind?: Challenge; difficulty?: Alarm["difficulty"]; rounds?: string; duaIds?: string }, requestedLimitMs = MISSION_LIMIT_MS) {
  // Older installed Android binaries only support a one-minute native deadline.
  const limitMs = !preview && AndroidAlarm && !AndroidAlarm.missionActivityWithLimit ? MISSION_LIMIT_MS : requestedLimitMs;
  const { kind, difficulty, rounds, duaIds } = previewOptions ?? {};
  const latest = useRef(alarm); latest.current = alarm;
  const [error, setError] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const expired = useRef(false);
  const deadlineRef = useRef(0);
  const enabled = !!alarm && !completed;
  useFocusEffect(useCallback(() => {
    if (!enabled) return;
    const deadline = Date.now() + limitMs;
    deadlineRef.current = deadline;
    const token = `${alarm!.id}:${missionStep}:${deadline}`;
    expired.current = false;
    setError(false);
    setSecondsLeft(limitMs / 1000);
    let disposed = false;
    if (!preview) {
      const occurrence = eventId ?? AndroidAlarm?.activeAlarm()?.eventId;
      const setup = AndroidAlarm && occurrence
        ? AndroidAlarm.missionActivityWithLimit ? AndroidAlarm.missionActivityWithLimit(occurrence, limitMs) : AndroidAlarm.missionActivity(occurrence)
        : startMissionTimeout(latest.current!, deadline, token);
      void setup.catch(() => { if (!disposed) setError(true); });
    }
    const check = () => {
      if (disposed || expired.current) return;
      const remaining = missionSecondsLeft(deadline, Date.now(), limitMs);
      setSecondsLeft(remaining);
      if (remaining === 0) {
        expired.current = true;
        // Replacing the route discards every mission's progress.
        router.replace({ pathname: "/ringing", params: {
          id: alarm!.id, preview: preview ? "1" : "0", reminder: "1", eventId,
          ...(preview ? { kind, difficulty, rounds, duaIds } : {}),
        } });
      }
    };
    const timer = setInterval(check, 250);
    const resume = AppState.addEventListener("change", state => { if (state === "active") check(); });
    return () => {
      disposed = true;
      clearInterval(timer);
      resume.remove();
      if (!preview) void cancelMissionTimeout(token).catch(() => {});
    };
  }, [enabled, alarm?.id, preview, eventId, missionStep, kind, difficulty, rounds, duaIds, limitMs]));
  const isExpired = useCallback(() => expired.current || (deadlineRef.current > 0 && Date.now() >= deadlineRef.current), []);
  return { secondsLeft, isExpired, error };
}
