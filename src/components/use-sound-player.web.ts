import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Asset } from "expo-asset";
import { audioSources } from "@/data/audio-sources";
import { resolveSoundId, SoundId, isCustomSound } from "@/utils/sounds";
import { customAudioSource } from "@/services/custom-audio";
import { alarmGain } from "@/utils/alarm-playback";

// Own the browser play promise so blocked autoplay is visible and retryable.
export function useSoundPlayer() {
  const current = useRef<HTMLAudioElement | null>(null);
  const revision = useRef(0);
  const fade = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const release = useRef<(() => void) | undefined>(undefined);
  const [playing, setPlaying] = useState<SoundId | null>(null), [error, setError] = useState<string | null>(null);
  const stop = useCallback(() => {
    revision.current++;
    clearInterval(fade.current);
    const audio = current.current; current.current = null;
    if (audio) { audio.pause(); audio.removeAttribute("src"); audio.load(); audio.remove(); }
    release.current?.(); release.current = undefined;
    setPlaying(null);
  }, []);
  const play = useCallback(async (id: SoundId, loop = false, options?: { volume?: number; rampSeconds?: number }) => {
    stop(); setError(null);
    const resolved = resolveSoundId(id);
    if (resolved === "system") return;
    const request = revision.current;
    let source: { uri: string; release?: () => void };
    try { source = isCustomSound(resolved) ? await customAudioSource(resolved) : { uri: Asset.fromModule(audioSources[resolved]).uri }; }
    catch (e) { if (request === revision.current) setError(e instanceof Error ? e.message : "Couldn’t load this sound."); return; }
    if (request !== revision.current) { source.release?.(); return; }
    release.current = source.release;
    const audio = new Audio(source.uri);
    audio.dataset.sound = resolved; audio.dataset.alarm = String(loop); audio.hidden = true;
    const volume = options?.volume ?? (loop ? 1 : .7), ramp = options?.rampSeconds ?? 0;
    audio.loop = loop; audio.volume = volume * alarmGain(0, ramp);
    current.current = audio; document.body.appendChild(audio);
    const failed = () => { if (current.current === audio) { setError("Tap play to enable sound."); stop(); } };
    audio.onerror = failed;
    audio.onended = () => { if (current.current === audio) stop(); };
    try {
      await audio.play();
      if (current.current === audio) {
        setPlaying(resolved);
        if (ramp > 0) {
          const started = Date.now();
          fade.current = setInterval(() => {
            if (current.current !== audio) return;
            audio.volume = volume * alarmGain(Date.now() - started, ramp);
            if (Date.now() - started >= ramp * 1000) clearInterval(fade.current);
          }, 250);
        }
      }
    } catch { failed(); }
  }, [stop]);
  useFocusEffect(useCallback(() => () => stop(), [stop]));
  useEffect(() => { const hidden = () => { if (document.hidden && !current.current?.loop) stop(); }; document.addEventListener("visibilitychange", hidden); return () => document.removeEventListener("visibilitychange", hidden); }, [stop]);
  return { play, stop, playing, error };
}
