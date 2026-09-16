import React, { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { AppState } from "react-native";
import { Alarm } from "@/utils/alarms";
import { resolveSoundId } from "@/utils/sounds";
import { stopAlarm } from "@/services/scheduler";
import { useSoundPlayer } from "./use-sound-player";
import { Button } from "./ui";
import AndroidAlarm from "@/services/android-alarm";

export function AlarmSound({ alarm, preview, silent = false, immediate = false }: { alarm: Alarm; preview: boolean; silent?: boolean; immediate?: boolean }) {
  const { play, stop, error } = useSoundPlayer();
  const [handoffError, setHandoffError] = useState(false);
  const latest = useRef(alarm); latest.current = alarm;
  useFocusEffect(useCallback(() => {
    // Android's foreground service owns playback across screens and app backgrounding.
    if (AndroidAlarm && !preview) {
      const active = AndroidAlarm.activeAlarm();
      if (!active || active.alarmId !== alarm.id) return;
      const apply = (enabled: boolean) => {
        void AndroidAlarm!.setMissionSilenced(active.eventId, enabled).catch(() => setHandoffError(true));
      };
      const sync = () => apply(silent && AppState.currentState === "active");
      sync();
      const sub = AppState.addEventListener("change", sync);
      const lease = silent ? setInterval(sync, 10_000) : undefined;
      return () => { sub.remove(); clearInterval(lease); apply(false); };
    }
    if (resolveSoundId(alarm.sound) === "system" && !silent) return;
    let cancelled = false;
    const start = async () => {
      try {
        // Transfer the audible alarm to the foreground app, avoiding two players.
        if (!preview) await stopAlarm(latest.current);
        if (!cancelled && !silent) await play(latest.current.sound, true, { volume: latest.current.volume, rampSeconds: immediate ? 0 : latest.current.volumeRampSeconds });
      } catch { if (!cancelled) setHandoffError(true); }
    };
    if (!preview) void start();
    return () => { cancelled = true; stop(); };
  }, [alarm.id, alarm.sound, preview, silent, immediate, play, stop]));
  if (AndroidAlarm && !preview) return handoffError ? <Button title="Retry mission sound" secondary onPress={() => {
    const active = AndroidAlarm!.activeAlarm();
    if (active?.alarmId === alarm.id) void AndroidAlarm!.setMissionSilenced(active.eventId, silent)
      .then(() => setHandoffError(false)).catch(() => {});
  }} /> : null;
  return !silent && (error || handoffError) ? <Button title="Play alarm sound" secondary onPress={() => { setHandoffError(false); void play(alarm.sound, true, { volume: alarm.volume, rampSeconds: immediate ? 0 : alarm.volumeRampSeconds }); }} /> : null;
}
