import React, { useEffect, useRef } from "react";
import { View } from "react-native";
import LottieView from "lottie-react-native";
import { motionSources, ClayMotionProps } from "./clay-motion.sources";
import { useSceneMotion } from "./motion";

export function ClayMotion({ name, size = 180, loop = true, playing = true, revision = 0, style }: ClayMotionProps) {
  const ref = useRef<LottieView>(null);
  const scene = useSceneMotion();
  const { reduced } = scene;
  const running = scene.running && playing;
  useEffect(() => {
    if (running) ref.current?.play();
    else ref.current?.pause();
  }, [running, name, revision]);
  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[{ width: size, height: size }, style]}>
    <LottieView
      ref={ref} source={motionSources[name]} autoPlay={running} loop={loop}
      progress={reduced ? 0.5 : undefined} resizeMode="contain"
      onAnimationLoaded={() => { if (running) ref.current?.play(); else ref.current?.pause(); }}
      style={{ width: "100%", height: "100%" }}
    />
  </View>;
}
