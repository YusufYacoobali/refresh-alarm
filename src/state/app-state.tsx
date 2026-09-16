import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { AppState, Platform } from "react-native";
import AlarmKit from "@/services/alarm-kit";
import AndroidAlarm from "@/services/android-alarm";
import { CustomSound, setCustomSounds } from "@/utils/sounds";
import {
  Alarm,
  Registration,
  validateAlarm,
  nextOccurrence,
} from "@/utils/alarms";
import {
  cancelRegistration,
  scheduleAlarm,
  stopAlarm,
} from "@/services/scheduler";

type JournalEntry = { date: string; mood: string; note: string };
type Data = {
  version: 1;
  onboarded: boolean;
  alarms: Alarm[];
  theme: "serene" | "moonlight" | "ocean";
  journal: JournalEntry[];
  completions: string[];
  customSounds?: CustomSound[];
  snoozed?: { alarmId: string; at: number; registration: Registration };
};
const initial: Data = {
  version: 1,
  onboarded: false,
  alarms: [],
  theme: "serene",
  journal: [],
  completions: [],
};
const KEY = "daybreak.state.v1";
export function newAlarm(): Alarm {
  return {
    id: Crypto.randomUUID(),
    hour: 7,
    minute: 0,
    days: [1, 2, 3, 4, 5],
    label: "Rise & shine",
    enabled: true,
    sound: "lofi",
    volume: 0.8,
    volumeRampSeconds: 30,
    missionReminder: true,
    challenge: "none",
    missions: [],
    difficulty: "gentle",
    snooze: 5,
  };
}
type Context = {
  data: Data;
  ready: boolean;
  busy: boolean;
  error: string | null;
  clearError(): void;
  retry(): void;
  draft: Alarm | null;
  edit(alarm?: Alarm): void;
  updateDraft(patch: Partial<Alarm>): void;
  saveAlarm(alarm: Alarm): Promise<void>;
  deleteAlarm(alarm: Alarm): Promise<void>;
  update(patch: Partial<Data>): Promise<void>;
  addCustomSound(sound: CustomSound): Promise<void>;
  finish(alarm: Alarm): Promise<void>;
  snooze(alarm: Alarm): Promise<void>;
};
const Ctx = createContext<Context | null>(null);
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState(initial),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [draft, setDraft] = useState<Alarm | null>(null);
  const current = useRef(data),
    locked = useRef(false);
  const hydrate = async () => {
    setError(null);
    try {
      const stored = await AsyncStorage.getItem(KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Data;
        if (
          parsed.version !== 1 ||
          !Array.isArray(parsed.alarms) ||
          !Array.isArray(parsed.journal) ||
          !Array.isArray(parsed.completions) ||
          !["serene", "moonlight", "ocean"].includes(parsed.theme)
        )
          throw new Error("Saved data could not be read.");
        parsed.alarms.forEach(validateAlarm);
        if (parsed.customSounds && !Array.isArray(parsed.customSounds)) throw new Error("Saved sounds could not be read.");
        setCustomSounds(parsed.customSounds ?? []);
        current.current = parsed;
        setData(parsed);
      }
      setReady(true);
    } catch {
      setError(
        "We couldn’t load your saved alarms. Retry to keep your data safe.",
      );
    }
  };
  useEffect(() => {
    void hydrate();
  }, []);
  async function persist(next: Data) {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    setCustomSounds(next.customSounds ?? []);
    current.current = next;
    setData(next);
  }
  useEffect(() => {
    if (!ready) return;
    const reconcile = async () => {
      if (locked.current) return;
      const before = current.current;
      const system = AlarmKit?.isSupported()
        ? await AlarmKit.getAlarms()
        : null;
      if (locked.current || current.current !== before) return;
      const alarms = before.alarms.map((alarm) => {
        if (
          !alarm.enabled ||
          alarm.days.length ||
          before.snoozed?.alarmId === alarm.id
        )
          return alarm;
        const missingNative =
          alarm.registration?.kind === "alarmkit" &&
          system &&
          !system.some((s) => alarm.registration!.ids.includes(s.id));
        const expiredFallback =
          alarm.registration?.kind !== "alarmkit" &&
          alarm.registration?.kind !== "android" &&
          !!alarm.nextAt &&
          Date.now() > alarm.nextAt + 60000;
        return missingNative || expiredFallback
          ? { ...alarm, enabled: false, registration: undefined }
          : alarm;
      });
      if (alarms.some((a, i) => a !== before.alarms[i])) {
        locked.current = true;
        try {
          await persist({ ...before, alarms });
        } finally {
          locked.current = false;
        }
      }
    };
    const run = () => void reconcile().catch(() => {});
    const timer = setInterval(run, 30000);
    const initialCheck = setTimeout(run, 2000);
    const listener = AppState.addEventListener("change", (s) => {
      if (s === "active") run();
    });
    return () => {
      clearInterval(timer);
      clearTimeout(initialCheck);
      listener.remove();
    };
  }, [ready]);
  async function transaction(fn: () => Promise<void>) {
    if (locked.current)
      throw new Error(
        "An alarm change is already in progress. Please try again.",
      );
    locked.current = true;
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : "Something went wrong. Please try again.";
      setError(message);
      throw e;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  const update = (patch: Partial<Data>) =>
    transaction(() => persist({ ...current.current, ...patch }));
  const saveAlarm = (alarm: Alarm) =>
    transaction(async () => {
      validateAlarm(alarm);
      const old = current.current.alarms.find((a) => a.id === alarm.id);
      const registration = alarm.enabled
        ? await scheduleAlarm(alarm)
        : undefined;
      const next = {
        ...alarm,
        label: alarm.label.trim(),
        registration,
        nextAt: alarm.enabled ? +nextOccurrence(alarm) : undefined,
      };
      const snoozed = current.current.snoozed;
      try {
        await cancelRegistration(old?.registration);
        if (snoozed?.alarmId === alarm.id)
          await cancelRegistration(snoozed.registration);
      } catch (e) {
        await cancelRegistration(registration);
        throw e;
      }
      try {
        await persist({
          ...current.current,
          snoozed: snoozed?.alarmId === alarm.id ? undefined : snoozed,
          alarms: old
            ? current.current.alarms.map((a) => (a.id === alarm.id ? next : a))
            : [...current.current.alarms, next],
        });
      } catch (e) {
        await cancelRegistration(registration);
        if (old?.enabled) {
          // Reuse the persisted system IDs: a full disk must not orphan restored alarms.
          await scheduleAlarm(old, undefined, old.registration);
        }
        throw e;
      }
    });
  const deleteAlarm = (alarm: Alarm) =>
    transaction(async () => {
      await cancelRegistration(alarm.registration);
      if (current.current.snoozed?.alarmId === alarm.id)
        await cancelRegistration(current.current.snoozed.registration);
      try {
        await persist({
          ...current.current,
          alarms: current.current.alarms.filter((a) => a.id !== alarm.id),
          snoozed:
            current.current.snoozed?.alarmId === alarm.id
              ? undefined
              : current.current.snoozed,
        });
      } catch (error) {
        if (alarm.enabled)
          await scheduleAlarm(alarm, undefined, alarm.registration);
        throw error;
      }
    });
  const finish = (alarm: Alarm) =>
    transaction(async () => {
      await stopAlarm(alarm);
      if (current.current.snoozed?.alarmId === alarm.id)
        await cancelRegistration(current.current.snoozed.registration);
      if (!alarm.days.length) await cancelRegistration(alarm.registration);
      const today = new Date().toLocaleDateString("en-CA");
      await persist({
        ...current.current,
        snoozed:
          current.current.snoozed?.alarmId === alarm.id
            ? undefined
            : current.current.snoozed,
        alarms: current.current.alarms.map((a) =>
          a.id === alarm.id && !a.days.length
            ? { ...a, enabled: false, registration: undefined }
            : a,
        ),
        completions: [...new Set([...current.current.completions, today])],
      });
    });
  const snooze = (alarm: Alarm) =>
    transaction(async () => {
      if (alarm.snooze === 0) throw new Error("Snooze is off for this alarm.");
      const at = Date.now() + alarm.snooze * 60000;
      const registration = await scheduleAlarm(alarm, new Date(at));
      try {
        await stopAlarm(alarm);
        await cancelRegistration(current.current.snoozed?.registration);
        await persist({
          ...current.current,
          snoozed: { alarmId: alarm.id, at, registration },
        });
      } catch (e) {
        await cancelRegistration(registration);
        throw e;
      }
    });
  useEffect(() => {
    if (!ready || !AndroidAlarm) return;
    let migrating = false;
    const migrate = async () => {
      const access = AndroidAlarm!.permissions();
      if (migrating || locked.current || !access.exact || !access.fullScreen || AndroidAlarm!.activeAlarm()) return;
      migrating = true;
      try {
        for (const alarm of current.current.alarms) {
          if (alarm.enabled && alarm.registration?.kind !== "android" && current.current.snoozed?.alarmId !== alarm.id &&
              (alarm.days.length > 0 || !alarm.nextAt || alarm.nextAt > Date.now())) await saveAlarm(alarm);
        }
      } catch { /* The existing transaction error exposes failures without losing saved alarms. */ }
      finally { migrating = false; }
    };
    void migrate();
    const sub = AppState.addEventListener("change", state => { if (state === "active") void migrate(); });
    return () => sub.remove();
  }, [ready]);
  return (
    <Ctx.Provider
      value={{
        data,
        ready,
        busy,
        error,
        clearError: () => setError(null),
        retry: () => void hydrate(),
        draft,
        edit: (a) => setDraft(a ? { ...a, days: [...a.days] } : newAlarm()),
        updateDraft: (patch) => setDraft((d) => (d ? { ...d, ...patch } : d)),
        update,
        addCustomSound: (sound) => transaction(() => persist({ ...current.current, customSounds: [...(current.current.customSounds ?? []), sound] })),
        saveAlarm,
        deleteAlarm,
        finish,
        snooze,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("AppProvider is required");
  return ctx;
}
