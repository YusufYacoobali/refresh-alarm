import { requireOptionalNativeModule } from "expo";
export type AlarmKitBridge = {
  isSupported(): boolean;
  authorizationStatus(): string;
  requestAuthorization(): Promise<string>;
  prepareCustomSound(uri: string, id: string): Promise<string>;
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
  activeAlarm?(): string | null;
  beginAlarm?(alarmId: string): void;
  completeAlarm?(alarmId: string): void;
  addListener?(event: "onAlarmStateChange", listener: () => void): { remove(): void };
  getAlarms(): Promise<{ id: string; state: string }[]>;
};
export default requireOptionalNativeModule<AlarmKitBridge>("DaybreakAlarmKit");
