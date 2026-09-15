import { goHome } from "@/utils/navigation";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Platform, BackHandler, AppState } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, router } from "expo-router";
import { Accelerometer } from "expo-sensors";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useReducedMotion } from "react-native-reanimated";
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
  const { alarm, isPreview } = useWakeAlarm();
  const { finish, snooze, busy } = useApp();
  const insets = useSafeAreaInsets();
  usePreventBack();
  if (!alarm) return <MissingAlarm />;
  async function stop() {
    if (alarm!.challenge !== "none")
      router.replace({
        pathname: "/challenge",
        params: { id: alarm!.id, preview: isPreview ? "1" : "0" },
      });
    else {
      if (!isPreview) await finish(alarm!);
      router.replace({
        pathname: "/success",
        params: { preview: isPreview ? "1" : "0" },
      });
    }
  }
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Image
        source={art.valley}
        contentFit="cover"
        contentPosition="bottom"
        style={{ position: "absolute", inset: 0 }}
      />
      <LinearGradient
        colors={["#090C1866", "transparent", "#090C18"]}
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
            ? "A PEEK AT YOUR MORNING"
            : "HERE COMES YOUR LITTLE BEGINNING"}
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
        <View style={{ flex: 1 }} />
        <View style={{ width: "100%", gap: 16 }}>
          <Button
            title={
              alarm.challenge === "none" ? "Hello, new day" : "Wake up my mind"
            }
            icon={
              alarm.challenge === "none" ? "sunny-outline" : "arrow-forward"
            }
            loading={busy}
            onPress={() => void stop().catch(() => {})}
          />
          <Tap
            disabled={busy}
            onPress={() =>
              isPreview
                ? goHome()
                : void snooze(alarm)
                    .then(() => goHome())
                    .catch(() => {})
            }
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
                  : `A little longer · ${alarm.snooze} min`}
              </T>
            </View>
          </Tap>
        </View>
      </View>
    </View>
  );
}
function Progress({ value, total }: { value: number; total: number }) {
  return (
    <View style={{ gap: 10 }}>
      <View
        style={{
          height: 5,
          backgroundColor: c.raised,
          borderRadius: 5,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            height: 5,
            width: `${Math.min(value / total, 1) * 100}%`,
            backgroundColor: c.lavender,
            borderRadius: 5,
          }}
        />
      </View>
      <T variant="small" style={{ textAlign: "center", color: c.muted }}>
        {value} of {total} · You’ve got this
      </T>
    </View>
  );
}
function MathGame({
  difficulty,
  onDone,
}: {
  difficulty: Alarm["difficulty"];
  onDone(): void;
}) {
  const [question, setQuestion] = useState(() => mathQuestion(difficulty)),
    [count, setCount] = useState(0),
    [wrong, setWrong] = useState<number | null>(null),
    [done, setDone] = useState(false);
  const choices = useMemo(
    () =>
      [question.answer, question.answer + 3, question.answer - 2].sort(
        () => Math.random() - 0.5,
      ),
    [question],
  );
  function answer(n: number) {
    if (done) return;
    if (n !== question.answer) {
      setWrong(n);
      void Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Error,
      ).catch(() => {});
      return;
    }
    void Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success,
    ).catch(() => {});
    setWrong(null);
    const next = count + 1;
    setCount(next);
    if (next === 3) {
      setDone(true);
      onDone();
    } else setQuestion(mathQuestion(difficulty));
  }
  return (
    <View style={{ gap: 26 }}>
      <Progress value={count} total={3} />
      <Card style={{ alignItems: "center", paddingVertical: 36, gap: 20 }}>
        <Icon name="sunny-outline" size={32} color={c.peach} />
        <T variant="small" style={{ color: c.muted }}>
          A LITTLE MORNING MATH
        </T>
        <T
          testID="math-question"
          style={{ fontSize: 48, fontFamily: fonts.bold }}
        >
          {question.text}
        </T>
        <T style={{ color: wrong !== null ? c.peach : c.muted }}>
          {wrong !== null
            ? "Not quite. Take another look."
            : "What’s the answer?"}
        </T>
      </Card>
      <View style={{ flexDirection: "row", gap: 12 }}>
        {choices.map((n) => (
          <Tap
            key={n}
            label={`Answer ${n}`}
            onPress={() => answer(n)}
            style={{ flex: 1 }}
            disabled={done}
          >
            <Card
              style={{
                paddingVertical: 23,
                alignItems: "center",
                borderColor: wrong === n ? c.danger : c.line,
                backgroundColor: wrong === n ? "#4B2D3E" : c.raised,
              }}
            >
              <T variant="heading">{n}</T>
            </Card>
          </Tap>
        ))}
      </View>
    </View>
  );
}
function MemoryGame({
  difficulty,
  onDone,
}: {
  difficulty: Alarm["difficulty"];
  onDone(): void;
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
    const next = [...open, i];
    setOpen(next);
    if (next.length !== 2) return;
    locked.current = true;
    const match = deck[next[0]] === deck[next[1]];
    timeout.current = setTimeout(
      () => {
        if (match) {
          const m = [...matched, ...next];
          setMatched(m);
          void Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          ).catch(() => {});
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
      <T style={{ textAlign: "center", color: c.muted }}>
        {peek
          ? "A little peek. Remember where they are…"
          : "Find the friends that belong together."}
      </T>
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
            >
              <View
                style={{
                  height: 108,
                  borderRadius: 20,
                  overflow: "hidden",
                  borderWidth: 1,
                  borderColor: matched.includes(i) ? c.green : c.line,
                  backgroundColor: c.raised,
                }}
              >
                {revealed ? (
                  <SoundArt
                    tile={tile}
                    style={{ width: "100%", position: "absolute", top: -24 }}
                  />
                ) : (
                  <View
                    style={{
                      flex: 1,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon
                      name="sparkles-outline"
                      size={30}
                      color={c.lavender}
                    />
                  </View>
                )}
              </View>
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
}: {
  difficulty: Alarm["difficulty"];
  onDone(): void;
  onFallback(): void;
  isPreview: boolean;
}) {
  const [count, setCount] = useState(0),
    [status, setStatus] = useState("ready"),
    [started, setStarted] = useState(false);
  const counter = useRef(0),
    last = useRef(0),
    armed = useRef(true);
  const target = difficulty === "bright" ? 20 : 12;
  const reduced = useReducedMotion();
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  function register() {
    if (counter.current >= target) return;
    counter.current++;
    setCount(counter.current);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (counter.current === target) doneRef.current();
  }
  useEffect(() => {
    if (!started || Platform.OS === "web") return;
    let sub: ReturnType<typeof Accelerometer.addListener> | undefined;
    let cancelled = false;
    void (async () => {
      try {
        if (!(await Accelerometer.isAvailableAsync())) {
          setStatus("unavailable");
          return;
        }
        const permission = await Accelerometer.requestPermissionsAsync();
        if (!permission.granted) {
          setStatus("denied");
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
        setStatus("unavailable");
      }
    })();
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [started]);
  return (
    <View style={{ gap: 26 }}>
      <Progress value={count} total={target} />
      <View style={{ alignItems: "center", paddingVertical: 32, gap: 24 }}>
        <Animated.View
          style={{
            width: 144,
            height: 180,
            borderRadius: 44,
            backgroundColor: c.raised,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 2,
            borderColor: c.lilac,
            animationName: reduced
              ? undefined
              : {
                  "0%,100%": { transform: [{ rotate: "-7deg" }] },
                  "50%": { transform: [{ rotate: "7deg" }] },
                },
            animationDuration: "1600ms",
            animationTimingFunction: "ease-in-out",
            animationIterationCount: "infinite",
          }}
        >
          <Icon name="phone-portrait-outline" size={85} color={c.lavender} />
        </Animated.View>
        <T variant="heading">
          {count === target
            ? "Hello, energy!"
            : "A little shake. A fresh start."}
        </T>
        <T style={{ textAlign: "center", color: c.muted }}>
          {
            "Hold your phone securely and shake gently.\nEach separate shake counts once."
          }
        </T>
      </View>
      {Platform.OS === "web" ? (
        <>
          <T variant="small" style={{ textAlign: "center", color: c.peach }}>
            Motion sensing is available in the mobile app.
          </T>
          {isPreview && (
            <Button title="Preview a shake" secondary onPress={register} />
          )}
        </>
      ) : !started ? (
        <Button title="Start shaking" onPress={() => setStarted(true)} />
      ) : (
        <T style={{ textAlign: "center", color: c.muted }}>
          {status === "listening"
            ? "Ready when you are…"
            : status === "ready"
              ? "Connecting to motion sensors…"
              : "Motion is unavailable. Try a math puzzle instead."}
        </T>
      )}
      <Tap onPress={onFallback}>
        <T variant="small" style={{ textAlign: "center", color: c.lavender }}>
          Prefer not to shake? Try math instead →
        </T>
      </Tap>
    </View>
  );
}
export function ChallengeScreen() {
  const { alarm, isPreview, kind, difficulty } = useWakeAlarm();
  const { finish, busy } = useApp();
  const inset = useSafeAreaInsets();
  const [fallback, setFallback] = useState(false),
    [completed, setCompleted] = useState(false);
  usePreventBack();
  if (!alarm) return <MissingAlarm />;
  const challenge = fallback ? "math" : (kind ?? alarm.challenge);
  const level = difficulty ?? alarm.difficulty;
  async function complete() {
    setCompleted(true);
    if (!isPreview) await finish(alarm!);
    router.replace({
      pathname: "/success",
      params: { preview: isPreview ? "1" : "0" },
    });
  }
  return (
    <Screen style={{ paddingTop: inset.top + 26 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <T variant="eyebrow" style={{ color: c.peach }}>
          {isPreview ? "A LITTLE PRACTICE" : "LET’S GREET THE DAY"}
        </T>
        {isPreview && (
          <Tap label="Close challenge preview" onPress={() => goHome()}>
            <Icon name="close" />
          </Tap>
        )}
      </View>
      <View style={{ gap: 8 }}>
        <T variant="title">
          {challenge === "memory"
            ? "A moment of focus."
            : challenge === "shake"
              ? "Shake off the sleep."
              : "Rise, shine & solve."}
        </T>
        <T style={{ color: c.muted }}>One small win to start your morning.</T>
      </View>
      {completed ? (
        <>
          <T variant="heading">You did it.</T>
          <Button
            title="Finish waking up"
            loading={busy}
            onPress={() => void complete().catch(() => {})}
          />
        </>
      ) : challenge === "memory" ? (
        <MemoryGame
          difficulty={level}
          onDone={() => void complete().catch(() => {})}
        />
      ) : challenge === "shake" ? (
        <ShakeGame
          difficulty={level}
          isPreview={isPreview}
          onFallback={() => setFallback(true)}
          onDone={() => void complete().catch(() => {})}
        />
      ) : (
        <MathGame
          difficulty={level}
          onDone={() => void complete().catch(() => {})}
        />
      )}
      {!isPreview && (
        <Tap disabled={busy} onPress={() => void complete().catch(() => {})}>
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
      <Enter>
        <Image
          source={require("../../assets/art/sprout.png")}
          contentFit="cover"
          style={{ width: "100%", aspectRatio: 1, borderRadius: 28 }}
        />
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
        <T variant="title">Look at you grow.</T>
        <T style={{ color: c.muted, textAlign: "center" }}>
          {preview === "1"
            ? "A lovely little practice. You’re ready."
            : "You showed up for today.\nThat’s a beautiful place to start."}
        </T>
      </Enter>
      <Quote text="Small, consistent steps create beautiful changes." />
      <Button
        title="Hello, new day"
        icon="arrow-forward"
        onPress={() => goHome()}
      />
    </Screen>
  );
}
