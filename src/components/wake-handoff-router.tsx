import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import { router, useGlobalSearchParams, usePathname, useRootNavigationState } from "expo-router";
import * as Notifications from "expo-notifications";
import { Button, T } from "./ui";
import AlarmKit from "@/services/alarm-kit";
import { acknowledgeWakeup, logWakeHandoff, readNativeWakeups } from "@/services/wake-handoff";
import { WakeHandoffCoordinator, type WakeCandidate, type WakeRoutingData, type WakeRoutingStatus, type WakeRoute } from "@/utils/wake-handoff";

const Context = createContext<{ status: WakeRoutingStatus; retry(): void } | null>(null);
export const WakeHandoffContext = Context;
export function useWakeHandoff() {
  const value = useContext(Context);
  if (!value) throw new Error("Wake handoff routing is required.");
  return value;
}
/** Used on the boot route and in each focused native screen's error layer. */
export function WakeHandoffError() {
  const { retry } = useWakeHandoff();
  return <>
    <T variant="label" accessibilityRole="header">Your wake-up is waiting</T>
    <T accessibilityRole="alert" accessibilityLiveRegion="assertive">We couldn’t open your wake-up screen. Your pending alarm is kept.</T>
    <Button title="Open wake-up screen" onPress={retry} />
  </>;
}
export function useWakeHandoffRouter(data: WakeRoutingData, ready: boolean) {
  const pathname = usePathname();
  const params = useGlobalSearchParams<{ id?: string; eventId?: string; sessionId?: string; preview?: string; reminder?: string }>();
  const navigation = useRootNavigationState();
  const route: WakeRoute = { pathname, ...params };
  const snapshot = useRef({ data, ready, active: true, foreground: true, navigationReady: false, route });
  snapshot.current = { data, ready, route, active: Platform.OS !== "ios" || AppState.currentState === "active",
    foreground: AppState.currentState === "active", navigationReady: !!navigation?.key };
  const [status, setStatus] = useState<WakeRoutingStatus>({ state: "checking" });
  const fallback = useRef(new Map<string, WakeCandidate>());
  const coordinator = useRef<WakeHandoffCoordinator | null>(null);
  if (!coordinator.current) coordinator.current = new WakeHandoffCoordinator({
    snapshot: () => snapshot.current,
    read: async state => [...await readNativeWakeups(state), ...fallback.current.values()],
    acknowledge: acknowledgeWakeup,
    navigate: (target, replace) => {
      const destination = { pathname: "/ringing" as const, params: { id: target.id, eventId: target.eventId, sessionId: target.sessionId, reminder: target.reminder } };
      // Queued/retried actions for this exact occurrence share one screen. A
      // late commit from an earlier request cannot add a second ringing route.
      const options = { dangerouslySingular: (name: string, params: Record<string, unknown>) => JSON.stringify([name, params.id, params.sessionId, params.eventId]) };
      if (replace) router.replace(destination, options); else router.push(destination, options);
    },
    status: value => setStatus(previous => previous.state === value.state && previous.reason === value.reason &&
      previous.target?.id === value.target?.id && previous.target?.eventId === value.target?.eventId && previous.target?.sessionId === value.target?.sessionId ? previous : value),
    log: logWakeHandoff,
  });
  useEffect(() => { void coordinator.current!.check("route"); }, [ready, pathname, params.id, params.eventId, params.sessionId, params.preview, params.reminder, navigation?.key, data]);
  useEffect(() => {
    snapshot.current.ready = ready;
    if (!ready) return;
    let disposed = false;
    logWakeHandoff("app.js.ready", "", Platform.OS);
    const check = (reason: "native" | "resume" | "tick") => { if (!disposed) void coordinator.current!.check(reason); };
    const native = AlarmKit?.addListener?.("onAlarmStateChange", () => check("native"));
    const app = AppState.addEventListener("change", state => {
      snapshot.current.active = Platform.OS !== "ios" || state === "active";
      snapshot.current.foreground = state === "active";
      coordinator.current!.observe();
      if (state === "active") { logWakeHandoff("app.js.resume"); check("resume"); }
    });
    const tick = setInterval(() => {
      coordinator.current!.observe();
      if (AppState.currentState && AppState.currentState !== "active") return;
      const state = snapshot.current.data, now = new Date();
      AlarmKit?.appBlockStatus?.();
      // Only notification/web fallbacks use a clock check. AlarmKit routing
      // requires native Stop/alerting evidence, including for a snooze delivery.
      for (const alarm of state.alarms) {
        if (alarm.enabled && (alarm.nextAt ?? 0) <= +now &&
            (alarm.days.length > 0 || +now - (alarm.nextAt ?? +now) < 60000) &&
            alarm.registration?.kind !== "alarmkit" && alarm.registration?.kind !== "android" &&
            alarm.hour === now.getHours() && alarm.minute === now.getMinutes() &&
            (!alarm.days.length || alarm.days.includes(now.getDay()))) {
          const key = `${alarm.id}-${Math.floor(+now / 60000)}`;
          fallback.current.set(key, { id: alarm.id, eventId: key, sessionId: key, createdAt: +now, durable: false });
        }
      }
      const snoozed = state.snoozed;
      if (snoozed && !["android", "alarmkit"].includes(snoozed.registration.kind) && +now >= snoozed.at && +now - snoozed.at < 60000) {
        const key = `snooze-${snoozed.at}`;
        fallback.current.set(key, { id: snoozed.alarmId, eventId: key, sessionId: snoozed.sessionId ?? key, kind: "snooze", createdAt: snoozed.at, durable: false });
      }
      check("tick");
    }, 1000);
    if (Platform.OS === "web") return () => { disposed = true; snapshot.current.ready = false; coordinator.current!.dispose(); clearInterval(tick); app.remove(); native?.remove(); };
    const notification = (id: unknown, eventId: string) => {
      if (typeof id !== "string") return;
      fallback.current.set(eventId, { id, eventId, sessionId: eventId, createdAt: Date.now(), durable: false });
      check("native");
    };
    const receive = Notifications.addNotificationReceivedListener(n => notification(n.request.content.data?.alarmId, `${n.request.identifier}:${Math.floor(Date.now() / 60000)}`));
    const respond = Notifications.addNotificationResponseReceivedListener(r => {
      notification(r.notification.request.content.data?.alarmId, `${r.notification.request.identifier}:${Math.floor(Date.now() / 60000)}`);
      void Notifications.clearLastNotificationResponseAsync();
    });
    void Notifications.getLastNotificationResponseAsync().then(r => {
      if (disposed || !r) return;
      notification(r.notification.request.content.data?.alarmId, `${r.notification.request.identifier}:${Math.floor(Date.now() / 60000)}`);
      void Notifications.clearLastNotificationResponseAsync();
    }).catch(() => logWakeHandoff("notification.read.failed"));
    return () => { disposed = true; snapshot.current.ready = false; coordinator.current!.dispose(); clearInterval(tick); app.remove(); native?.remove(); receive.remove(); respond.remove(); };
  }, [ready]);
  return { status, retry: () => { void coordinator.current!.check("retry"); } };
}
