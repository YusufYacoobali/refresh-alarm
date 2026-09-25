import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Icon, type IconName, T, Tap } from "./ui";
import { useMotion } from "./motion";
import { colors as c } from "@/theme";
import { haptic } from "@/services/haptics";
import type { Mission } from "@/utils/alarms";

type Props = { difficulty: Mission["difficulty"]; onDone(): void };
function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Equal-height rows fill the space left by the mission header, on every phone.
function Board({ children, columns = 2, gap = 12 }: { children: React.ReactNode[]; columns?: number; gap?: number }) {
  return <View testID="mission-board" style={{ flex: 1, minHeight: 0, gap }}>
    {Array.from({ length: Math.ceil(children.length / columns) }, (_, row) =>
      <View key={row} style={{ flex: 1, flexDirection: "row", gap }}>
        {children.slice(row * columns, (row + 1) * columns)}
      </View>)}
  </View>;
}
function Pad({ label, children, lit = false, disabled = false, color = c.lavender, radius = 26, onPress }: {
  label: string; children: React.ReactNode; lit?: boolean; disabled?: boolean; color?: string; radius?: number; onPress(): void;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ disabled, selected: lit }} aria-pressed={lit} disabled={disabled}
    onPress={onPress} style={({ pressed }) => ({ flex: 1, minHeight: 44, borderRadius: radius,
      alignItems: "center", justifyContent: "center", borderWidth: 2,
      borderColor: lit ? c.text : pressed ? color : `${color}50`,
      backgroundColor: lit ? color : pressed ? `${color}40` : `${color}16`,
      boxShadow: lit ? `0 0 24px ${color}50` : "none" })}>
    {children}
  </Pressable>;
}
function Dots({ value, total, compact = false }: { value: number; total: number; compact?: boolean }) {
  return <View accessibilityLabel={`${value} of ${total} completed`} style={{ flexDirection: "row", gap: compact ? 4 : 7 }}>
    {Array.from({ length: total }, (_, i) => <View key={i} style={{ width: compact ? 5 : 7, height: compact ? 5 : 7, borderRadius: 4, backgroundColor: i < value ? c.peach : c.line }} />)}
  </View>;
}

export function NumberTrail({ difficulty, onDone }: Props) {
  const hard = difficulty === "bright", total = hard ? 12 : 8;
  const [numbers] = useState(() => shuffled(Array.from({ length: total }, (_, i) => i + 1)));
  const [count, setCount] = useState(0), [wrong, setWrong] = useState(false);
  const progress = useRef(0);
  const expected = hard ? total - count : count + 1;
  function choose(value: number) {
    if (progress.current >= total) return;
    if (value !== (hard ? total - progress.current : progress.current + 1)) {
      setWrong(true); haptic("error"); return;
    }
    progress.current++;
    setCount(progress.current); setWrong(false);
    if (progress.current === total) onDone(); else haptic("success");
  }
  return <View style={{ flex: 1, gap: 14 }}>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <T accessibilityLiveRegion="polite" variant="heading" style={{ color: wrong ? c.peach : c.text }}>Tap {expected}</T>
      <Dots value={count} total={total} />
    </View>
    <Board columns={hard ? 3 : 2}>{numbers.map(n => {
      const found = hard ? n > expected : n < expected;
      return <Pad key={n} label={`Number ${n}`} disabled={found} onPress={() => choose(n)} color={found ? c.green : c.lavender}>
        <T numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 36, lineHeight: 48, alignSelf: "stretch", textAlign: "center", paddingHorizontal: 8, color: found ? c.green : c.text }}>{found ? "✓" : n}</T>
      </Pad>;
    })}</Board>
  </View>;
}

const shapes: { name: string; icon: IconName; color: string }[] = [
  { name: "Circle", icon: "ellipse", color: c.peach },
  { name: "Diamond", icon: "diamond", color: c.lavender },
  { name: "Triangle", icon: "triangle", color: c.green },
  { name: "Square", icon: "square", color: c.lavender },
  { name: "Star", icon: "star", color: c.peach },
  { name: "Moon", icon: "moon", color: c.green },
];
// Keep the stored color_focus ID so existing alarms automatically get the new game.
export function TileRecall({ difficulty, onDone }: Props) {
  const hard = difficulty === "bright", columns = hard ? 6 : 4, total = columns * columns;
  const targetCount = hard ? 8 : 3;
  const [targets] = useState(() => shuffled(Array.from({ length: total }, (_, i) => i)).slice(0, targetCount));
  const [phase, setPhase] = useState<"watch" | "recall">("watch");
  const [found, setFound] = useState<number[]>([]), [replay, setReplay] = useState(0);
  const [focused, setFocused] = useState(false);
  const { active } = useMotion();
  const chosen = useRef(new Set<number>()), accepting = useRef(false), done = useRef(false);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  useEffect(() => {
    accepting.current = false;
    chosen.current.clear(); setFound([]); setPhase("watch");
    if (!active || !focused || done.current) return;
    // All target locations are visible together for exactly two seconds.
    const timer = setTimeout(() => { setPhase("recall"); accepting.current = true; }, 2000);
    return () => { clearTimeout(timer); accepting.current = false; };
  }, [active, focused, replay]);
  function choose(tile: number) {
    if (!accepting.current || done.current || chosen.current.has(tile)) return;
    if (!targets.includes(tile)) {
      accepting.current = false; setReplay(n => n + 1); haptic("error"); return;
    }
    chosen.current.add(tile); setFound([...chosen.current]);
    if (chosen.current.size === targets.length) {
      done.current = true; accepting.current = false; onDone();
    } else haptic("success");
  }
  return <View style={{ flex: 1, gap: 12 }}>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: 40 }}>
      <T testID="recall-phase" accessibilityLiveRegion="polite" variant="label" style={{ color: c.peach, flexShrink: 1 }}>{phase === "watch" ? "Remember these tiles" : `Find the ${targetCount} tiles`}</T>
      <Dots value={found.length} total={targetCount} compact={hard} />
      <Tap label="Show tiles again" disabled={phase === "watch"} onPress={() => { accepting.current = false; setReplay(n => n + 1); }}>
        <View style={{ padding: 8 }}><Icon name="refresh-outline" /></View>
      </Tap>
    </View>
    <Board columns={columns} gap={hard ? 6 : 12}>{Array.from({ length: total }, (_, tile) => {
      const matched = found.includes(tile);
      const highlighted = phase === "watch" && focused && active && targets.includes(tile);
      return <Pad key={tile} label={`Tile ${tile + 1}`} lit={highlighted || matched} radius={hard ? 14 : 22}
        disabled={phase === "watch" || matched} color={matched ? c.green : c.lavender} onPress={() => choose(tile)}>{null}</Pad>;
    })}</Board>
  </View>;
}

export function PatternEcho({ difficulty, onDone }: Props) {
  const [sequence] = useState(() => shuffled([0, 1, 2, 3, 4, 5]).slice(0, difficulty === "bright" ? 6 : 4));
  const [phase, setPhase] = useState<"watch" | "repeat">("watch");
  const [lit, setLit] = useState<number | null>(null), [count, setCount] = useState(0), [replay, setReplay] = useState(0);
  const [focused, setFocused] = useState(false);
  const { active } = useMotion();
  const progress = useRef(0), done = useRef(false), accepting = useRef(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  useEffect(() => {
    accepting.current = false;
    setPhase("watch"); setLit(null); setCount(0); progress.current = 0;
    clearTimeout(pressTimer.current);
    if (!active || !focused || done.current) return;
    // Slow, discrete highlights are gameplay cues; no strobing or motion is needed.
    const timers: ReturnType<typeof setTimeout>[] = [];
    sequence.forEach((tile, i) => {
      timers.push(setTimeout(() => setLit(tile), 500 + i * 1100));
      timers.push(setTimeout(() => setLit(null), 1300 + i * 1100));
    });
    timers.push(setTimeout(() => { setPhase("repeat"); accepting.current = true; }, 500 + sequence.length * 1100));
    return () => { timers.forEach(clearTimeout); clearTimeout(pressTimer.current); accepting.current = false; };
  }, [sequence, replay, active, focused]);
  function choose(tile: number) {
    if (!accepting.current || done.current) return;
    if (tile !== sequence[progress.current]) {
      accepting.current = false; setReplay(n => n + 1); haptic("error"); return;
    }
    clearTimeout(pressTimer.current); setLit(tile);
    pressTimer.current = setTimeout(() => setLit(null), 220);
    progress.current++; setCount(progress.current);
    if (progress.current === sequence.length) { done.current = true; accepting.current = false; onDone(); }
    else haptic("success");
  }
  return <View style={{ flex: 1, gap: 12 }}>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: 40 }}>
      <T testID="pattern-phase" accessibilityLiveRegion="polite" variant="label" style={{ color: c.peach }}>{phase === "watch" ? "Watch the lights" : "Your turn"}</T>
      <Dots value={count} total={sequence.length} />
      <Tap label="Replay pattern" disabled={phase === "watch"} onPress={() => { accepting.current = false; setReplay(n => n + 1); }}>
        <View style={{ padding: 8 }}><Icon name="refresh-outline" /></View>
      </Tap>
    </View>
    <Board>{shapes.map((shape, i) => <Pad key={i} label={`Pad ${i + 1}`} lit={lit === i} disabled={phase === "watch"} color={shape.color} onPress={() => choose(i)}>
      <Icon name={shape.icon} size={52} color={lit === i ? c.ink : shape.color} />
    </Pad>)}</Board>
  </View>;
}
