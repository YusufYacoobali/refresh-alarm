import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TextProps,
  ActivityIndicator,
  ColorValue,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Icon, IconName } from "./icon";
export { Icon, IconName } from "./icon";
import { haptic as playHaptic, HapticKind } from "@/services/haptics";
import Animated, {
  FadeInDown,
  FadeIn,
  FadeInUp,
  LinearTransition,
} from "react-native-reanimated";
import { easeOut, useMotion } from "./motion";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { colors as c, fonts, type, art } from "@/theme";

export function T({
  variant = "body",
  style,
  ...props
}: TextProps & { variant?: keyof typeof type }) {
  return <Text {...props} style={[{ color: c.text }, type[variant], style]} />;
}
export function Tap({
  children,
  onPress,
  style,
  label,
  disabled,
  selected,
  haptic = true,
}: {
  children: React.ReactNode;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  label?: string;
  disabled?: boolean;
  selected?: boolean;
  haptic?: boolean | HapticKind;
}) {
  const [pressed, setPressed] = useState(false);
  const { reduced } = useMotion();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, selected }}
      aria-disabled={!!disabled}
      aria-pressed={selected}
      disabled={disabled}
      hitSlop={4}
      pressRetentionOffset={16}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={() => {
        if (haptic) playHaptic(haptic === true ? "selection" : haptic);
        onPress();
      }}
      style={style}
    >
      <Animated.View
        style={{
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
          transform: [{ translateY: pressed && !reduced ? 1 : 0 }, { scale: reduced ? 1 : pressed ? 0.96 : selected ? 1.015 : 1 }],
          transitionProperty: ["transform", "opacity"],
          transitionDuration: reduced ? 0 : 120,
          transitionTimingFunction: easeOut,
        }}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}
export function Button({
  title,
  onPress,
  secondary = false,
  loading = false,
  haptic = "light",
  icon,
  style,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  loading?: boolean;
  haptic?: false | HapticKind;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Tap onPress={onPress} label={title} disabled={loading} style={style} haptic={haptic}>
      <LinearGradient
        colors={secondary ? ["#CEC2FF", "#A997EB"] : ["#FFE4CC", "#F4C8A9"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.button}
      >
        {loading ? (
          <ActivityIndicator color={c.ink} />
        ) : (
          <>
            <T variant="label" style={{ color: c.ink }}>
              {title}
            </T>
            {icon && <Icon name={icon} color={c.ink} size={19} />}
          </>
        )}
      </LinearGradient>
    </Tap>
  );
}
export function CircleButton({
  icon,
  onPress,
  label,
}: {
  icon: IconName;
  onPress(): void;
  label: string;
}) {
  return (
    <Tap onPress={onPress} label={label}>
      <View style={s.circle}>
        <Icon name={icon} />
      </View>
    </Tap>
  );
}
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { reduced } = useMotion();
  return <Animated.View entering={reduced ? undefined : FadeIn.duration(220)} layout={reduced ? undefined : LinearTransition.duration(220)} style={[s.card, style, { transitionProperty: ["backgroundColor", "borderColor", "opacity"], transitionDuration: reduced ? 0 : 180 }]}>{children}</Animated.View>;
}
export function Row({
  icon,
  title,
  value,
  onPress,
  last = false,
  children,
}: {
  icon: IconName;
  title: string;
  value?: string;
  onPress?: () => void;
  last?: boolean;
  children?: React.ReactNode;
}) {
  const { reduced } = useMotion();
  const content = (
    <View
      style={[
        s.row,
        !last && { borderBottomWidth: 1, borderBottomColor: "#FFFFFF09" },
      ]}
    >
      <Icon name={icon} size={20} />
      <T variant="label" style={{ flex: 1 }}>
        {title}
      </T>
      {children ?? (
        <>
          <Animated.View key={value} entering={reduced ? undefined : FadeInUp.duration(180)} style={{ maxWidth: "43%" }}><T
            variant="small"
            style={{ color: c.muted, textAlign: "right" }}
          >
            {value}
          </T></Animated.View>
          {onPress && <Icon name="chevron-forward" size={15} color={c.faint} />}
        </>
      )}
    </View>
  );
  return onPress ? <Tap onPress={onPress}>{content}</Tap> : content;
}
export function Screen({
  children,
  style,
  scroll = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  scroll?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { reduced } = useMotion();
  return scroll ? (
    <Animated.ScrollView
      entering={reduced ? undefined : FadeIn.duration(220)}
      style={{ flex: 1, backgroundColor: c.bg }}
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        s.screen,
        { paddingBottom: Math.max(insets.bottom, 24) + 16 },
        style,
      ]}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </Animated.ScrollView>
  ) : (
    <View
      style={[
        s.screen,
        { flex: 1, paddingBottom: Math.max(insets.bottom, 24) },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function Heading({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View style={{ flex: 1 }}>
        <T variant="title">{title}</T>
        {subtitle && <T style={{ color: c.muted, marginTop: 6 }}>{subtitle}</T>}
      </View>
      {right}
    </View>
  );
}
export function Chip({
  title,
  active,
  onPress,
}: {
  title: string;
  active: boolean;
  onPress(): void;
}) {
  return (
    <Tap onPress={onPress} selected={active} style={{ flex: 1 }}>
      <Animated.View style={[s.chip, active && { backgroundColor: c.peach }, { transitionProperty: "backgroundColor", transitionDuration: 180 }]}>
        <T variant="small" style={{ color: active ? c.ink : c.muted }}>
          {title}
        </T>
      </Animated.View>
    </Tap>
  );
}
export function Enter({
  children,
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { reduced } = useMotion();
  return (
    <Animated.View
      entering={reduced ? undefined : FadeInDown.duration(280).delay(delay)}
      layout={reduced ? undefined : LinearTransition.duration(240)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}
export function SoundArt({
  tile,
  style,
}: {
  tile: number;
  style?: StyleProp<ViewStyle>;
}) {
  const [width, setWidth] = useState(0);
  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[{ overflow: "hidden", aspectRatio: 1 }, style]}
    >
      {width > 0 && (
        <Image
          source={art.sounds}
          accessibilityIgnoresInvertColors
          style={{
            position: "absolute",
            width: width * 2,
            height: width * 3,
            left: -(tile % 2) * width,
            top: -Math.floor(tile / 2) * width,
          }}
          contentFit="fill"
        />
      )}
    </View>
  );
}
export function Quote({
  text = "Your morning deserves more than another snooze.",
}: {
  text?: string;
}) {
  return (
    <Card
      style={{
        flexDirection: "row",
        gap: 12,
        alignItems: "center",
        padding: 20,
      }}
    >
      <Icon name="sparkles-outline" size={22} color={c.peach} />
      <T style={{ color: c.muted, flex: 1, fontSize: 13, lineHeight: 21 }}>
        {text}
      </T>
    </Card>
  );
}
export function BackHome() {
  return (
    <Button
      title="Back to home"
      onPress={() => router.replace("/(tabs)/alarms")}
      icon="arrow-forward"
    />
  );
}
const s = StyleSheet.create({
  screen: { padding: 24, gap: 24, backgroundColor: c.bg },
  card: {
    backgroundColor: c.surface,
    borderRadius: 24,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "#FFFFFF0C",
    overflow: "hidden",
  },
  button: {
    minHeight: 56,
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 12,
    boxShadow: "0 4px 24px #F8CEAF18",
  },
  circle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: c.raised,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FFFFFF0E",
  },
  row: {
    minHeight: 62,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  chip: {
    minHeight: 40,
    borderRadius: 22,
    backgroundColor: c.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
});
