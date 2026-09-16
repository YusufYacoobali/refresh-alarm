import { goHome } from "@/utils/navigation";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Platform, BackHandler, AppState, useWindowDimensions } from "react-native";
import { AlarmSound } from "@/components/alarm-sound";
import { useMissionReminder } from "@/components/use-mission-reminder";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, router } from "expo-router";
import { Accelerometer } from "expo-sensors";
import { haptic, withHapticFeedback } from "@/services/haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { ClayMotion } from "@/components/clay-motion";
import { Float, easeOut, useFeedback, useMotion } from "@/components/motion";
import {
  T,
  Button,
  Tap,
  Icon,
  Quote,
  Screen,
  Card,
  SoundArt,
  Enter,
} from "@/components/ui";
import { useApp } from "@/state/app-state";
import {
  Alarm,
  Challenge,
  displayTime,
  mathQuestion,
  memoryDeck,
  alarmMissions,
  challengeNames,
} from "@/utils/alarms";
import { art, colors as c, fonts } from "@/theme";

const demo: Alarm = {
  id: "demo",
  hour: 7,
  minute: 0,
  days: [],
  label: "Rise & shine",
  enabled: false,
  sound: "morning",
  challenge: "math",
  difficulty: "gentle",
  snooze: 5,
};
function useWakeAlarm() {
  const params = useLocalSearchParams<{
    id?: string;
    eventId?: string;
    reminder?: string;
    preview?: string;
    kind?: Challenge;
    difficulty?: "gentle" | "bright";
  }>();
  const { data } = useApp();
  return {
    ...params,
    alarm:
      params.preview === "1" && params.id === "demo"
        ? demo
        : data.alarms.find((a) => a.id === params.id),
    isPreview: params.preview === "1",
  };
}
function usePreventBack() {
  useEffect(() => {
    const listener = BackHandler.addEventListener(
      "hardwareBackPress",
      () => true,
    );
    return () => listener.remove();
  }, []);
}
function MissingAlarm() {
  return (
    <Screen>
      <T variant="heading">This alarm is no longer here.</T>
      <Button title="Back to home" onPress={() => goHome()} />
    </Screen>
  );
}
export function Ringing() {
  const { alarm, isPreview, eventId, reminder } = useWakeAlarm();
  const { finish, snooze, busy } = useApp();
  const insets = useSafeAreaInsets();
  const acting = useRef(false);
  const [working, setWorking] = useState(false);
  usePreventBack();
  if (!alarm) return <MissingAlarm />;
  async function stop() {
    if (acting.current || busy) return;
    acting.current = true;
    setWorking(true);
    try {
      if (alarmMissions(alarm!).length)
        router.replace({
          pathname: "/challenge",
          params: { id: alarm!.id, preview: isPreview ? "1" : "0", eventId },
        });
      else {
        await withHapticFeedback(async () => { if (!isPreview) await finish(alarm!); });
        router.replace({
          pathname: "/success",
          params: { preview: isPreview ? "1" : "0" },
        });
      }
    } catch {
      acting.current = false;
      setWorking(false);
    }
  }
  async function snoozeAlarm() {
    if (acting.current || busy) return;
    acting.current = true;
    setWorking(true);
    try {
      if (!isPreview) await withHapticFeedback(() => snooze(alarm!));
      goHome();
    } catch {
      acting.current = false;
      setWorking(false);
    }
  }
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Float style={{ position: "absolute", inset: -10 }} distance={5}><Image
        source={alarm.wallpaper ? { uri: alarm.wallpaper } : art.alarmValley}
        contentFit="cover"
        contentPosition="bottom"
        style={{ position: "absolute", inset: 0 }}
      /></Float>
      {!alarm.wallpaper && <ClayMotion name="stars" size={360} style={{ position: "absolute", width: "100%", height: "65%", top: "20%" }} />}
      <LinearGradient
        colors={alarm.wallpaper ? ["#090C18CC", "#090C1855", "#090C18EE"] : ["#090C1866", "transparent", "#090C18"]}
        locations={[0, 0.55, 1]}
        style={{ position: "absolute", inset: 0 }}
      />
      <View
        style={{
          flex: 1,
          paddingHorizontal: 30,
          paddingTop: insets.top + 50,
          paddingBottom: Math.max(insets.bottom, 24),
          alignItems: "center",
        }}
      >
        {isPreview && (
          <Tap
            onPress={() => goHome()}
            label="Close alarm preview"
            style={{ position: "absolute", right: 24, top: insets.top + 20 }}
          >
            <Icon name="close-circle-outline" color={c.text} />
          </Tap>
        )}
        <T variant="eyebrow" style={{ color: c.peach }}>
          {isPreview
            ? "TRY YOUR FRESH START"
            : "YOUR FRESH START IS HERE"}
        </T>
        <T variant="heading" style={{ marginTop: 22 }}>
          {alarm.label}
        </T>
        <T style={{ color: c.muted, marginTop: 6 }}>Your day is waiting.</T>
        <View
          style={{
            flexDirection: "row",
            alignItems: "baseline",
            gap: 8,
            marginTop: 14,
          }}
        >
          <T
            style={{
              fontFamily: fonts.medium,
              fontSize: 76,
              lineHeight: 95,
              letterSpacing: -3,
            }}
          >
            {displayTime(alarm)}
          </T>
          <T variant="heading">{alarm.hour < 12 ? "AM" : "PM"}</T>
        </View>
        <View style={{ flex: 1, minHeight: 0, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
        </View>
        <View style={{ width: "100%", gap: 16 }}>
        <AlarmSound alarm={alarm} preview={isPreview} immediate={reminder === "1"} />
          <Button
            title={
              alarmMissions(alarm).length === 0 ? "Hello, new day" : "Wake up my mind"
            }
            icon={
              alarmMissions(alarm).length === 0 ? "sunny-outline" : "arrow-forward"
            }
            loading={busy || working}
            haptic={alarmMissions(alarm).length === 0 ? false : "light"}
            onPress={() => void stop().catch(() => {})}
          />
          {alarm.snooze > 0 && <Tap
            disabled={busy || working}
            haptic={isPreview ? "light" : false}
            onPress={() => void snoozeAlarm()}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                justifyContent: "center",
                minHeight: 48,
              }}
            >
              <Icon name="alarm-outline" size={18} color={c.text} />
              <T variant="label">
                {isPreview
                  ? "Close preview"
                  : `Snooze · ${alarm.snooze} min`}
              </T>
            </View>
          </Tap>}
        </View>
      </View>
    </View>
  );
}
function Progress({ value, total, label = true }: { value: number; total: number; label?: boolean }) {
  const { reduced } = useMotion();
  return (
    <View style={{ gap: 10 }}>
      <View
        style={{
          height: 7,
          backgroundColor: c.raised,
          borderRadius: 5,
          overflow: "hidden",
        }}
      >
        <Animated.View
          style={{
            position: "absolute", left: 0, top: 0, bottom: 0,
            width: `${Math.min(value / total, 1) * 100}%`,
            backgroundColor: c.lavender,
            borderRadius: 5,
            transitionProperty: "width", transitionDuration: reduced ? 0 : 320, transitionTimingFunction: easeOut,
          }}
        />
      </View>
      {label && <T accessibilityLiveRegion="polite" variant="small" style={{ textAlign: "center", color: c.muted }}>{value} of {total}</T>}
    </View>
  );
}
function MathGame({
  difficulty,
  onDone,
  onActivity,
}: {
  difficulty: Alarm["difficulty"];
  onDone(): void;
  onActivity(): void;
}) {
  const [question, setQuestion] = useState(() => mathQuestion(difficulty)),
    [count, setCount] = useState(0),
    [wrong, setWrong] = useState<number | null>(null),
    [done, setDone] = useState(false);
  const [feedback, setFeedback] = useState({ revision: 0, kind: "success" as "success" | "error" });
  const responseStyle = useFeedback(feedback.revision, feedback.kind);
  const { reduced } = useMotion();
  const { width, height } = useWindowDimensions();
  const equationSize = Math.min(48, (width - 96) / 5);
  const choices = useMemo(
    () =>
      [question.answer, question.answer + 3, question.answer - 2].sort(
        () => Math.random() - 0.5,
      ),
    [question],
  );
  const answered = useRef(false);
  useEffect(() => { answered.current = false; }, [question]);
  function answer(n: number) {
    if (done || answered.current) return;
    onActivity();
    if (n !== question.answer) {
      setFeedback(f => ({ revision: f.revision + 1, kind: "error" }));
      setWrong(n);
      haptic("error");
      return;
    }
    answered.current = true;
    setWrong(null);
    setFeedback(f => ({ revision: f.revision + 1, kind: "success" }));
    const next = count + 1;
    setCount(next);
    if (next === 3) {
      setDone(true);
      onDone();
    } else {
      haptic("success");
      setQuestion(mathQuestion(difficulty));
    }
  }
  return (
    <View style={{ gap: height < 700 ? 18 : 26 }}>
      <Progress value={count} total={3} />
      <Animated.View style={responseStyle}>
      <Card style={{ alignItems: "center", paddingVertical: height < 700 ? 14 : 18, gap: height < 700 ? 8 : 12, borderColor: wrong !== null ? c.danger : c.line }}>
        <ClayMotion name="math" size={height < 700 ? 80 : 146} />
        <Animated.View style={{ width: "100%" }} key={`question-${count}`} entering={reduced ? undefined : FadeInDown.duration(240)}><T
          testID="math-question"
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{ fontSize: equationSize, lineHeight: Math.ceil(equationSize * 1.35), textAlign: "center", fontFamily: fonts.bold, includeFontPadding: true }}
        >
          {question.text}
        </T></Animated.View>
        <T accessibilityLiveRegion="polite" style={{ color: wrong !== null ? c.peach : count ? c.green : c.muted }}>
          {wrong !== null
            ? "Try again."
            : "Choose the answer."}
        </T>
      </Card>
      </Animated.View>
      <View style={{ flexDirection: "row", gap: 12 }}>
        {choices.map((n) => (
          <Tap
            key={n}
            label={`Answer ${n}`}
            onPress={() => answer(n)}
            style={{ flex: 1 }}
            disabled={done}
            haptic={false}
          >
            <Card
              style={{
                paddingVertical: height < 700 ? 18 : 23,
                alignItems: "center",
                borderColor: wrong === n ? c.danger : c.line,
                backgroundColor: wrong === n ? "#4B2D3E" : c.raised,
              }}
            >
              <T variant="heading" numberOfLines={1} adjustsFontSizeToFit style={{ fontVariant: ["tabular-nums"] }}>{n}</T>
            </Card>
          </Tap>
        ))}
      </View>
    </View>
  );
}
function MemoryTile({ tile, revealed, matched }: { tile: number; revealed: boolean; matched: boolean }) {
  const { reduced } = useMotion();
  const flip = useSharedValue(revealed ? 180 : 0);
  const matchStyle = useFeedback(matched ? 1 : 0);
  useEffect(() => { flip.set(withTiming(revealed ? 180 : 0, { duration: reduced ? 0 : 280 })); }, [revealed, reduced]);
  const frontStyle = useAnimatedStyle(() => ({ transform: [{ perspective: 850 }, { rotateY: `${flip.get() - 180}deg` }] }));
  const backStyle = useAnimatedStyle(() => ({ transform: [{ perspective: 850 }, { rotateY: `${flip.get()}deg` }] }));
  const surface = { position: "absolute" as const, inset: 0, backfaceVisibility: "hidden" as const, borderRadius: 20, overflow: "hidden" as const, borderWidth: 2 };
  return <Animated.View style={[{ height: 108 }, matchStyle]}>
    <Animated.View style={[surface, { backgroundColor: c.raised, borderColor: c.line, alignItems: "center", justifyContent: "center" }, backStyle]}>
      <Icon name="sparkles-outline" size={30} color={c.lavender} />
    </Animated.View>
    <Animated.View style={[surface, { backgroundColor: c.raised, borderColor: matched ? c.green : c.lavender, transitionProperty: "borderColor", transitionDuration: 180 }, frontStyle]}>
      <SoundArt tile={tile} style={{ width: "100%", position: "absolute", top: -24 }} />
      {matched && <Animated.View entering={reduced ? undefined : FadeIn.duration(180)} style={{ position: "absolute", right: 8, top: 8, backgroundColor: c.green, padding: 4, borderRadius: 15 }}><Icon name="checkmark" size={15} color={c.ink} /></Animated.View>}
    </Animated.View>
  </Animated.View>;
}
function MemoryGame({
  difficulty,
  onDone,
  onActivity,
}: {
  difficulty: Alarm["difficulty"];
  onDone(): void;
  onActivity(): void;
}) {
  const [deck] = useState(() => memoryDeck()),
    [open, setOpen] = useState<number[]>([]),
    [matched, setMatched] = useState<number[]>([]),
    [peek, setPeek] = useState(true);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const locked = useRef(false);
  useEffect(() => {
    const t = setTimeout(
      () => setPeek(false),
      difficulty === "gentle" ? 2000 : 800,
    );
    return () => {
      clearTimeout(t);
      if (timeout.current) clearTimeout(timeout.current);
    };
  }, []);
  function flip(i: number) {
    if (peek || locked.current || matched.includes(i) || open.includes(i))
      return;
    onActivity();
    const next = [...open, i];
    setOpen(next);
    if (next.length !== 2) {
      haptic("selection");
      return;
    }
    locked.current = true;
    const match = deck[next[0]] === deck[next[1]];
    // The pair outcome replaces the second card's tap pulse.
    if (!match) haptic("warning");
    else if (matched.length + 2 < deck.length) haptic("success");
    timeout.current = setTimeout(
      () => {
        if (match) {
          const m = [...matched, ...next];
          setMatched(m);
          if (m.length === deck.length) onDone();
        }
        setOpen([]);
        locked.current = false;
      },
      match ? 350 : 800,
    );
  }
  return (
    <View style={{ gap: 22 }}>
      <Progress value={matched.length / 2} total={4} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <ClayMotion name="memory" size={95} />
      <T accessibilityLiveRegion="polite" style={{ flex: 1, color: c.muted }}>
        {peek
          ? "Remember the pairs."
          : "Match the pairs."}
      </T>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {deck.map((tile, i) => {
          const revealed = peek || open.includes(i) || matched.includes(i);
          return (
            <Tap
              key={i}
              label={
                revealed
                  ? `Card ${i + 1}: ${["sun", "forest", "ocean", "rain"][tile]}${matched.includes(i) ? ", matched" : ""}`
                  : `Reveal card ${i + 1}`
              }
              onPress={() => flip(i)}
              style={{ width: "47.8%" }}
              disabled={matched.includes(i)}
              haptic={false}
            >
              <MemoryTile tile={tile} revealed={revealed} matched={matched.includes(i)} />
            </Tap>
          );
        })}
      </View>
    </View>
  );
}
function ShakeGame({
  difficulty,
  onDone,
  onFallback,
  isPreview,
  onActivity,
}: {
  difficulty: Alarm["difficulty"];
  onDone(): void;
  onFallback(): void;
  isPreview: boolean;
  onActivity(): void;
}) {
  const [count, setCount] = useState(0),
    [status, setStatus] = useState("ready");
  const counter = useRef(0),
    last = useRef(0),
    armed = useRef(true);
  const target = difficulty === "bright" ? 20 : 12;
  const { width, height } = useWindowDimensions();
  const { reduced } = useMotion();
  const shakeStyle = useFeedback(count);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  function register() {
    if (counter.current >= target) return;
    onActivity();
    counter.current++;
    setCount(counter.current);
    if (counter.current === target) doneRef.current();
    else haptic("light");
  }
  useEffect(() => {
    if (Platform.OS === "web") return;
    let sub: ReturnType<typeof Accelerometer.addListener> | undefined;
    let cancelled = false;
    void (async () => {
      try {
        if (!(await Accelerometer.isAvailableAsync())) {
          if (!cancelled) setStatus("unavailable");
          return;
        }
        if (cancelled) return;
        const permission = await Accelerometer.requestPermissionsAsync();
        if (!permission.granted) {
          if (!cancelled) setStatus("denied");
          return;
        }
        if (cancelled) return;
        Accelerometer.setUpdateInterval(60);
        sub = Accelerometer.addListener(({ x, y, z }) => {
          if (AppState.currentState !== "active") return;
          const magnitude = Math.sqrt(x * x + y * y + z * z);
          if (magnitude < 1.3) armed.current = true;
          if (
            magnitude > 1.8 &&
            armed.current &&
            Date.now() - last.current > 400
          ) {
            armed.current = false;
            last.current = Date.now();
            register();
          }
        });
        setStatus("listening");
      } catch {
        if (!cancelled) setStatus("unavailable");
      }
    })();
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, []);
  return (
    <View style={{ gap: 18 }}>
      <View style={{ alignItems: "center", gap: 4 }}>
        <Animated.View style={shakeStyle}>
          <T testID="shake-count" accessibilityLabel={`${count} of ${target} shakes`} accessibilityLiveRegion="polite" style={{ fontFamily: fonts.bold, fontSize: Math.min(144, width * .38), lineHeight: Math.min(155, width * .42), fontVariant: ["tabular-nums"], color: c.peach }}>{count}</T>
        </Animated.View>
        <T style={{ color: c.muted, fontSize: 20 }}>of {target} shakes</T>
        <ClayMotion name="shake" size={height < 700 ? 100 : 140} />
        <T style={{ textAlign: "center", color: c.muted }}>Hold firmly. Shake gently.</T>
      </View>
      <Progress value={count} total={target} label={false} />
      {Platform.OS === "web" ? (
        <>
          <T variant="small" style={{ textAlign: "center", color: c.peach }}>
            Shake detection needs the mobile app.
          </T>
          {isPreview && (
            <Button title="Preview a shake" secondary haptic={false} onPress={register} />
          )}
        </>
      ) : (
        <T style={{ textAlign: "center", color: c.muted }}>
          {status === "listening"
            ? "Listening for shakes"
            : status === "ready"
              ? "Connecting…"
              : "Motion unavailable. Use math instead."}
        </T>
      )}
      <Tap label="Prefer not to shake? Try math instead" onPress={onFallback}>
        <T variant="small" style={{ textAlign: "center", color: c.lavender }}>
          Use math instead
        </T>
      </Tap>
    </View>
  );
}
export function ChallengeScreen() {
  const { height } = useWindowDimensions();
  const { alarm, isPreview, kind, difficulty, eventId } = useWakeAlarm();
  const { activity, error: reminderError } = useMissionReminder(alarm, isPreview, eventId);
  const { finish, busy } = useApp();
  const inset = useSafeAreaInsets();
  const [fallback, setFallback] = useState(false),
    [completed, setCompleted] = useState(false);
  const [missionIndex, setMissionIndex] = useState(0);
  const [silent, setSilent] = useState(alarm?.silentMissions ?? false);
  const finishing = useRef(false);
  const [working, setWorking] = useState(false);
  const advancing = useRef(false);
  useEffect(() => { advancing.current = false; }, [missionIndex]);
  usePreventBack();
  if (!alarm) return <MissingAlarm />;
  const missions = isPreview && kind && kind !== "none" ? [{ kind, difficulty: difficulty ?? alarm.difficulty }] : alarmMissions(alarm);
  const mission = missions[missionIndex];
  const challenge = fallback ? "math" : mission?.kind ?? "none";
  const level = mission?.difficulty ?? "gentle";
  async function complete() {
    if (finishing.current || busy) return;
    finishing.current = true;
    setWorking(true);
    setCompleted(true);
    try {
      await withHapticFeedback(async () => { if (!isPreview) await finish(alarm!); });
      router.replace({
        pathname: "/success",
        params: { preview: isPreview ? "1" : "0" },
      });
    } finally {
      finishing.current = false;
      setWorking(false);
    }
  }
  function nextMission() {
    if (advancing.current) return;
    advancing.current = true;
    if (missionIndex + 1 < missions.length) {
      haptic("success");
      setMissionIndex(i => i + 1);
      setFallback(false);
    } else void complete().catch(() => {});
  }
  return (
    <Screen style={{ paddingTop: inset.top + (height < 700 ? 16 : 26), gap: height < 700 ? 16 : 24 }}>
      <AlarmSound alarm={alarm} preview={isPreview} silent={silent} immediate />
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <T variant="eyebrow" style={{ color: c.peach }}>
          {isPreview ? "PREVIEW" : "WAKE-UP MISSION"}
        </T>
        {isPreview && (
          <Tap label="Close challenge preview" onPress={() => router.canGoBack() ? router.back() : goHome()}>
            <Icon name="close" />
          </Tap>
        )}
      </View>
      <View style={{ gap: 8 }}>
        {missions.length > 0 && <View style={{ gap: 10 }}>
          <T variant="small" accessibilityLiveRegion="polite" style={{ color: c.lavender }}>Mission {missionIndex + 1} of {missions.length} · {challengeNames[challenge]}</T>
          <View style={{ flexDirection: "row", gap: 6 }}>{missions.map((m, i) => <View key={m.kind} style={{ flex: 1, height: 4, borderRadius: 4, backgroundColor: i < missionIndex ? c.green : i === missionIndex ? c.lavender : c.raised }} />)}</View>
        </View>}
        <T variant="title">
          {challenge === "memory"
            ? "Match the pairs"
            : challenge === "shake"
              ? "Shake to wake"
              : "Solve the math"}
        </T>
      </View>
      <Tap label={silent ? "Turn mission sound on" : "Silence mission sound"} selected={silent} onPress={() => setSilent(value => !value)}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 44 }}>
          <Icon name={silent ? "volume-mute-outline" : "volume-high-outline"} size={20} color={c.lavender} />
          <T variant="small" style={{ color: c.lavender }}>{silent ? "Sound off during missions" : "Sound on · tap to silence"}</T>
        </View>
      </Tap>
      {!isPreview && alarm.missionReminder !== false && <T variant="small" style={{ color: reminderError ? c.peach : c.muted, textAlign: "center" }}>
        {reminderError ? "Couldn’t start the reminder. Keep the alarm sound on." : "No activity for 1 minute? Your alarm will ring again."}
      </T>}
      {completed || !mission ? (
        <>
          <T variant="heading">You did it.</T>
          <Button
            title="Finish waking up"
            haptic={false}
            loading={busy || working}
            onPress={() => void complete().catch(() => {})}
          />
        </>
      ) : challenge === "memory" ? (
        <MemoryGame
          key={`memory-${missionIndex}`}
          difficulty={level}
          onDone={nextMission}
          onActivity={activity}
        />
      ) : challenge === "shake" ? (
        <ShakeGame
          key={`shake-${missionIndex}`}
          difficulty={level}
          isPreview={isPreview}
          onFallback={() => setFallback(true)}
          onDone={nextMission}
          onActivity={activity}
        />
      ) : (
        <MathGame
          key={`math-${missionIndex}-${fallback}`}
          difficulty={level}
          onDone={nextMission}
          onActivity={activity}
        />
      )}
      {!isPreview && (
        <Tap disabled={busy || working} haptic={false} onPress={() => void complete().catch(() => {})}>
          <T variant="small" style={{ color: c.faint, textAlign: "center" }}>
            I need to stop this alarm
          </T>
        </Tap>
      )}
    </Screen>
  );
}
export function Success() {
  const { preview } = useLocalSearchParams<{ preview?: string }>();
  const inset = useSafeAreaInsets();
  return (
    <Screen
      style={{
        paddingTop: inset.top + 24,
        flexGrow: 1,
        justifyContent: "center",
      }}
    >
      <Enter style={{ alignItems: "center" }}>
        <ClayMotion name="bloom" size={300} loop={false} />
      </Enter>
      <Enter delay={100} style={{ alignItems: "center", gap: 13 }}>
        <View
          style={{
            height: 50,
            width: 50,
            borderRadius: 25,
            backgroundColor: c.peach,
            alignItems: "center",
            justifyContent: "center",
            marginTop: -46,
          }}
        >
          <Icon name="checkmark" size={28} color={c.ink} />
        </View>
        <T variant="title">First win of the day.</T>
        <T style={{ color: c.muted, textAlign: "center" }}>
          {preview === "1"
            ? "That’s your wake-up routine.\nMake it yours for tomorrow."
            : "Alarm done. Morning started.\nNow make a little time for you."}
        </T>
      </Enter>
      <Quote text="Let in some light. Take a stretch. Meet your morning." />
      <Button
        title="Hello, new day"
        icon="arrow-forward"
        onPress={() => goHome()}
      />
    </Screen>
  );
}
