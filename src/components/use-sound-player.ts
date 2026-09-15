import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { audioSources } from "@/data/audio-sources";
import { resolveSoundId, soundName, SoundId } from "@/utils/sounds";

export function useSoundPlayer() {
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [playing, setPlaying] = useState<SoundId | null>(null), [error, setError] = useState<string | null>(null);
  const revision = useRef(0);
  const looping = useRef(false);
  const stop = useCallback(() => {
    revision.current++; looping.current = false;
    // The hook may already have released its native player during route teardown.
    try { player.pause(); player.setActiveForLockScreen(false); } catch {}
    setPlaying(null);
  }, [player]);
  const play = useCallback(async (id: SoundId, loop = false) => {
    stop(); setError(null);
    const resolved = resolveSoundId(id);
    if (resolved === "system") return;
    const request = revision.current;
    try {
      await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: loop, interruptionMode: "doNotMix" });
      if (request !== revision.current) return;
      player.replace(audioSources[resolved]); player.loop = loop; player.volume = loop ? 1 : .7;
      looping.current = loop;
      if (loop) player.setActiveForLockScreen(true, { title: soundName(id), artist: "Refresh alarm" });
      player.play(); setPlaying(resolved);
    } catch { if (request === revision.current) { setError("Couldn’t play this sound. Try again."); setPlaying(null); } }
  }, [player, stop]);
  useEffect(() => { if (status.didJustFinish || status.error) setPlaying(null); if (status.error) setError("Couldn’t play this sound. Try again."); }, [status.didJustFinish, status.error]);
  useFocusEffect(useCallback(() => () => stop(), [stop]));
  useEffect(() => { const sub = AppState.addEventListener("change", state => { if (state !== "active" && !looping.current) stop(); }); return () => sub.remove(); }, [stop]);
  return { play, stop, playing, error };
}
