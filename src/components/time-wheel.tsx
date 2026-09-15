import React, { useEffect, useRef } from "react";
import { View, ScrollView, Platform, Pressable, ViewStyle } from "react-native";
import Animated, { interpolate, Extrapolation, useAnimatedReaction, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { LinearGradient } from "expo-linear-gradient";
import { colors as c, fonts } from "@/theme";
import { haptic } from "@/services/haptics";
import { T } from "./ui";
import { useMotion } from "./motion";
import type { TimeWheelProps } from "./time-wheel.types";
import { useWheelInput } from "./use-wheel-input";

const ROW = 40;
function NumberRow({ text, index, offset, label, onPress }: { text: string; index: number; offset: ReturnType<typeof useSharedValue<number>>; label: string; onPress(): void }) {
  const { reduced } = useMotion();
  const style = useAnimatedStyle(() => {
    const distance = (offset.get() - index * ROW) / ROW;
    return { opacity: interpolate(Math.abs(distance), [0, 1, 2], [1, .58, .16], Extrapolation.CLAMP),
      transform: [{ perspective: 500 }, { rotateX: `${reduced ? 0 : Math.max(-45, Math.min(45, distance * 18))}deg` }, { scale: reduced ? 1 : interpolate(Math.abs(distance), [0, 2], [1, .9], Extrapolation.CLAMP) }] };
  });
  return <Pressable testID={`wheel-${label.toLowerCase()}-row-${index}`} accessible={false} onPress={onPress}
    style={[{ height: ROW }, Platform.OS === "web" && { scrollSnapAlign: "center" } as ViewStyle]}>
    <Animated.View style={[{ height: ROW, alignItems: "center", justifyContent: "center" }, style]}>
      <T style={{ fontFamily: fonts.bold, fontSize: 28, lineHeight: 34, fontVariant: ["tabular-nums"] }}>{text}</T>
    </Animated.View>
  </Pressable>;
}

// Compact custom wheels fit inside the sculpted dial on every platform.
export function TimeWheel({ label, values, value, onChange }: TimeWheelProps) {
  const scroll = useRef<ScrollView>(null), last = useRef(value), callback = useRef(onChange);
  const emitted = useRef(new Set<number>());
  callback.current = onChange;
  const { reduced } = useMotion();
  const initialOffset = useRef(value * ROW).current;
  const initialized = useRef(false);
  const interacting = useSharedValue(false);
  const offset = useSharedValue(value * ROW);
  useWheelInput({ scroll, row: ROW, count: values.length, reduced, interacting });
  const select = (next: number) => {
    if (next === last.current) return;
    last.current = next;
    emitted.current.add(next);
    haptic("selection");
    callback.current(next);
  };
  const handler = useAnimatedScrollHandler(event => {
    const y = event.contentOffset.y;
    offset.set(y);
  });
  useAnimatedReaction(() => Math.max(0, Math.min(values.length - 1, Math.round(offset.get() / ROW))), (next, prev) => {
    if (prev !== null && next !== prev && interacting.get()) scheduleOnRN(select, next);
  });
  useEffect(() => {
    // React can acknowledge an earlier detent after the next scroll event has
    // already arrived. That is not an external command to rewind the wheel.
    if (value === last.current) { emitted.current.clear(); return; }
    if (emitted.current.delete(value)) return;
    if (value !== last.current) {
      emitted.current.clear();
      last.current = value;
      interacting.set(false);
      scroll.current?.scrollTo({ y: value * ROW, animated: !reduced });
    }
  }, [value, reduced]);
  const choose = (next: number) => {
    interacting.set(false);
    select(next);
    scroll.current?.scrollTo({ y: next * ROW, animated: !reduced });
  };
  const move = (direction: number) => {
    const next = (last.current + direction + values.length) % values.length;
    choose(next);
  };
  return <View style={{ flex: 1, alignItems: "center" }}>
    <View accessible accessibilityRole="adjustable" accessibilityLabel={`Alarm ${label.toLowerCase()}`}
      aria-valuemin={0} aria-valuemax={values.length - 1} aria-valuenow={value} aria-valuetext={values[value]}
      accessibilityValue={{ min: 0, max: values.length - 1, now: value, text: values[value] }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={e => move(e.nativeEvent.actionName === "increment" ? 1 : -1)}
      {...(Platform.OS === "web" ? { tabIndex: 0, onKeyDown: (e: { key: string; preventDefault(): void }) => { if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); move(e.key === "ArrowDown" ? 1 : -1); } } } : {})}
      style={{ width: "100%", height: ROW * 3, overflow: "hidden" }}>
      <Animated.ScrollView ref={scroll} testID={`wheel-${label.toLowerCase()}`} showsVerticalScrollIndicator={false}
        snapToInterval={ROW} decelerationRate="normal" nestedScrollEnabled bounces={false}
        contentOffset={{ x: 0, y: initialOffset }} contentContainerStyle={{ paddingVertical: ROW }}
        onContentSizeChange={() => { if (!initialized.current) { initialized.current = true; scroll.current?.scrollTo({ y: initialOffset, animated: false }); } }}
        onScrollBeginDrag={() => interacting.set(true)}
        onScroll={handler} scrollEventThrottle={16}>
        {values.map((text, index) => <NumberRow key={index} text={text} index={index} label={label} offset={offset} onPress={() => choose(index)} />)}
      </Animated.ScrollView>
      <LinearGradient pointerEvents="none" colors={[c.bg, "transparent"]} style={{ position: "absolute", top: 0, width: "100%", height: 16 }} />
      <LinearGradient pointerEvents="none" colors={["transparent", c.bg]} style={{ position: "absolute", bottom: 0, width: "100%", height: 16 }} />
    </View>
  </View>;
}
