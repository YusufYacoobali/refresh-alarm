import React from "react";
import { View, Platform, StyleSheet } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useFonts } from "expo-font";
import { Nunito_400Regular } from "@expo-google-fonts/nunito/400Regular";
import { Nunito_600SemiBold } from "@expo-google-fonts/nunito/600SemiBold";
import { Nunito_700Bold } from "@expo-google-fonts/nunito/700Bold";
import { Nunito_800ExtraBold } from "@expo-google-fonts/nunito/800ExtraBold";
import * as Notifications from "expo-notifications";
import { AppProvider, useApp } from "@/state/app-state";
import { colors as c, fonts } from "@/theme";
import { T, Button } from "@/components/ui";
import { WakeHandoffContext, useWakeHandoffRouter } from "@/components/wake-handoff-router";
import { MotionProvider, useMotion } from "@/components/motion";
import { ScreenErrorLayer } from "@/components/screen-error-layer";

const screenLayout = ({ children }: { children: React.ReactNode }) => (
  <ScreenErrorLayer>{children}</ScreenErrorLayer>
);

if (Platform.OS !== "web")
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

function AppContent() {
  const { reduced } = useMotion();
  const { data, ready, error, retry } = useApp();
  const handoff = useWakeHandoffRouter(data, ready);
  if (!ready)
    return (
      <View style={styles.loading}>
        <T variant="heading">Refresh</T>
        {error && (
          <>
            <T>{error}</T>
            <Button title="Retry loading" onPress={retry} />
          </>
        )}
      </View>
    );
  return (
    <WakeHandoffContext.Provider value={handoff}>
      <Stack
        screenLayout={screenLayout}
        screenOptions={{
          headerStyle: { backgroundColor: c.bg },
          headerTintColor: c.text,
          headerTitleStyle: { fontFamily: fonts.bold, fontSize: 17 },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: "minimal",
          contentStyle: { backgroundColor: c.bg },
          animation: reduced ? "fade" : "default",
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen
          name="onboarding"
          options={{ headerShown: false, gestureEnabled: false }}
        />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="alarm"
          options={{ title: "Set alarm", presentation: "modal" }}
        />
        <Stack.Screen name="sounds" options={{ title: "Sounds" }} />
        <Stack.Screen
          name="challenges"
          options={{ title: "Wake up your way" }}
        />
        <Stack.Screen name="themes" options={{ title: "Your little world" }} />
        <Stack.Screen
          name="settings"
          options={{ title: "Make yourself at home" }}
        />
        <Stack.Screen
          name="ringing"
          options={{
            headerShown: false,
            gestureEnabled: false,
            presentation: "fullScreenModal",
            animation: "none",
          }}
        />
        <Stack.Screen
          name="challenge"
          options={{
            headerShown: false,
            gestureEnabled: false,
            presentation: "fullScreenModal",
            animation: "none",
          }}
        />
        <Stack.Screen
          name="success"
          options={{ headerShown: false, gestureEnabled: false }}
        />
      </Stack>
    </WakeHandoffContext.Provider>
  );
}
export default function Layout() {
  const [loaded, fontError] = useFonts({
    AmiriQuran: require("../../assets/fonts/AmiriQuran-Regular.ttf"),
    NunitoRegular: Nunito_400Regular,
    NunitoSemiBold: Nunito_600SemiBold,
    NunitoBold: Nunito_700Bold,
    NunitoExtraBold: Nunito_800ExtraBold,
  });
  if (!loaded && !fontError) return <View style={styles.loading} />;
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#060811" }}>
      <SafeAreaProvider>
        <View style={styles.frame}>
          <StatusBar style="light" />
          <MotionProvider><AppProvider>
            <AppContent />
          </AppProvider></MotionProvider>
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
const styles = StyleSheet.create({
  frame: {
    flex: 1,
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    backgroundColor: c.bg,
    overflow: "hidden",
  },
  loading: {
    flex: 1,
    backgroundColor: c.bg,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 20,
  },
});
