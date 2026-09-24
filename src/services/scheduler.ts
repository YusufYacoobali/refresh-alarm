import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Crypto from "expo-crypto";
import AlarmKit from "./alarm-kit";
import AndroidAlarm from "./android-alarm";
import { Alarm, Registration, nextOccurrence } from "@/utils/alarms";
import { soundFile, resolveSoundId, isCustomSound } from "@/utils/sounds";
import { customAudioSource } from "./custom-audio";

export const alarmKitAvailable = () =>
  Platform.OS === "ios" && !!AlarmKit?.isSupported();
export async function permissionStatus() {
  if (alarmKitAvailable()) return AlarmKit!.authorizationStatus();
  if (Platform.OS === "web") return "preview";
  if (Platform.OS === "android" && AndroidAlarm) {
    const p = AndroidAlarm.permissions();
    if (!p.exact) return "exact alarm permission needed";
    if (!p.fullScreen) return "lock-screen permission needed";
  }
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
          "Open your Refresh development build to manage this system alarm.",
        );
      await AlarmKit.cancel(id);
    }
    if (r.kind === "notifications")
      await Notifications.cancelScheduledNotificationAsync(id);
    if (r.kind === "android") {
      if (!AndroidAlarm) throw new Error("Rebuild Refresh to manage Android alarms.");
      await AndroidAlarm.cancel(id);
    }
  }
}
export async function scheduleAlarm(
  alarm: Alarm,
  at?: Date,
  reuse?: Registration,
): Promise<Registration> {
  if (Platform.OS === "ios" && Number.parseInt(String(Platform.Version), 10) >= 26 && !alarmKitAvailable())
    throw new Error("This iPhone needs an updated Refresh build with system alarm support. Your alarm has not been enabled.");
  const permission = await requestPermission();
  if (permission === "denied")
    throw new Error(
      "Alarm permission is off. Enable it in Settings, then try again. Your alarm has not been enabled.",
    );
  if (Platform.OS === "web") return { kind: "preview", ids: [] };
  if (alarm.appBlock?.enabled) {
    const bridge = Platform.OS === "ios" ? AlarmKit : AndroidAlarm;
    if ((alarm.appBlock.minutes ?? 5) !== 5 && bridge?.appBlockVersion?.() !== 2)
      throw new Error("Install the updated Refresh build to use selectable app-block durations.");
    if (!bridge?.appBlockStatus?.().authorized)
      throw new Error("Allow app-blocking access in this alarm’s settings, then save again.");
    if (Platform.OS === "ios" && !alarmKitAvailable())
      throw new Error("App blocking with system alarms requires iOS 26 or later.");
  }
  const imported = isCustomSound(alarm.sound) ? await customAudioSource(alarm.sound) : undefined;
  if (imported && Platform.OS === "ios" && !soundFile(alarm.sound)) throw new Error("Import this sound again to prepare its iOS alarm excerpt.");
  if (Platform.OS === "android") {
    if (!AndroidAlarm) throw new Error("Install the updated Refresh Android build to enable lock-screen alarms.");
    const access = AndroidAlarm.permissions();
    if (access.channel === false) {
      await AndroidAlarm.openSettings("channel");
      throw new Error("Enable Ringing alarms notifications and pop on screen in Settings, then return and save your alarm.");
    }
    if (!access.exact) {
      await AndroidAlarm.openSettings("exact");
      throw new Error("Enable the Alarms & reminders permission, then return and save your alarm.");
    }
    if (!access.fullScreen) {
      await AndroidAlarm.openSettings("fullScreen");
      throw new Error("Enable full-screen alarm permission, then return and save your alarm.");
    }
    const id = reuse?.kind === "android" ? reuse.ids[0] : Crypto.randomUUID();
    const sound = resolveSoundId(alarm.sound);
    const audio = sound === "adhan" || sound === "adhan_alafasy_fajr" ? `refresh_full_${sound}.wav` : soundFile(alarm.sound);
    await AndroidAlarm.schedule(JSON.stringify({ id, alarmId: alarm.id, hour: alarm.hour, minute: alarm.minute, days: at ? [] : alarm.days, label: alarm.label, soundName: audio, soundUri: imported?.uri, volume: alarm.volume, volumeRampSeconds: alarm.volumeRampSeconds ?? 0, missionReminder: true, appBlockMinutes: alarm.appBlock?.minutes ?? 5, appBlockSelection: alarm.appBlock?.enabled ? alarm.appBlock.selection : undefined, ...(at ? { timestamp: +at } : !alarm.days.length ? { timestamp: +nextOccurrence(alarm) } : {}) }));
    return { kind: "android", ids: [id] };
  }
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
      soundName: soundFile(alarm.sound),
      appBlockSelection: alarm.appBlock?.enabled ? alarm.appBlock.selection : undefined,
      appBlockMinutes: alarm.appBlock?.enabled ? alarm.appBlock.minutes ?? 5 : undefined,
      ...(at ? { timestamp: at.getTime() / 1000 } : {}),
    });
    return { kind: "alarmkit", ids: [id] };
  }
  const ids: string[] = [];
  const audioFile = soundFile(alarm.sound);
  const channelId = audioFile ? `alarm-${resolveSoundId(alarm.sound)}-v1` : "alarms";
  const content: Notifications.NotificationContentInput = {
    title: alarm.label,
    body: "Time to wake up.",
    sound: audioFile ?? "default",
    data: { alarmId: alarm.id },
    categoryIdentifier: "wake-up",
    // On older iOS versions, avoid treating a wake-up alert as routine content
    // eligible for Scheduled Summary. User notification settings still apply.
    ...(Platform.OS === "ios" ? { interruptionLevel: "timeSensitive" as const } : {}),
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
            channelId,
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
              channelId,
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
  if (Platform.OS === "android" && AndroidAlarm) await AndroidAlarm.stop(alarm.id);
  if (alarm.registration?.kind === "alarmkit" && AlarmKit) {
    const active = await AlarmKit.getAlarms();
    for (const id of alarm.registration.ids)
      if (active.some((a) => a.id === id && a.state === "alerting"))
        await AlarmKit.stop(id);
  }
  if (Platform.OS !== "web") await Notifications.dismissAllNotificationsAsync();
}
