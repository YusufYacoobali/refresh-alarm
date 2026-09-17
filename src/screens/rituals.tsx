import React, { useEffect, useState } from "react";
import { withHapticFeedback } from "@/services/haptics";
import { View, TextInput, Linking, Platform, AppState } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import Animated from "react-native-reanimated";
import { useSceneMotion } from "@/components/motion";
import { ClayMotion } from "@/components/clay-motion";
import AndroidAlarm from "@/services/android-alarm";
import { AndroidAlarmSettings } from "@/components/android-alarm-settings";
import {
  Screen,
  T,
  Button,
  Card,
  Row,
  Heading,
  Tap,
  Icon,
  Quote,
  Chip,
} from "@/components/ui";
import { art, colors as c, fonts } from "@/theme";
import { useApp, newAlarm } from "@/state/app-state";
import {
  permissionStatus,
  requestPermission,
  alarmKitAvailable,
} from "@/services/scheduler";

export function Sleep() {
  const { reduced, running } = useSceneMotion();
  const [minutes, setMinutes] = useState(5),
    [until, setUntil] = useState<number | null>(null),
    [seconds, setSeconds] = useState(0),
    [ended, setEnded] = useState(false);
  useEffect(() => {
    if (!until) return;
    const t = setInterval(() => {
      const left = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setSeconds(left);
      if (left === 0) {
        setUntil(null);
        setEnded(true);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [until]);
  const elapsed = minutes * 60 - seconds;
  const inhale = elapsed % 10 < 4;
  return (
    <Screen safeTop>
      <T variant="eyebrow" style={{ color: c.lavender }}>
        LET THE DAY SOFTEN
      </T>
      <Heading
        title={until ? "Nothing to do. Just be." : "A softer landing."}
        subtitle={
          until
            ? "Breathe in for 4. Breathe out for 6."
            : "Wind down. Worry less. Rest a little easier."
        }
      />
      <View
        style={{ height: 310, alignItems: "center", justifyContent: "center" }}
      >
        <Animated.View
          style={{
            width: "100%",
            height: 300,
            animationName:
              !until || reduced
                ? undefined
                : {
                    "0%,100%": { transform: [{ scale: 0.88 }], opacity: 0.75 },
                    "40%": { transform: [{ scale: 1.04 }], opacity: 1 },
                  },
            animationDuration: "10000ms",
            animationTimingFunction: "ease-in-out",
            animationIterationCount: "infinite",
            animationPlayState: running ? "running" : "paused",
          }}
        >
          <Image
            source={art.moon}
            contentFit="contain"
            style={{ width: "100%", height: "100%" }}
          />
        </Animated.View>
        <ClayMotion name="stars" size={300} style={{ position: "absolute" }} />
      </View>
      {until ? (
        <View style={{ gap: 20, alignItems: "center" }}>
          <T variant="heading">{inhale ? "Breathe in…" : "Let it go…"}</T>
          <T style={{ color: c.muted, fontVariant: ["tabular-nums"] }}>
            {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}{" "}
            of quiet
          </T>
        </View>
      ) : (
        <>
          <Quote
            text={
              ended
                ? "A little calmer. A little lighter. Carry this feeling with you."
                : "You’ve done enough for today. Let tomorrow wait."
            }
          />
          <View style={{ gap: 12 }}>
            <T variant="eyebrow" style={{ color: c.muted }}>
              A MOMENT JUST FOR YOU
            </T>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {[1, 5, 10, 15].map((m) => (
                <Chip
                  key={m}
                  title={`${m} min`}
                  active={minutes === m}
                  onPress={() => setMinutes(m)}
                />
              ))}
            </View>
          </View>
        </>
      )}
      <Button
        secondary
        haptic={until ? "success" : "light"}
        title={
          until
            ? "Finish for tonight"
            : ended
              ? "A little more quiet"
              : "Begin a quiet moment"
        }
        onPress={() => {
          if (until) {
            setUntil(null);
            setEnded(true);
          } else {
            setSeconds(minutes * 60);
            setUntil(Date.now() + minutes * 60000);
            setEnded(false);
          }
        }}
      />
      <T variant="small" style={{ textAlign: "center", color: c.faint }}>
        A silent breathing ritual. Your alarms stay scheduled.
      </T>
    </Screen>
  );
}
const moods = [
  { name: "Rested", icon: "sunny-outline" },
  { name: "Okay", icon: "partly-sunny-outline" },
  { name: "Sleepy", icon: "moon-outline" },
  { name: "Low", icon: "cloud-outline" },
] as const;
export function Journal() {
  const { data, update, busy } = useApp();
  const today = new Date().toLocaleDateString("en-CA");
  const entry = data.journal.find((j) => j.date === today);
  const [mood, setMood] = useState(entry?.mood ?? "Okay"),
    [note, setNote] = useState(entry?.note ?? ""),
    [saved, setSaved] = useState(false);
  return (
    <Screen safeTop>
      <T variant="eyebrow" style={{ color: c.peach }}>
        FIND YOUR MORNING RHYTHM
      </T>
      <Heading
        title="How’s your morning?"
        subtitle="Rested or still groggy? Notice what works for you."
      />
      <View style={{ flexDirection: "row", gap: 8 }}>
        {moods.map((m) => (
          <Tap
            key={m.name}
            selected={mood === m.name}
            onPress={() => {
              setMood(m.name);
              setSaved(false);
            }}
            style={{ flex: 1 }}
          >
            <Card
              style={{
                paddingVertical: 20,
                alignItems: "center",
                gap: 10,
                backgroundColor: mood === m.name ? c.raised : c.surface,
                borderColor: mood === m.name ? c.lavender : c.surface,
              }}
            >
              <Icon
                name={m.icon}
                size={28}
                color={mood === m.name ? c.peach : c.faint}
              />
              <T variant="small">{m.name}</T>
            </Card>
          </Tap>
        ))}
      </View>
      <AndroidAlarmSettings />
      <Card style={{ padding: 20, gap: 12 }}>
        <T variant="label">What helped you get going?</T>
        <TextInput
          accessibilityLabel="Morning journal"
          multiline
          placeholder="This morning, I noticed…"
          placeholderTextColor={c.faint}
          maxLength={500}
          value={note}
          onChangeText={(n) => {
            setNote(n);
            setSaved(false);
          }}
          style={{
            color: c.text,
            minHeight: 125,
            textAlignVertical: "top",
            fontFamily: fonts.regular,
            fontSize: 15,
            lineHeight: 24,
          }}
        />
        <T variant="small" style={{ color: c.faint, textAlign: "right" }}>
          {note.length}/500
        </T>
      </Card>
      <Button
        title={saved ? "Check-in saved" : "Save my check-in"}
        haptic={false}
        loading={busy}
        icon={saved ? "checkmark" : "add"}
        onPress={() =>
          void withHapticFeedback(() => update({
            journal: [
              { date: today, mood, note: note.trim() },
              ...data.journal.filter((j) => j.date !== today),
            ],
          }))
            .then(() => setSaved(true))
            .catch(() => {})
        }
      />
      <Card
        style={{
          padding: 22,
          flexDirection: "row",
          alignItems: "center",
          gap: 16,
        }}
      >
        <Image
          source={require("../../assets/art/sprout.png")}
          style={{ width: 80, height: 80, borderRadius: 20 }}
        />
        <View style={{ flex: 1 }}>
          <T variant="heading">{data.completions.length} fresh {data.completions.length === 1 ? "start" : "starts"}</T>
          <T variant="small" style={{ color: c.muted }}>
            Wake-ups completed with Refresh.
          </T>
        </View>
      </Card>
      {data.journal
        .filter((j) => j.date !== today)
        .slice(0, 7)
        .map((j) => (
          <Card key={j.date} style={{ padding: 18, gap: 8 }}>
            <T variant="small" style={{ color: c.lavender }}>
              {j.date} · {j.mood}
            </T>
            <T>{j.note || "A moment to check in."}</T>
          </Card>
        ))}
      <T variant="small" style={{ textAlign: "center", color: c.faint }}>
        Just for you. Your journal stays on this device.
      </T>
    </Screen>
  );
}
export function Settings() {
  const { saveAlarm, busy } = useApp();
  const [permission, setPermission] = useState("checking"),
    [testing, setTesting] = useState(false),
    [message, setMessage] = useState("");
  const refresh = () =>
    void permissionStatus()
      .then(setPermission)
      .catch(() => setPermission("unavailable"));
  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") refresh();
    });
    return () => sub.remove();
  }, []);
  async function testAlarm() {
    setTesting(true);
    try {
      const when = new Date(Date.now() + 120000);
      await withHapticFeedback(() => saveAlarm({
        ...newAlarm(),
        hour: when.getHours(),
        minute: when.getMinutes(),
        days: [],
        label: "Your test wake-up",
        challenge: "none",
      }));
      setMessage(
        "Test alarm saved for about two minutes from now. You can delete it from Alarms.",
      );
    } finally {
      setTesting(false);
    }
  }
  return (
    <Screen>
      <View style={{ alignItems: "center", gap: 10, paddingVertical: 12 }}>
        <Icon name="sunny-outline" size={38} color={c.peach} />
        <T variant="heading">Refresh</T>
        <T style={{ color: c.muted }}>Wake up fresh. Feel more you.</T>
      </View>
      <Card>
        <Row
          icon="notifications-outline"
          title="Alarm permission"
          value={
            permission === "authorized"
              ? "Allowed"
              : permission === "preview"
                ? "Browser preview"
                : permission === "notDetermined"
                  ? "Not yet enabled"
                  : permission
          }
          onPress={() => {
            if (permission === "denied") void Linking.openSettings();
            else
              void requestPermission()
                .then(setPermission)
                .catch(() =>
                  setMessage(
                    "Couldn’t request permission. Try again from your device settings.",
                  ),
                );
          }}
        />
        <Row
          icon="color-palette-outline"
          title="Your world"
          value="Change theme"
          onPress={() => router.push("/themes")}
        />
        <Row
          icon="musical-notes-outline"
          title="Sound collection"
          onPress={() => router.push("/sounds")}
        />
        <Row
          icon="extension-puzzle-outline"
          title="Wake-up challenges"
          onPress={() => router.push("/challenges")}
          last
        />
      </Card>
      <Card style={{ padding: 20, gap: 12 }}>
        <T variant="label">Made for your mornings</T>
        <T variant="small" style={{ color: c.muted }}>
          {alarmKitAvailable()
            ? "System alarms are powered by Apple AlarmKit. They can sound through Silent mode and Focus."
            : AndroidAlarm
              ? "Android alarm-clock scheduling wakes your phone, rings continuously, and opens your wake-up screen when locked. Complete your missions or snooze to stop the sound."
            : Platform.OS === "web"
              ? "This browser is a visual preview. Demo alarms only run while the page stays open. Install a mobile build for scheduled device alerts."
              : "This build uses local notifications. Notification settings, Focus, and battery restrictions may silence or delay them. On iOS 26+, install a Refresh native build to use AlarmKit."}
        </T>
        <T variant="small" style={{ color: c.muted }}>
          Wake-up challenges run inside the app. The operating system’s Stop
          button remains available. Snoozing in Refresh schedules a new alarm
          for your selected interval.
        </T>
      </Card>
      <Button
        title="Schedule a test alarm"
        haptic={false}
        secondary
        loading={testing || busy}
        onPress={() => void testAlarm().catch(() => {})}
      />
      {message && <T style={{ color: c.peach }}>{message}</T>}
      <Tap onPress={() => router.push("/onboarding")}>
        <T variant="small" style={{ textAlign: "center", color: c.lavender }}>
          Revisit the welcome
        </T>
      </Tap>
      <T variant="small" style={{ textAlign: "center", color: c.faint }}>
        REFRESH 1.0 · A FRESH START EVERY DAY
      </T>
    </Screen>
  );
}
