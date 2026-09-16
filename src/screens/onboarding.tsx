import React, { useEffect, useRef, useState } from "react";
import { View, ScrollView, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Extrapolation, interpolate, useAnimatedReaction, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useMotion, easeOut } from "@/components/motion";
import { ClayMotion } from "@/components/clay-motion";
import { ClayMotionProps } from "@/components/clay-motion.sources";
import { OnboardingButton } from "@/components/onboarding-button";
import { T, Tap, Icon } from "@/components/ui";
import { art, colors as c } from "@/theme";
import { useApp } from "@/state/app-state";
import { requestPermission } from "@/services/scheduler";
import { haptic, withHapticFeedback } from "@/services/haptics";

const steps: { eyebrow: string; title: string; description: string; cta: string; scene: ClayMotionProps["name"] }[] = [
  { eyebrow: "LESS GROGGY. MORE READY.", title: "Wake up fresh.\nFeel more you.", description: "Less “five more minutes.”\nMore time for the morning you want.", cta: "Refresh my mornings", scene: "moon" },
  { eyebrow: "A WAKE-UP THAT FEELS LIKE YOU", title: "Your sound.\nYour fresh start.", description: "A favorite song. A familiar adhan.\nYour own photo to greet the day.", cta: "Make it mine", scene: "sunrise" },
  { eyebrow: "BREAK THE SNOOZE LOOP", title: "Wake your mind.\nStart your day.", description: "Shake, solve, or match your way awake.\nSmall missions to help you get going.", cta: "Let’s set it up", scene: "memory" },
  { eyebrow: "YOUR NEXT MORNING STARTS HERE", title: "Make tomorrow\na fresh start.", description: "Enable alarms, choose your time,\nand plan a morning worth getting up for.", cta: "Enable alarms", scene: "clock" },
];
function Page({ index, width, height, active, offset }: { index: number; width: number; height: number; active: boolean; offset: ReturnType<typeof useSharedValue<number>> }) {
  const { reduced } = useMotion();
  const page = steps[index];
  const compact = height < 700;
  const artSize = Math.min(width - 28, compact ? Math.max(120, height * .23) : Math.max(195, height * .39));
  const artStyle = useAnimatedStyle(() => {
    const distance = (offset.get() - index * width) / width;
    return { opacity: interpolate(Math.abs(distance), [0, 1], [1, .2], Extrapolation.CLAMP), transform: [{ translateX: reduced ? 0 : distance * width * .18 }, { scale: reduced ? 1 : interpolate(Math.abs(distance), [0, 1], [1, .88], Extrapolation.CLAMP) }] };
  });
  return <View style={{ width, flex: 1 }} aria-hidden={!active} accessibilityElementsHidden={!active} importantForAccessibility={active ? "auto" : "no-hide-descendants"}>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 26, paddingBottom: compact ? 12 : 16, gap: compact ? 12 : 16 }}>
      <Animated.View style={[{ alignItems: "center" }, artStyle]}>
        {index < 2 ? <View style={{ width: width - 28, height: artSize, overflow: "hidden" }}>
          <Image testID={`onboarding-artwork-${index + 1}`} source={index === 0 ? art.moon : art.valley}
            contentFit={index === 0 ? "contain" : "cover"} contentPosition={index === 0 ? "center" : "bottom"}
            accessible={false} style={{ width: "100%", height: "100%" }} />
          <LinearGradient pointerEvents="none" colors={[c.bg, "transparent", "transparent", c.bg]} locations={[0, .14, .83, 1]} style={{ position: "absolute", inset: 0 }} />
        </View> : <ClayMotion name={page.scene} playing={active} size={artSize} />}
      </Animated.View>
      <View style={{ alignItems: "center", gap: compact ? 10 : 12 }}>
        <T variant="eyebrow" style={{ color: c.peach, fontSize: 10, textAlign: "center" }}>{page.eyebrow}</T>
        <T variant="title" style={{ textAlign: "center", fontSize: width < 350 ? 29 : 35, lineHeight: width < 350 ? 36 : 43 }}>{page.title}</T>
        <T style={{ textAlign: "center", color: c.muted, ...(compact ? { fontSize: 14, lineHeight: 21 } : { lineHeight: 24 }) }}>{page.description}</T>
      </View>
    </ScrollView>
  </View>;
}
export function Onboarding() {
  const [step, setStep] = useState(0), [pending, setPending] = useState(false), [denied, setDenied] = useState(false), [message, setMessage] = useState<string | null>(null);
  const { update, clearError } = useApp();
  const { width: windowWidth, height } = useWindowDimensions();
  const width = Math.min(windowWidth, 480);
  const inset = useSafeAreaInsets();
  const { reduced } = useMotion();
  const pager = useRef<ScrollView>(null), selected = useRef(0);
  const mounted = useRef(true), finishing = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const offset = useSharedValue(0);
  const destination = useSharedValue(-1);
  const selectPage = (next: number) => {
    if (next !== selected.current) { selected.current = next; setStep(next); haptic("selection"); }
  };
  useAnimatedReaction(() => Math.max(0, Math.min(3, Math.round(offset.get() / width))), (next, previous) => {
    if (destination.get() >= 0 && next !== destination.get()) return;
    if (next === destination.get()) destination.set(-1);
    if (previous !== null && next !== previous) scheduleOnRN(selectPage, next);
  });
  useEffect(() => { pager.current?.scrollTo({ x: selected.current * width, animated: false }); }, [width]);
  const scroll = useAnimatedScrollHandler(event => { offset.set(event.contentOffset.x); });
  function go(index: number) {
    destination.set(index === selected.current ? -1 : index);
    selected.current = index;
    setStep(index);
    pager.current?.scrollTo({ x: index * width, animated: !reduced });
  }
  async function finish(ask: boolean, settled = Promise.resolve()) {
    if (finishing.current) return;
    finishing.current = true;
    setPending(true);
    setMessage(null);
    try {
      if (ask) {
        const status = await requestPermission();
        if (status === "denied") { setDenied(true); haptic("warning"); setMessage("Alarm permission is off. You can enable it later in Settings."); return; }
      }
      await withHapticFeedback(() => update({ onboarded: true }));
      // Persistence starts on press; the short visual handoff has a fixed fallback
      // and never depends on Lottie loading or its completion callback.
      await settled;
      if (mounted.current) router.replace("/(tabs)");
    } catch (error) {
      clearError();
      setMessage(error instanceof Error ? error.message : "Couldn’t finish setup. Please try again.");
    } finally { finishing.current = false; if (mounted.current) setPending(false); }
  }
  return <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: inset.top }}>
    <View style={{ paddingHorizontal: 26, height: 58, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}><Icon name="sunny-outline" size={20} color={c.peach} /><T variant="label" style={{ letterSpacing: 1 }}>Refresh</T></View>
      {step > 0 && <Tap label="Skip onboarding" disabled={pending} haptic={false} onPress={() => void finish(false)}><T variant="small" style={{ color: c.muted }}>Skip</T></Tap>}
    </View>
    <Animated.ScrollView ref={pager} testID="onboarding-pager" horizontal pagingEnabled bounces={false} scrollEnabled={!pending} showsHorizontalScrollIndicator={false} onScroll={scroll} onScrollBeginDrag={() => destination.set(-1)} scrollEventThrottle={16} style={{ flex: 1 }}
      onMomentumScrollEnd={event => { const next = Math.max(0, Math.min(3, Math.round(event.nativeEvent.contentOffset.x / width))); if (next !== selected.current) { selected.current = next; setStep(next); haptic("selection"); } }}>
      {steps.map((_, index) => <Page key={index} index={index} width={width} height={height} active={index === step} offset={offset} />)}
    </Animated.ScrollView>
    <View style={{ paddingHorizontal: 26, paddingBottom: Math.max(inset.bottom, 18), gap: 12 }}>
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 2 }}>
        {steps.map((_, index) => <Tap key={index} label={`Onboarding step ${index + 1}`} selected={index === step} disabled={pending} onPress={() => go(index)}>
          <View style={{ width: 37, height: 34, alignItems: "center", justifyContent: "center" }}><Animated.View style={{ width: 25, height: 6, borderRadius: 4, backgroundColor: index === step ? c.peach : c.faint, transform: [{ scaleX: index === step ? 1 : .25 }], transitionProperty: ["transform", "backgroundColor"], transitionDuration: reduced ? 0 : 220, transitionTimingFunction: easeOut }} /></View>
        </Tap>)}
      </View>
      {message && <T accessibilityLiveRegion="polite" variant="small" style={{ color: c.peach, textAlign: "center" }}>{message}</T>}
      <OnboardingButton step={step} title={step === 3 && denied ? "Continue for now" : steps[step].cta} pending={pending} onPress={settled => step < 3 ? go(step + 1) : void finish(!denied, settled)} />
      <View style={{ minHeight: 30, alignItems: "center", justifyContent: "center" }}>
        {step === 0 ? <T variant="small" style={{ color: c.faint, textAlign: "center" }}>A FRESH START, EVERY DAY</T> : step === 3 ? <Tap disabled={pending} haptic={false} onPress={() => void finish(false)}><T variant="small" style={{ color: c.muted }}>Maybe later</T></Tap> : <Tap onPress={() => go(step - 1)}><T variant="small" style={{ color: c.muted }}>Back</T></Tap>}
      </View>
    </View>
  </View>;
}
