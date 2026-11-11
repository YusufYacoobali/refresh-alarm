import React, { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { AppState, Platform } from "react-native";
import { Alarm } from "@/utils/alarms";
import { resolveSoundId } from "@/utils/sounds";
import { stopAlarm } from "@/services/scheduler";
import { useSoundPlayer } from "./use-sound-player";
import { Button } from "./ui";
import AndroidAlarm from "@/services/android-alarm";
import { cancelMissionTimeout } from "@/services/mission-timeout";

export function AlarmSound({ alarm, preview, playPreview = false, ringing = false, silent = false, immediate = false }: { alarm: Alarm; preview: boolean; playPreview?: boolean; ringing?: boolean; silent?: boolean; immediate?: boolean }) {
  const { play, stop, error, playing } = useSoundPlayer();
  const [handoffError, setHandoffError] = useState(false);
  const latest = useRef(alarm); latest.current = alarm;
  const playback = useRef({ error, playing }); playback.current = { error, playing };
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
    if (resolveSoundId(alarm.sound) === "system" && !silent && Platform.OS !== "ios") return;
    let cancelled = false;
    let starting = false;
    let transferred = false;
    const start = async () => {
      // AlarmKit must keep owning the audible lock-screen alarm until the app
      // is active. JS/audio work can suspend during an inactive/background handoff.
      const canTransfer = () => Platform.OS !== "ios" || AppState.currentState === "active";
      if (cancelled || starting || !canTransfer()) return;
      starting = true;
      try {
        // Transfer the audible alarm to the foreground app, avoiding two players.
        if (!preview && !transferred) {
          if (ringing) await cancelMissionTimeout();
          if (cancelled || !canTransfer()) return;
          await stopAlarm(latest.current);
          transferred = true;
        }
        if (!cancelled && !silent && canTransfer()) {
          // The system tone has no foreground audio asset; use the bundled beep.
          const sound = resolveSoundId(latest.current.sound) === "system" ? "digital_beep" : latest.current.sound;
          await play(sound, true, { volume: latest.current.volume, rampSeconds: immediate ? 0 : latest.current.volumeRampSeconds });
        }
        if (!cancelled) setHandoffError(false);
      } catch { if (!cancelled) setHandoffError(true); }
      finally { starting = false; }
    };
    if (!preview || playPreview) void start();
    const recover = () => {
      if ((!preview || playPreview) && AppState.currentState === "active" &&
          ((!preview && !transferred) || (!silent && (playback.current.error || !playback.current.playing)))) void start();
    };
    // AlarmKit can still own the audio session while the app is opening.
    // Retry automatically when it releases the session or the app resumes.
    const retry = Platform.OS === "ios" && (!preview || playPreview) ? setInterval(recover, 1500) : undefined;
    const sub = AppState.addEventListener("change", recover);
    return () => { cancelled = true; clearInterval(retry); sub.remove(); stop(); };
  }, [alarm.id, alarm.sound, preview, playPreview, ringing, silent, immediate, play, stop]));
  if (AndroidAlarm && !preview) return handoffError ? <Button title="Retry mission sound" secondary onPress={() => {
    const active = AndroidAlarm!.activeAlarm();
    if (active?.alarmId === alarm.id) void AndroidAlarm!.setMissionSilenced(active.eventId, silent)
      .then(() => setHandoffError(false)).catch(() => {});
  }} /> : null;
  return Platform.OS === "web" && !silent && (error || handoffError) ? <Button title="Play alarm sound" secondary onPress={() => { setHandoffError(false); void play(alarm.sound, true, { volume: alarm.volume, rampSeconds: immediate ? 0 : alarm.volumeRampSeconds }); }} /> : null;
}
