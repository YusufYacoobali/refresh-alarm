import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Crypto from "expo-crypto";
import AlarmKit from "./alarm-kit";
import { Alarm, Registration, nextOccurrence } from "@/utils/alarms";

export const alarmKitAvailable = () =>
  Platform.OS === "ios" && !!AlarmKit?.isSupported();
export async function permissionStatus() {
  if (alarmKitAvailable()) return AlarmKit!.authorizationStatus();
  if (Platform.OS === "web") return "preview";
  const result = await Notifications.getPermissionsAsync();
  return result.granted
    ? "authorized"
    : result.status === "denied"
      ? "denied"
      : "notDetermined";
}
export async function requestPermission() {
  if (alarmKitAvailable()) return AlarmKit!.requestAuthorization();
  if (Platform.OS === "web") return "preview";
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("alarms", {
      name: "Wake-up alarms",
      importance: Notifications.AndroidImportance.MAX,
      sound: "default",
      vibrationPattern: [0, 500, 250, 500],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  const p = await Notifications.requestPermissionsAsync();
  return p.granted ? "authorized" : "denied";
}
export async function cancelRegistration(r?: Registration) {
  if (!r) return;
  for (const id of r.ids) {
    if (r.kind === "alarmkit") {
      if (!AlarmKit)
        throw new Error(
          "Open your Daybreak development build to manage this system alarm.",
        );
      await AlarmKit.cancel(id);
    }
    if (r.kind === "notifications")
      await Notifications.cancelScheduledNotificationAsync(id);
  }
}
export async function scheduleAlarm(
  alarm: Alarm,
  at?: Date,
  reuse?: Registration,
): Promise<Registration> {
  const permission = await requestPermission();
  if (permission === "denied")
    throw new Error(
      "Alarm permission is off. Enable it in Settings, then try again. Your alarm has not been enabled.",
    );
  if (Platform.OS === "web") return { kind: "preview", ids: [] };
  if (alarmKitAvailable()) {
    const id = reuse?.kind === "alarmkit" ? reuse.ids[0] : Crypto.randomUUID();
    if (
      reuse?.kind === "alarmkit" &&
      (await AlarmKit!.getAlarms()).some((a) => a.id === id)
    )
      return reuse;
    await AlarmKit!.schedule({
      id,
      alarmId: alarm.id,
      hour: alarm.hour,
      minute: alarm.minute,
      days: alarm.days,
      label: alarm.label,
      ...(at ? { timestamp: at.getTime() / 1000 } : {}),
    });
    return { kind: "alarmkit", ids: [id] };
  }
  const ids: string[] = [];
  const content: Notifications.NotificationContentInput = {
    title: alarm.label,
    body: "Your day is waiting. Open Daybreak to wake up your way.",
    sound: "default",
    data: { alarmId: alarm.id },
    categoryIdentifier: "wake-up",
  };
  try {
    if (at || !alarm.days.length)
      ids.push(
        await Notifications.scheduleNotificationAsync({
          identifier:
            reuse?.kind === "notifications" ? reuse.ids[0] : undefined,
          content,
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: at ?? nextOccurrence(alarm),
            channelId: "alarms",
          },
        }),
      );
    else
      for (const day of alarm.days)
        ids.push(
          await Notifications.scheduleNotificationAsync({
            identifier:
              reuse?.kind === "notifications"
                ? reuse.ids[ids.length]
                : undefined,
            content,
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
              weekday: day + 1,
              hour: alarm.hour,
              minute: alarm.minute,
              channelId: "alarms",
            },
          }),
        );
    return { kind: "notifications", ids };
  } catch (error) {
    await Promise.allSettled(
      ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)),
    );
    throw error;
  }
}
export async function stopAlarm(alarm: Alarm) {
  if (alarm.registration?.kind === "alarmkit" && AlarmKit) {
    const active = await AlarmKit.getAlarms();
    for (const id of alarm.registration.ids)
      if (active.some((a) => a.id === id && a.state === "alerting"))
        await AlarmKit.stop(id);
  }
  if (Platform.OS !== "web") await Notifications.dismissAllNotificationsAsync();
}
