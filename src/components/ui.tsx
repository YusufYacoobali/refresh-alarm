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
import * as Haptics from "expo-haptics";
import Animated, {
  FadeInDown,
  useReducedMotion,
} from "react-native-reanimated";
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
}: {
  children: React.ReactNode;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  label?: string;
  disabled?: boolean;
  selected?: boolean;
}) {
  const [pressed, setPressed] = useState(false);
  const reduced = useReducedMotion();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, selected }}
      disabled={disabled}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={() => {
        void Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={style}
    >
      <Animated.View
        style={{
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed && !reduced ? 0.975 : 1 }],
          transitionProperty: ["transform", "opacity"],
          transitionDuration: reduced ? 0 : 120,
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
  icon,
  style,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  loading?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Tap onPress={onPress} label={title} disabled={loading} style={style}>
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
  return <View style={[s.card, style]}>{children}</View>;
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
          <T
            variant="small"
            style={{ color: c.muted, maxWidth: "43%", textAlign: "right" }}
          >
            {value}
          </T>
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
  return scroll ? (
    <ScrollView
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
    </ScrollView>
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
      <View style={[s.chip, active && { backgroundColor: c.peach }]}>
        <T variant="small" style={{ color: active ? c.ink : c.muted }}>
          {title}
        </T>
      </View>
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
  const reduced = useReducedMotion();
  return (
    <Animated.View
      entering={reduced ? undefined : FadeInDown.duration(280).delay(delay)}
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
  text = "A calm mind makes a brighter tomorrow.",
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
      onPress={() => router.replace("/(tabs)")}
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
