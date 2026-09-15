import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated from "react-native-reanimated";
import { ClayMotion } from "./clay-motion";
import { easeOut, useSceneMotion } from "./motion";
import { Icon, T } from "./ui";
import { colors as c } from "@/theme";
import { haptic } from "@/services/haptics";

const scenes = ["buttonStarlight", "buttonSunrise", "buttonMatch", "buttonBell"] as const;
const DURATION = 800;

/** A one-shot illustration travels through the CTA while its page moves. */
export function OnboardingButton({ step, title, pending, onPress }: {
  step: number;
  title: string;
  pending: boolean;
  onPress(settled: Promise<void>): void;
}) {
  const { reduced, running } = useSceneMotion();
  const [pressed, setPressed] = useState(false);
  const [effect, setEffect] = useState<{ step: number; revision: number } | null>(null);
  const revision = useRef(0), locked = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const release = useRef<(() => void) | null>(null);
  function settle() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    locked.current = false;
    release.current?.();
    release.current = null;
  }
  useEffect(() => () => settle(), []);
  useEffect(() => {
    if (reduced || !running) { settle(); setEffect(null); }
  }, [reduced, running]);
  function activate() {
    if (locked.current || pending) return;
    // The final action reports its permission/save outcome instead of a press pulse.
    if (step < 3) haptic("light");
    if (reduced) { onPress(Promise.resolve()); return; }
    locked.current = true;
    setEffect({ step, revision: ++revision.current });
    const settled = new Promise<void>(resolve => { release.current = resolve; });
    timer.current = setTimeout(() => { settle(); setEffect(null); }, DURATION);
    // Start navigation/permission work immediately. Lottie never drives app state.
    onPress(settled);
  }
  const busy = pending || effect !== null;
  return <Pressable accessibilityRole="button" accessibilityLabel={title}
    accessibilityState={{ disabled: busy, busy }} aria-disabled={busy} disabled={busy}
    onPress={activate} onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)}>
    <Animated.View style={{ transform: [{ scale: pressed && !reduced ? .97 : 1 }], transitionProperty: "transform", transitionDuration: reduced ? 0 : 120, transitionTimingFunction: easeOut }}>
      <LinearGradient colors={["#FFE4CC", "#F4C8A9"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ minHeight: 60, paddingVertical: 18, paddingHorizontal: 24, borderRadius: 999, overflow: "hidden", justifyContent: "center", alignItems: "center", boxShadow: "0 4px 24px #F8CEAF18" }}>
        <Animated.View key={effect?.revision ?? "rest"} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12,
          animationName: effect && !reduced ? { "0%": { opacity: 1, transform: [{ translateY: 0 }] }, "12%,62%": { opacity: 0, transform: [{ translateY: -6 }] }, "63%": { opacity: 0, transform: [{ translateY: 6 }] }, "100%": { opacity: 1, transform: [{ translateY: 0 }] } } : undefined,
          animationDuration: DURATION, animationTimingFunction: easeOut, animationIterationCount: 1 }}>
          {pending && !effect ? <ActivityIndicator color={c.ink} /> : <><T variant="label" style={{ color: c.ink, flexShrink: 1 }}>{title}</T><Icon name="arrow-forward" size={19} color={c.ink} /></>}
        </Animated.View>
        {effect && !reduced && <View pointerEvents="none" style={{ position: "absolute", inset: 0 }}>
          <ClayMotion key={effect.revision} name={scenes[effect.step]} loop={false} style={{ width: "100%", height: "100%" }} />
        </View>}
      </LinearGradient>
    </Animated.View>
  </Pressable>;
}
