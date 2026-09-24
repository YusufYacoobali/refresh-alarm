import { Platform } from "react-native";
import AlarmKit from "./alarm-kit";
import AndroidAlarm from "./android-alarm";

export type BlockSelection = { selection: string; count: number };
export type BlockStatus = { authorized: boolean; activeUntil: number };
export const blocker = Platform.OS === "ios" ? AlarmKit : Platform.OS === "android" ? AndroidAlarm : null;
export const appBlockingAvailable = () => blocker?.appBlockVersion?.() === 2;
export function appBlockStatus(): BlockStatus {
  return blocker?.appBlockStatus?.() ?? { authorized: false, activeUntil: 0 };
}
export async function requestAppBlockAccess() {
  if (!blocker?.requestAppBlockAccess) throw new Error("Install an updated Refresh build to use app blocking.");
  await blocker.requestAppBlockAccess();
}
export async function chooseIOSBlockedApps(selection?: string, group: "social" | "custom" = "custom") {
  if (!AlarmKit?.chooseBlockedApps) throw new Error("App selection is unavailable in this build.");
  return AlarmKit.chooseBlockedApps(selection ?? "", group);
}
export async function installedBlockableApps() {
  if (!AndroidAlarm?.blockableApps) throw new Error("App selection is unavailable in this build.");
  return AndroidAlarm.blockableApps();
}
