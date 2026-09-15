import { requireOptionalNativeModule } from "expo";
export type AlarmKitBridge = {
  isSupported(): boolean;
  authorizationStatus(): string;
  requestAuthorization(): Promise<string>;
  schedule(input: {
    id: string;
    alarmId: string;
    hour: number;
    minute: number;
    days: number[];
    label: string;
    soundName?: string;
    timestamp?: number;
  }): Promise<void>;
  cancel(id: string): Promise<void>;
  stop(id: string): Promise<void>;
  consumePendingAlarm(): string | null;
  getAlarms(): Promise<{ id: string; state: string }[]>;
};
export default requireOptionalNativeModule<AlarmKitBridge>("DaybreakAlarmKit");
