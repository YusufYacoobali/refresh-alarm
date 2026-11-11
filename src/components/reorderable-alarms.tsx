import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, AppState } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  measure, scrollTo, useAnimatedReaction, useAnimatedRef, useAnimatedScrollHandler,
  useAnimatedStyle, useFrameCallback, useSharedValue, withSpring,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { AlarmCard } from "./alarm-card";
import { useMotion } from "./motion";
import { haptic } from "@/services/haptics";
import { Alarm, orderAlarms, alarmDisplayLabel } from "@/utils/alarms";
import { colors } from "@/theme";

const GAP = 16;
type DragState = {
  ids: string[];
  heights: Record<string, number>;
  active: string | null;
  top: number;
};
function topOf(ids: string[], heights: Record<string, number>, id: string) {
  "worklet";
  let y = 0;
  for (const item of ids) {
    if (item === id) return y;
    y += (heights[item] ?? 0) + GAP;
  }
  return y;
}

export function ReorderableAlarms({ alarms, busy, onReorder }: {
  alarms: Alarm[];
  busy: boolean;
  onReorder: (ids: string[]) => Promise<void>;
}) {
  const [pending, setPending] = useState<string[] | null>(null);
  const [dragging, setDragging] = useState(false);
  const [releaseBlocked, setReleaseBlocked] = useState(false);
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const displayed = useMemo(() => pending ? orderAlarms(alarms, pending) : alarms, [alarms, pending]);
  const ids = useMemo(() => displayed.map(a => a.id), [displayed]);
  const drag = useSharedValue<DragState>({ ids, heights: {}, active: null, top: 0 });
  const scroll = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useSharedValue(0);
  const startScroll = useSharedValue(0);
  const startTop = useSharedValue(0);
  const translation = useSharedValue(0);
  const pointerY = useSharedValue(0);
  const viewport = useSharedValue({ top: 0, height: 0 });
  const nativeScroll = useMemo(() => Gesture.Native(), []);
  const contentHeight = ids.reduce((sum, id) => sum + (heights[id] ?? 0) + GAP, 0);
  useEffect(() => () => { if (releaseTimer.current) clearTimeout(releaseTimer.current); }, []);

  useLayoutEffect(() => {
    drag.set({ ids, heights, active: null, top: 0 });
    setDragging(false);
  }, [ids, heights, drag]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", state => {
      if (state !== "active") {
        drag.set({ ids, heights, active: null, top: 0 });
        setDragging(false);
        setReleaseBlocked(false);
      }
    });
    return () => sub.remove();
  }, [ids, heights, drag]);

  useAnimatedReaction(
    () => ({ delta: translation.get() + scrollY.get() - startScroll.get(), active: drag.get().active }),
    ({ delta, active }, previous) => {
      if (!active) return;
      if (previous?.active === active && previous.delta === delta) return;
      const state = drag.get();
      const height = state.heights[active];
      const total = state.ids.reduce((sum, id) => sum + state.heights[id] + GAP, 0);
      const desiredTop = startTop.get() + delta;
      const top = Math.max(0, Math.min(desiredTop, total - height - GAP));
      // Keep the card inside the list, but let the finger cross either end's
      // midpoint so the first and last slots remain reachable.
      const center = desiredTop + height / 2;
      let y = 0, index = 0;
      for (const id of state.ids) {
        if (id !== active && center > y + state.heights[id] / 2) index++;
        y += state.heights[id] + GAP;
      }
      const next = state.ids.filter(id => id !== active);
      next.splice(index, 0, active);
      drag.set({ ...state, ids: next, top });
    },
  );
  useFrameCallback(({ timeSincePreviousFrame }) => {
    if (!drag.get().active || !viewport.get().height) return;
    const { top, height } = viewport.get();
    const localY = pointerY.get() - top;
    const direction = localY < 60 ? -1 : localY > height - 60 ? 1 : 0;
    if (!direction) return;
    const y = Math.max(0, Math.min(scrollY.get() + direction * Math.min(timeSincePreviousFrame ?? 16, 32) * .45,
      Math.max(0, contentHeight - height)));
    scrollY.set(y);
    scrollTo(scroll, 0, y, false);
  });
  const onScroll = useAnimatedScrollHandler(event => { scrollY.set(event.contentOffset.y); });
  function begin() {
    if (releaseTimer.current) clearTimeout(releaseTimer.current);
    setReleaseBlocked(true); setDragging(true); haptic("light");
  }
  async function finish(next: string[], moved: string, success: boolean) {
    setDragging(false);
    // A browser can deliver a click after pointer-up; it must not open the
    // newly placed card as the drag commits.
    releaseTimer.current = setTimeout(() => setReleaseBlocked(false), 250);
    if (!success || next.every((id, index) => id === ids[index])) {
      drag.set({ ids, heights, active: null, top: 0 });
      return;
    }
    setPending(next);
    try {
      await onReorder(next);
      haptic("light");
      const movedAlarm = alarms.find(a => a.id === moved);
      AccessibilityInfo.announceForAccessibility(`${movedAlarm ? alarmDisplayLabel(movedAlarm) : "Alarm"} moved to position ${next.indexOf(moved) + 1}`);
    } catch {
      haptic("error"); // The shared error layer reports failed saves.
    } finally { setPending(null); }
  }

  let y = 0;
  return <GestureDetector gesture={nativeScroll}>
    <Animated.ScrollView ref={scroll} onScroll={onScroll} scrollEventThrottle={16}
      style={{ flex: 1 }} contentContainerStyle={{ gap: GAP, paddingBottom: GAP }}
      showsVerticalScrollIndicator={false} scrollEnabled={!dragging} testID="alarm-list">
      {displayed.map(alarm => {
        const baseY = y;
        y += (heights[alarm.id] ?? 0) + GAP;
        return <DraggableAlarm key={alarm.id} alarm={alarm} baseY={baseY} drag={drag}
          disabled={busy || !!pending || ids.length < 2 || ids.some(id => !heights[id])}
          interactionDisabled={dragging || releaseBlocked || !!pending}
          onHeight={height => setHeights(previous => previous[alarm.id] === height ? previous : { ...previous, [alarm.id]: height })}
          onMove={direction => {
            const index = ids.indexOf(alarm.id), target = index + direction;
            if (target < 0 || target >= ids.length || busy || pending) return;
            const next = [...ids]; next.splice(index, 1); next.splice(target, 0, alarm.id);
            void finish(next, alarm.id, true);
          }}
          gesture={Gesture.Pan().enabled(!busy && !pending && ids.length > 1 && ids.every(id => !!heights[id]))
            .activateAfterLongPress(350).blocksExternalGesture(nativeScroll)
            .onStart(event => {
              const bounds = measure(scroll);
              if (bounds) viewport.set({ top: bounds.pageY, height: bounds.height });
              startScroll.set(scrollY.get()); startTop.set(baseY); translation.set(0); pointerY.set(event.absoluteY);
              drag.set({ ids, heights, active: alarm.id, top: baseY });
              scheduleOnRN(begin);
            })
            .onUpdate(event => { translation.set(event.translationY); pointerY.set(event.absoluteY); })
            .onFinalize((_event, success) => {
              if (drag.get().active !== alarm.id) return;
              const next = drag.get().ids;
              drag.set({ ...drag.get(), active: null });
              scheduleOnRN(finish, next, alarm.id, success);
            })}
        />;
      })}
    </Animated.ScrollView>
  </GestureDetector>;
}

function DraggableAlarm({ alarm, baseY, drag, disabled, interactionDisabled, gesture, onHeight, onMove }: {
  alarm: Alarm; baseY: number; drag: SharedValue<DragState>; disabled: boolean; interactionDisabled: boolean;
  gesture: ReturnType<typeof Gesture.Pan>; onHeight: (height: number) => void; onMove: (direction: number) => void;
}) {
  const { reduced } = useMotion();
  const style = useAnimatedStyle(() => {
    const state = drag.get(), active = state.active === alarm.id;
    const offset = (active ? state.top : topOf(state.ids, state.heights, alarm.id)) - baseY;
    return {
      zIndex: active ? 10 : 0,
      transform: [{ translateY: active || reduced ? offset : withSpring(offset, { duration: 400, dampingRatio: 1 }) },
        { scale: active && !reduced ? 1.025 : 1 }],
      outlineWidth: active ? 2 : 0,
      outlineColor: colors.lavender,
      outlineStyle: "solid",
    };
  });
  return <GestureDetector gesture={gesture} touchAction="pan-y">
    <Animated.View style={[{ borderRadius: 24 }, style]} testID={`alarm-record-${alarm.id}`}
      onLayout={event => onHeight(event.nativeEvent.layout.height)}>
      <AlarmCard alarm={alarm} interactionDisabled={interactionDisabled} onMove={disabled ? undefined : onMove} />
    </Animated.View>
  </GestureDetector>;
}
