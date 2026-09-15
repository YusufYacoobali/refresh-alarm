import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { AccessibilityInfo, AppState, Platform, StyleProp, ViewStyle } from "react-native";
import { useFocusEffect } from "expo-router";
import Animated, { cancelAnimation, cubicBezier, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";

export const easeOut = cubicBezier(0.23, 1, 0.32, 1);
const MotionContext = createContext({ reduced: false, active: true });

export function MotionProvider({ children }: { children: React.ReactNode }) {
  const initialReduced = useReducedMotion();
  const [reduced, setReduced] = useState(initialReduced);
  const [active, setActive] = useState(AppState.currentState !== "background");
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduced(value); });
    const preference = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    const app = AppState.addEventListener("change", state => setActive(state === "active"));
    const visibility = () => setActive(!document.hidden);
    const media = Platform.OS === "web" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    const mediaChange = () => setReduced(media?.matches ?? false);
    if (Platform.OS === "web") {
      document.addEventListener("visibilitychange", visibility);
      media?.addEventListener("change", mediaChange);
    }
    return () => {
      mounted = false;
      preference.remove();
      app.remove();
      if (Platform.OS === "web") document.removeEventListener("visibilitychange", visibility);
      media?.removeEventListener("change", mediaChange);
    };
  }, []);
  return <MotionContext.Provider value={{ reduced, active }}>{children}</MotionContext.Provider>;
}

export const useMotion = () => useContext(MotionContext);
export function useSceneMotion() {
  const settings = useMotion();
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));
  return { ...settings, running: focused && settings.active && !settings.reduced };
}

export function Float({ children, style, distance = 7 }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; distance?: number }) {
  const { running, reduced } = useSceneMotion();
  return <Animated.View style={[style, {
    animationName: reduced ? undefined : { "0%,100%": { transform: [{ translateY: 0 }, { rotate: "-1deg" }] }, "50%": { transform: [{ translateY: -distance }, { rotate: "1deg" }] } },
    animationDuration: "6000ms", animationTimingFunction: "ease-in-out", animationIterationCount: "infinite",
    animationPlayState: running ? "running" : "paused",
  }]}>{children}</Animated.View>;
}

// Interaction-driven feedback runs on the UI thread and is interruptible.
export function useFeedback(revision: number, kind: "success" | "error" = "success") {
  const { reduced } = useMotion();
  const x = useSharedValue(0), scale = useSharedValue(1);
  useEffect(() => {
    if (!revision || reduced) { x.set(0); scale.set(1); return; }
    if (kind === "error") x.set(withSequence(withTiming(-7, { duration: 55 }), withTiming(7, { duration: 65 }), withTiming(-3, { duration: 55 }), withTiming(0, { duration: 65 })));
    else scale.set(withSequence(withTiming(1.045, { duration: 90, easing: Easing.bezier(0.23,1,0.32,1) }), withSpring(1, { duration: 400, dampingRatio: 1 })));
    return () => { cancelAnimation(x); cancelAnimation(scale); };
  }, [revision, kind, reduced]);
  return useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }, { scale: scale.get() }] }));
}
