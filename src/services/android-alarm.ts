import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

type AndroidAlarmBridge = {
  permissions(): { exact: boolean; fullScreen: boolean; notifications: boolean; channel: boolean };
  openSettings(kind: "exact" | "fullScreen" | "channel"): Promise<void>;
  schedule(json: string): Promise<void>;
  cancel(id: string): Promise<void>;
  activeAlarm(): { alarmId: string; eventId: string } | null;
  stop(alarmId: string): Promise<void>;
  setMissionSilenced(eventId: string, silent: boolean): Promise<void>;
};
export default Platform.OS === "android" ? requireOptionalNativeModule<AndroidAlarmBridge>("RefreshAlarm") : null;
