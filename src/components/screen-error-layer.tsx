import React, { useEffect, useState } from "react";
import { Linking, Platform, ScrollView, View, useWindowDimensions } from "react-native";
import { useIsFocused } from "expo-router/react-navigation";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInUp, FadeOutDown } from "react-native-reanimated";
import { useApp } from "@/state/app-state";
import { colors as c } from "@/theme";
import { useMotion } from "./motion";
import { Button, Card, Icon, T, Tap } from "./ui";

/** Lives inside each native screen, so a presented modal cannot cover its errors. */
export function ScreenErrorLayer({ children }: { children: React.ReactNode }) {
  const { error, clearError } = useApp();
  const focused = useIsFocused();
  const { reduced } = useMotion();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [settingsError, setSettingsError] = useState<string | null>(null);
  useEffect(() => setSettingsError(null), [error]);
  const permissionError = !!error && /permission|authorization/i.test(error);
  return <View testID="screen-error-layer" style={{ flex: 1 }}>
    {children}
    {focused && error && <Animated.View
      entering={reduced ? undefined : FadeInUp.duration(180)}
      exiting={reduced ? undefined : FadeOutDown.duration(140)}
      style={{ position: "absolute", left: 16, right: 16, bottom: Math.max(insets.bottom, 16) + 12, zIndex: 100 }}>
      <Card style={{ borderColor: c.danger, boxShadow: "0 8px 30px #00000066" }}>
        <ScrollView testID="screen-error-message" style={{ maxHeight: height * .55 }} contentContainerStyle={{ padding: 18, gap: 14 }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Icon name={permissionError ? "notifications-off-outline" : "information-circle-outline"} color={c.peach} size={22} />
            <T variant="label" style={{ flex: 1 }}>{permissionError ? "Alarm permission is off" : "Couldn’t complete that"}</T>
            <Tap onPress={clearError} label="Dismiss message"><Icon name="close" color={c.text} /></Tap>
          </View>
          <T accessibilityRole="alert" accessibilityLiveRegion="assertive">{error}</T>
          {permissionError && Platform.OS !== "web" && <Button title="Open device settings" icon="open-outline" onPress={() => {
            void Linking.openSettings().catch(() => setSettingsError("Open your device’s Settings and allow alarms for Refresh."));
          }} />}
          {settingsError && <T variant="small" style={{ color: c.peach }}>{settingsError}</T>}
        </ScrollView>
      </Card>
    </Animated.View>}
  </View>;
}
