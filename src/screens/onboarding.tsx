import React, { useState } from "react";
import { View, StyleSheet, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useReducedMotion } from "react-native-reanimated";
import { T, Tap, Button, Enter, Icon } from "@/components/ui";
import { art, colors as c } from "@/theme";
import { useApp } from "@/state/app-state";
import { requestPermission } from "@/services/scheduler";

const steps = [
  {
    eyebrow: "A LITTLE NIGHT. A LITTLE LIGHT.",
    title: "A kinder way\nto wake up.",
    description: "More than an alarm.\nA brighter you.",
    image: art.moon,
  },
  {
    eyebrow: "MAKE ROOM FOR GOOD MORNINGS",
    title: "Small rituals.\nBrighter days.",
    description:
      "A gentle start, a clearer mind,\nand a little moment just for you.",
    image: art.valley,
  },
  {
    eyebrow: "WAKE UP YOUR WAY",
    title: "Give your mind\na little sunshine.",
    description:
      "Solve a puzzle, find a matching pair,\nor shake off the sleep. You choose.",
    image: art.moon,
  },
  {
    eyebrow: "WE’LL BE HERE IN THE MORNING",
    title: "Rest easy.\nWe’ve got the wake-up.",
    description:
      "Allow alarms so Daybreak can let you\nknow when your new day begins.",
    image: art.valley,
  },
];
export function Onboarding() {
  const [step, setStep] = useState(0),
    [pending, setPending] = useState(false),
    [denied, setDenied] = useState(false);
  const { update } = useApp();
  const inset = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const page = steps[step];
  async function finish(ask: boolean) {
    setPending(true);
    try {
      if (ask) {
        const status = await requestPermission();
        if (status === "denied") {
          setDenied(true);
          return;
        }
      }
      await update({ onboarded: true });
      router.replace("/(tabs)");
    } finally {
      setPending(false);
    }
  }
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: inset.top }}>
      <View style={s.top}>
        <View style={{ flexDirection: "row", gap: 7, alignItems: "center" }}>
          <Icon name="sunny-outline" size={19} color={c.peach} />
          <T variant="label" style={{ letterSpacing: 1 }}>
            daybreak
          </T>
        </View>
        {step > 0 && (
          <Tap onPress={() => void finish(false).catch(() => {})}>
            <T variant="small" style={{ color: c.muted }}>
              Skip
            </T>
          </Tap>
        )}
      </View>
      <View style={{ flex: 1, justifyContent: "center" }}>
        <Animated.View
          style={{
            height: Math.min(height * 0.47, 440),
            animationName: reduced
              ? undefined
              : {
                  "0%, 100%": { transform: [{ translateY: 0 }] },
                  "50%": { transform: [{ translateY: -9 }] },
                },
            animationDuration: "6000ms",
            animationIterationCount: "infinite",
            animationTimingFunction: "ease-in-out",
          }}
        >
          <Image
            key={step}
            source={page.image}
            transition={250}
            contentFit="cover"
            contentPosition={step % 2 ? "bottom" : "center"}
            style={{ width: "100%", height: "100%" }}
          />
          <LinearGradient colors={["transparent", c.bg]} style={s.fade} />
        </Animated.View>
        <Enter
          key={`text-${step}`}
          style={{ alignItems: "center", paddingHorizontal: 24, gap: 15 }}
        >
          <T variant="eyebrow" style={{ color: c.peach, textAlign: "center" }}>
            {page.eyebrow}
          </T>
          <T
            variant="title"
            style={{ fontSize: 35, lineHeight: 42, textAlign: "center" }}
          >
            {page.title}
          </T>
          <T style={{ color: c.muted, textAlign: "center" }}>
            {denied
              ? "Alarms are off for now. You can enable them in Settings whenever you’re ready."
              : page.description}
          </T>
        </Enter>
      </View>
      <View
        style={{
          padding: 28,
          paddingBottom: Math.max(inset.bottom, 24),
          gap: 24,
        }}
      >
        <View
          style={{ flexDirection: "row", gap: 7, justifyContent: "center" }}
        >
          {steps.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === step ? 22 : 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: i === step ? c.peach : c.line,
              }}
            />
          ))}
        </View>
        <Button
          title={
            step === 0
              ? "Get started"
              : step === 3
                ? denied
                  ? "Continue for now"
                  : "Enable alarms"
                : "Continue"
          }
          loading={pending}
          icon="arrow-forward"
          onPress={() =>
            step < 3 ? setStep(step + 1) : void finish(!denied).catch(() => {})
          }
        />
        {step === 0 ? (
          <T variant="small" style={{ color: c.faint, textAlign: "center" }}>
            YOUR MORNING, A LITTLE MORE MINDFUL
          </T>
        ) : step === 3 ? (
          <Tap onPress={() => void finish(false).catch(() => {})}>
            <T variant="small" style={{ textAlign: "center", color: c.muted }}>
              Maybe later
            </T>
          </Tap>
        ) : (
          <Tap onPress={() => setStep(step - 1)}>
            <T variant="small" style={{ textAlign: "center", color: c.muted }}>
              Back
            </T>
          </Tap>
        )}
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  top: {
    paddingHorizontal: 28,
    paddingTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fade: { position: "absolute", bottom: 0, height: 70, left: 0, right: 0 },
});
