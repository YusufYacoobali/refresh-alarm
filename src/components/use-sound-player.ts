import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { audioSources } from "@/data/audio-sources";
import { resolveSoundId, soundName, SoundId, isCustomSound } from "@/utils/sounds";
import { customAudioSource } from "@/services/custom-audio";
import { alarmGain } from "@/utils/alarm-playback";

export function useSoundPlayer() {
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [playing, setPlaying] = useState<SoundId | null>(null), [error, setError] = useState<string | null>(null);
  const revision = useRef(0);
  const looping = useRef(false);
  const fade = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const stop = useCallback(() => {
    revision.current++; looping.current = false;
    clearInterval(fade.current);
    // The hook may already have released its native player during route teardown.
    try { player.pause(); player.setActiveForLockScreen(false); } catch {}
    setPlaying(null);
  }, [player]);
  const play = useCallback(async (id: SoundId, loop = false, options?: { volume?: number; rampSeconds?: number }) => {
    stop(); setError(null);
    const resolved = resolveSoundId(id);
    if (resolved === "system") return;
    const request = revision.current;
    try {
      await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: loop, interruptionMode: "doNotMix" });
      const source = isCustomSound(resolved) ? { uri: (await customAudioSource(resolved)).uri } : audioSources[resolved];
      if (request !== revision.current) return;
      const volume = options?.volume ?? (loop ? 1 : .7), ramp = options?.rampSeconds ?? 0;
      player.replace(source); player.loop = loop; player.volume = volume * alarmGain(0, ramp);
      looping.current = loop;
      if (loop) player.setActiveForLockScreen(true, { title: soundName(id), artist: "Refresh alarm" });
      player.play(); setPlaying(resolved);
      if (ramp > 0) {
        const started = Date.now();
        fade.current = setInterval(() => {
          if (request !== revision.current) return;
          player.volume = volume * alarmGain(Date.now() - started, ramp);
          if (Date.now() - started >= ramp * 1000) clearInterval(fade.current);
        }, 250);
      }
    } catch { if (request === revision.current) { setError("Couldn’t play this sound. Try again."); setPlaying(null); } }
  }, [player, stop]);
  useEffect(() => { if (status.didJustFinish || status.error) setPlaying(null); if (status.error) setError("Couldn’t play this sound. Try again."); }, [status.didJustFinish, status.error]);
  useFocusEffect(useCallback(() => () => stop(), [stop]));
  useEffect(() => { const sub = AppState.addEventListener("change", state => { if (state !== "active" && !looping.current) stop(); }); return () => sub.remove(); }, [stop]);
  return { play, stop, playing, error };
}
