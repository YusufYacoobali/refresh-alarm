import React, { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Alarm } from "@/utils/alarms";
import { resolveSoundId } from "@/utils/sounds";
import { stopAlarm } from "@/services/scheduler";
import { useSoundPlayer } from "./use-sound-player";
import { Button } from "./ui";
import AndroidAlarm from "@/services/android-alarm";

export function AlarmSound({ alarm, preview }: { alarm: Alarm; preview: boolean }) {
  const { play, stop, error } = useSoundPlayer();
  const [handoffError, setHandoffError] = useState(false);
  const latest = useRef(alarm); latest.current = alarm;
  useFocusEffect(useCallback(() => {
    // Android's foreground service owns playback across screens and app backgrounding.
    if (AndroidAlarm && !preview) return;
    if (resolveSoundId(alarm.sound) === "system") return;
    let cancelled = false;
    const start = async () => {
      try {
        // Transfer the audible alarm to the foreground app, avoiding two players.
        if (!preview) await stopAlarm(latest.current);
        if (!cancelled) await play(latest.current.sound, true);
      } catch { if (!cancelled) setHandoffError(true); }
    };
    if (!preview) void start();
    return () => { cancelled = true; stop(); };
  }, [alarm.id, alarm.sound, preview, play, stop]));
  return error || handoffError ? <Button title="Play alarm sound" secondary onPress={() => { setHandoffError(false); void play(alarm.sound, true); }} /> : null;
}
