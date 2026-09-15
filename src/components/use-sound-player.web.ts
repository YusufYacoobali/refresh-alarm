import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Asset } from "expo-asset";
import { audioSources } from "@/data/audio-sources";
import { resolveSoundId, SoundId } from "@/utils/sounds";

// Own the browser play promise so blocked autoplay is visible and retryable.
export function useSoundPlayer() {
  const current = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<SoundId | null>(null), [error, setError] = useState<string | null>(null);
  const stop = useCallback(() => {
    const audio = current.current; current.current = null;
    if (audio) { audio.pause(); audio.removeAttribute("src"); audio.load(); audio.remove(); }
    setPlaying(null);
  }, []);
  const play = useCallback(async (id: SoundId, loop = false) => {
    stop(); setError(null);
    const resolved = resolveSoundId(id);
    if (resolved === "system") return;
    const audio = new Audio(Asset.fromModule(audioSources[resolved]).uri);
    audio.dataset.sound = resolved; audio.dataset.alarm = String(loop); audio.hidden = true;
    audio.loop = loop; audio.volume = loop ? 1 : .7;
    current.current = audio; document.body.appendChild(audio);
    const failed = () => { if (current.current === audio) { setError("Tap play to enable sound."); stop(); } };
    audio.onerror = failed;
    audio.onended = () => { if (current.current === audio) stop(); };
    try { await audio.play(); if (current.current === audio) setPlaying(resolved); } catch { failed(); }
  }, [stop]);
  useFocusEffect(useCallback(() => () => stop(), [stop]));
  useEffect(() => { const hidden = () => { if (document.hidden && !current.current?.loop) stop(); }; document.addEventListener("visibilitychange", hidden); return () => document.removeEventListener("visibilitychange", hidden); }, [stop]);
  return { play, stop, playing, error };
}
