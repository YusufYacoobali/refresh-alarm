import React, { useEffect, useRef } from "react";
import { View, Platform, AppState, StyleSheet } from "react-native";
import { Stack, router, usePathname, useGlobalSearchParams } from "expo-router";
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
import AlarmKit from "@/services/alarm-kit";
import AndroidAlarm from "@/services/android-alarm";
import { readMissionTimeout, cancelMissionTimeout } from "@/services/mission-timeout";
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
  const snapshot = useRef(data),
    seen = useRef(new Set<string>()),
    displayed = useRef<string | null>(null);
  const pathname = usePathname();
  const params = useGlobalSearchParams<{ id?: string; eventId?: string; preview?: string }>();
  const route = useRef({ pathname, ...params });
  route.current = { pathname, ...params };
  useEffect(() => {
    if (pathname !== "/ringing" && pathname !== "/challenge")
      displayed.current = null;
  }, [pathname]);
  useEffect(() => {
    snapshot.current = data;
  }, [data]);
  useEffect(() => {
    if (!ready) return;
    let disposed = false;
    let checking = false;
    const open = (id: string, eventId: string, force = false, restart = false) => {
      if (disposed) return;
      if (!snapshot.current.alarms.some((a) => a.id === id)) return;
      const current = route.current;
      const wakeScreen = current.pathname === "/ringing" || current.pathname === "/challenge";
      if (wakeScreen && current.id === id && current.preview !== "1" &&
          (!AndroidAlarm || current.eventId === eventId) && (!restart || current.pathname === "/ringing")) {
        if (AlarmKit?.isSupported()) AlarmKit.beginAlarm?.(id);
        displayed.current = eventId;
        return;
      }
      if (
        !force && (displayed.current === eventId ||
        (seen.current.has(eventId) && !AndroidAlarm))
      )
        return;
      // The index route owns cold-start redirection, avoiding a competing push.
      if (AndroidAlarm && current.pathname === "/") return;
      if (AlarmKit?.isSupported()) AlarmKit.beginAlarm?.(id);
      displayed.current = eventId;
      seen.current.add(eventId);
      const target = { pathname: "/ringing" as const, params: { id, eventId, ...(restart ? { reminder: "1" } : {}) } };
      if (wakeScreen) router.replace(target); else router.push(target);
    };
    const readNative = async () => {
      // Let the index redirect finish before consuming a cold-launch intent.
      if (route.current.pathname === "/") return;
      if (AndroidAlarm) {
        const active = AndroidAlarm.activeAlarm();
        if (active) open(active.alarmId, active.eventId);
      }
      if (!AlarmKit?.isSupported()) return;
      const pending = AlarmKit.activeAlarm ? AlarmKit.activeAlarm() : AlarmKit.consumePendingAlarm();
      if (pending)
        open(pending, `${pending}:active`, true);
      const reminder = await readMissionTimeout().catch(() => null);
      if (reminder && reminder.deadline <= Date.now()) {
        await cancelMissionTimeout(reminder.token).catch(() => {});
        open(reminder.alarmId, `${reminder.alarmId}:reminder:${reminder.deadline}`, true, true);
      }
      const active = await AlarmKit.getAlarms();
      for (const system of active.filter((a) => a.state === "alerting")) {
        const alarm = snapshot.current.alarms.find((a) =>
          a.registration?.ids.includes(system.id),
        );
        const snoozed = snapshot.current.snoozed;
        const id =
          alarm?.id ??
          (snoozed?.registration.ids.includes(system.id)
            ? snoozed.alarmId
            : undefined);
        if (id) open(id, `${id}:active`, true);
      }
    };
    const checkNative = async () => {
      if (disposed || checking) return;
      checking = true;
      try { await readNative(); } finally { checking = false; }
    };
    void checkNative().catch(() => {});
    const nativeSub = AlarmKit?.addListener?.("onAlarmStateChange", () => { void checkNative().catch(() => {}); });
    const appSub = AppState.addEventListener("change", (state) => {
      if (state === "active") void checkNative().catch(() => {});
    });
    const tick = setInterval(() => {
      if (AppState.currentState && AppState.currentState !== "active") return;
      const now = new Date();
      const state = snapshot.current;
      for (const alarm of state.alarms)
        if (
          alarm.enabled &&
          (alarm.nextAt ?? 0) <= +now &&
          (alarm.days.length > 0 || +now - (alarm.nextAt ?? +now) < 60000) &&
          alarm.registration?.kind !== "alarmkit" &&
          alarm.registration?.kind !== "android" &&
          alarm.hour === now.getHours() &&
          alarm.minute === now.getMinutes() &&
          (!alarm.days.length || alarm.days.includes(now.getDay()))
        )
          open(alarm.id, `${alarm.id}-${Math.floor(+now / 60000)}`);
      if (
        state.snoozed &&
        state.snoozed.registration.kind !== "android" &&
        +now >= state.snoozed.at &&
        +now - state.snoozed.at < 60000
      )
        open(state.snoozed.alarmId, `snooze-${state.snoozed.at}`);
      if (AndroidAlarm || AlarmKit?.isSupported())
        void checkNative().catch(() => {});
    }, 1000);
    if (Platform.OS === "web")
      return () => {
        disposed = true;
        clearInterval(tick);
        appSub.remove();
        nativeSub?.remove();
      };
    const receive = Notifications.addNotificationReceivedListener((n) => {
      const id = n.request.content.data?.alarmId;
      if (typeof id === "string")
        open(id, `${id}-${Math.floor(Date.now() / 60000)}`);
    });
    const respond = Notifications.addNotificationResponseReceivedListener(
      (r) => {
        const id = r.notification.request.content.data?.alarmId;
        if (typeof id === "string") open(id, r.notification.request.identifier);
        void Notifications.clearLastNotificationResponseAsync();
      },
    );
    void Notifications.getLastNotificationResponseAsync().then((r) => {
      const id = r?.notification.request.content.data?.alarmId;
      if (typeof id === "string") open(id, r!.notification.request.identifier);
      if (r) void Notifications.clearLastNotificationResponseAsync();
    });
    return () => {
      disposed = true;
      clearInterval(tick);
      appSub.remove();
      nativeSub?.remove();
      receive.remove();
      respond.remove();
    };
  }, [ready, pathname]);
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
    <>
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
    </>
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
