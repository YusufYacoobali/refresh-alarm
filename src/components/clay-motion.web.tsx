import React, { useEffect, useRef } from "react";
import { View } from "react-native";
import lottie, { AnimationItem } from "lottie-web";
import { motionSources, ClayMotionProps } from "./clay-motion.sources";
import { useSceneMotion } from "./motion";

// SVG playback is entirely local: no CDN, WASM fetch, or image/font dependency.
export function ClayMotion({ name, size = 180, loop = true, playing = true, revision = 0, style }: ClayMotionProps) {
  const container = useRef<HTMLDivElement>(null), player = useRef<AnimationItem | null>(null);
  const scene = useSceneMotion();
  const { reduced } = scene;
  const running = scene.running && playing;
  const mode = useRef({ running, reduced });
  mode.current = { running, reduced };
  useEffect(() => {
    if (!container.current) return;
    const animation = lottie.loadAnimation({ container: container.current, renderer: "svg", loop, autoplay: false, animationData: structuredClone(motionSources[name]), rendererSettings: { progressiveLoad: false, preserveAspectRatio: "xMidYMid meet" } });
    player.current = animation;
    const applyMode = () => {
      if (mode.current.reduced) animation.goToAndStop(animation.totalFrames / 2, true);
      else if (mode.current.running) animation.play();
      else animation.pause();
    };
    animation.addEventListener("DOMLoaded", applyMode);
    applyMode();
    return () => { animation.destroy(); player.current = null; };
  }, [name, loop]);
  useEffect(() => {
    if (reduced && player.current) player.current.goToAndStop(player.current.totalFrames / 2, true);
    else if (running) player.current?.play();
    else player.current?.pause();
  }, [running, reduced]);
  useEffect(() => { if (revision && running) player.current?.goToAndPlay(0, true); }, [revision]);
  return <View pointerEvents="none" aria-hidden style={[{ width: size, height: size }, style]}>
    <div ref={container} data-motion={name} data-playing={running} data-reduced-motion={reduced} style={{ width: "100%", height: "100%" }} />
  </View>;
}
