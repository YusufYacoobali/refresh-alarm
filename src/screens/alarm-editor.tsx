import { goHome } from "@/utils/navigation";
import { withHapticFeedback } from "@/services/haptics";
import React, { useEffect, useState } from "react";
import { View, TextInput, Linking, Platform, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TimeWheel } from "@/components/time-wheel";
import { Image } from "expo-image";
import { pickWallpaper } from "@/services/wallpaper";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Screen, T, Button, Card, Row, Tap, Chip, Icon } from "@/components/ui";
import { useApp } from "@/state/app-state";
import { colors as c, fonts } from "@/theme";
import Animated, { FadeInDown, FadeOutUp, LinearTransition } from "react-native-reanimated";
import { easeOut, useMotion } from "@/components/motion";
import {
  dayNames,
  soundName,
  missionSummary,
  timeUntil,
  nextOccurrence,
} from "@/utils/alarms";

function TimeDial({ hour, minute, onChange }: { hour: number; minute: number; onChange(h: number, m: number): void }) {
  const { reduced } = useMotion();
  const { width } = useWindowDimensions();
  const size = Math.min(288, width - 48), center = size / 2, radius = center - 23;
  return <View testID="time-dial" style={{ width: size, height: size, alignSelf: "center", alignItems: "center", justifyContent: "center" }}>
    <View pointerEvents="none" style={{ position: "absolute", width: size - 28, height: size - 28, borderRadius: center - 14, borderWidth: 17, borderColor: "#26263F", boxShadow: "inset 3px 3px 9px #8E81BC55, 0 0 30px #BDB0F510" }} />
    {Array.from({ length: 30 }, (_, i) => {
      const angle = i / 30 * Math.PI * 2 - Math.PI / 2;
      return <Tap key={i} label={`Set minutes to ${String(i * 2).padStart(2, "0")}`} onPress={() => onChange(hour, i * 2)}
        style={{ position: "absolute", left: center + radius * Math.cos(angle) - 13, top: center + radius * Math.sin(angle) - 13 }}>
        <LinearGradient colors={i < 13 ? ["#F7D6B4", "#D69F9C", "#65587D"] : ["#585074", "#34324E", "#211F36"]}
          style={{ width: 26, height: 26, borderRadius: 13, boxShadow: "2px 3px 5px #05071580" }} />
      </Tap>;
    })}
    <Animated.View pointerEvents="none" style={{ position: "absolute", inset: 0, transform: [{ rotate: `${minute * 6}deg` }], transitionProperty: "transform", transitionDuration: reduced ? 0 : 350, transitionTimingFunction: easeOut }}>
      <LinearGradient colors={["#FFE6CF", "#BEA8E0", "#7864AF"]} style={{ position: "absolute", top: 7, left: center - 16, width: 32, height: 32, borderRadius: 16, boxShadow: "0 0 20px #DBB6DC66" }} />
    </Animated.View>
    <View style={{ width: 148, alignItems: "center", gap: 6 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
      <TimeWheel label="Hour" values={Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"))} value={(hour % 12 || 12) - 1} onChange={i => onChange(((i + 1) % 12) + (hour >= 12 ? 12 : 0), minute)} />
      <T style={{ fontSize: 25, lineHeight: 34, color: c.peach }}>:</T>
      <TimeWheel label="Minute" values={Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"))} value={minute} onChange={m => onChange(hour, m)} />
    </View>
    <View style={{ width: 104, flexDirection: "row", gap: 6 }}>
      {["AM", "PM"].map((period, i) => <Tap key={period} label={period} selected={Number(hour >= 12) === i} onPress={() => onChange(hour % 12 + i * 12, minute)} style={{ flex: 1 }}>
        <Animated.View style={{ height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: Number(hour >= 12) === i ? c.lavender : c.surface, transitionProperty: "backgroundColor", transitionDuration: reduced ? 0 : 180 }}>
          <T variant="small" style={{ color: Number(hour >= 12) === i ? c.ink : c.muted, fontFamily: fonts.bold }}>{period}</T>
        </Animated.View>
      </Tap>)}
    </View>
    </View>
  </View>;
}
export function AlarmEditor() {
  const { reduced } = useMotion();
  const { draft, edit, updateDraft, saveAlarm, deleteAlarm, data, busy, clearError } =
    useApp();
  const insets = useSafeAreaInsets();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [choosingPhoto, setChoosingPhoto] = useState(false);
  const [repeatOpen, setRepeatOpen] = useState(false),
    [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => {
    if (!draft) edit();
  }, []);
  if (!draft) return null;
  const exists = data.alarms.some((a) => a.id === draft.id);
  async function chooseWallpaper() {
    if (choosingPhoto) return;
    setChoosingPhoto(true);
    try {
      const wallpaper = await pickWallpaper();
      if (wallpaper) updateDraft({ wallpaper });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Couldn’t open your photos.");
    } finally { setChoosingPhoto(false); }
  }
  async function save() {
    setSaveError(null);
    clearError();
    try {
      await withHapticFeedback(() => saveAlarm({ ...draft!, enabled: true }));
      router.dismissTo({ pathname: "/(tabs)/alarms", params: { saved: draft!.id } });
    } catch (error) {
      clearError();
      setSaveError(error instanceof Error ? error.message : "Couldn’t save your alarm. Please try again.");
    }
  }
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
    <Screen style={{ gap: 16 }}>
      <View style={{ gap: 4 }}>
        <TimeDial
          hour={draft.hour}
          minute={draft.minute}
          onChange={(hour, minute) => updateDraft({ hour, minute })}
        />
        <T variant="small" style={{ color: c.muted, textAlign: "center" }}>
          {timeUntil(nextOccurrence(draft))} from now
        </T>
      </View>
      <Card>
        <Row
          icon="repeat-outline"
          title="Repeat"
          value={
            draft.days.length === 5 &&
            [1, 2, 3, 4, 5].every((d) => draft.days.includes(d))
              ? "Weekdays"
              : draft.days.length === 7
                ? "Every day"
                : draft.days.length
                  ? `${draft.days.length} days`
                  : "Once"
          }
          onPress={() => setRepeatOpen(!repeatOpen)}
        />
        {repeatOpen && (
          <Animated.View entering={reduced ? undefined : FadeInDown.duration(220)} exiting={reduced ? undefined : FadeOutUp.duration(160)} layout={reduced ? undefined : LinearTransition.duration(240)} style={{ padding: 16, gap: 14 }}>
            <View style={{ flexDirection: "row", gap: 5 }}>
              {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                <Tap
                  key={day}
                  selected={draft.days.includes(day)}
                  label={dayNames[day]}
                  onPress={() =>
                    updateDraft({
                      days: draft.days.includes(day)
                        ? draft.days.filter((d) => d !== day)
                        : [...draft.days, day],
                    })
                  }
                  style={{ flex: 1 }}
                >
                  <View
                    style={{
                      minHeight: 38,
                      borderRadius: 20,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: draft.days.includes(day)
                        ? c.lavender
                        : c.raised,
                    }}
                  >
                    <T
                      variant="small"
                      style={{
                        color: draft.days.includes(day) ? c.ink : c.muted,
                      }}
                    >
                      {dayNames[day][0]}
                    </T>
                  </View>
                </Tap>
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Chip
                title="Weekdays"
                active={false}
                onPress={() => updateDraft({ days: [1, 2, 3, 4, 5] })}
              />
              <Chip
                title="Every day"
                active={false}
                onPress={() => updateDraft({ days: [0, 1, 2, 3, 4, 5, 6] })}
              />
              <Chip
                title="Once"
                active={false}
                onPress={() => updateDraft({ days: [] })}
              />
            </View>
          </Animated.View>
        )}
        <Row icon="pricetag-outline" title="Label">
          <TextInput
            accessibilityLabel="Alarm label"
            value={draft.label}
            onChangeText={(label) => updateDraft({ label })}
            maxLength={48}
            returnKeyType="done"
            style={{
              fontFamily: fonts.regular,
              fontSize: 13,
              color: c.muted,
              textAlign: "right",
              flex: 1,
              minHeight: 34,
            }}
          />
        </Row>
        <Row
          icon="musical-notes-outline"
          title="Sound"
          value={soundName(draft.sound)}
          onPress={() =>
            router.push({ pathname: "/sounds", params: { editing: "1" } })
          }
        />
        <Row
          icon="extension-puzzle-outline"
          title="Wake-up missions"
          value={missionSummary(draft)}
          onPress={() =>
            router.push({ pathname: "/challenges", params: { editing: "1" } })
          }
        />
        <Row icon="image-outline" title="Alarm background" value={choosingPhoto ? "Opening photos…" : draft.wallpaper ? "Your photo" : "Choose a photo"} onPress={() => void chooseWallpaper()} />
        {draft.wallpaper && <View style={{ padding: 16, gap: 12 }}>
          <Image source={{ uri: draft.wallpaper }} contentFit="cover" style={{ height: 150, borderRadius: 16 }} accessibilityLabel="Selected alarm background" />
          <Tap label="Remove custom background" onPress={() => updateDraft({ wallpaper: undefined })}><T variant="small" style={{ color: c.lavender, textAlign: "center" }}>Use default artwork</T></Tap>
        </View>}
        <Row icon="time-outline" title="Snooze" value={draft.snooze === 0 ? "Off" : `${draft.snooze} minutes`} last />
        <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 18 }}>
          {[0, 5, 10, 15].map(minutes => <Chip key={minutes} title={minutes === 0 ? "Off" : `${minutes} min`} active={draft.snooze === minutes} onPress={() => updateDraft({ snooze: minutes })} />)}
        </View>
      </Card>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 8,
          paddingHorizontal: 8,
        }}
      >
        <Icon name="information-circle-outline" size={16} color={c.faint} />
        <T variant="small" style={{ color: c.faint, flex: 1 }}>
          {draft.sound === "system" ? "Uses your device’s default alarm sound." : `${soundName(draft.sound)} plays when this alarm rings.`}
        </T>
      </View>
      {exists && (
        <Tap haptic="medium" onPress={() => setConfirmDelete(!confirmDelete)}>
          <T variant="small" style={{ color: c.danger, textAlign: "center" }}>
            Delete alarm
          </T>
        </Tap>
      )}
      {confirmDelete && (
        <Card style={{ padding: 18, gap: 12 }}>
          <T>Delete this alarm and cancel its scheduled wake-up?</T>
          <Button
            title="Yes, delete alarm"
            haptic={false}
            loading={busy}
            onPress={() =>
              void withHapticFeedback(() => deleteAlarm(draft))
                .then(() => goHome("alarms"))
                .catch(() => {})
            }
          />
          <Tap onPress={() => setConfirmDelete(false)}>
            <T style={{ textAlign: "center" }}>Keep alarm</T>
          </Tap>
        </Card>
      )}
    </Screen>
    <View style={{ paddingHorizontal: 24, paddingTop: 14, paddingBottom: Math.max(insets.bottom, 18), gap: 10, backgroundColor: c.bg, borderTopWidth: 1, borderTopColor: c.line }}>
      {saveError && <View accessibilityLiveRegion="assertive" style={{ gap: 8 }}>
        <T style={{ color: c.danger }} testID="save-error">{saveError}</T>
        {Platform.OS !== "web" && saveError.includes("permission") && <Tap onPress={() => void Linking.openSettings()}><T style={{ color: c.lavender }}>Open device settings →</T></Tap>}
      </View>}
      <Button title={busy ? "Saving alarm…" : "Save alarm"} haptic={false} loading={busy} onPress={() => void save()} icon="checkmark" />
    </View>
    </View>
  );
}
