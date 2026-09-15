import { goHome } from "@/utils/navigation";
import React, { useEffect, useState } from "react";
import { View, TextInput, StyleSheet } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Screen, T, Button, Card, Row, Tap, Chip, Icon } from "@/components/ui";
import { useApp } from "@/state/app-state";
import { colors as c, fonts } from "@/theme";
import {
  dayNames,
  soundName,
  challengeNames,
  timeUntil,
  nextOccurrence,
} from "@/utils/alarms";

function TimeDial({
  hour,
  minute,
  onChange,
}: {
  hour: number;
  minute: number;
  onChange(h: number, m: number): void;
}) {
  const [hourText, setHourText] = useState(String(hour % 12 || 12)),
    [minuteText, setMinuteText] = useState(String(minute).padStart(2, "0"));
  const [focused, setFocused] = useState<"hour" | "minute" | null>(null);
  useEffect(() => {
    if (focused !== "hour") setHourText(String(hour % 12 || 12));
    if (focused !== "minute") setMinuteText(String(minute).padStart(2, "0"));
  }, [hour, minute, focused]);
  const commitHour = () => {
    const n = Number(hourText);
    if (Number.isInteger(n) && n >= 1 && n <= 12)
      onChange((n % 12) + (hour >= 12 ? 12 : 0), minute);
    else setHourText(String(hour % 12 || 12));
  };
  const commitMinute = () => {
    const n = Number(minuteText);
    if (Number.isInteger(n) && n >= 0 && n < 60) onChange(hour, n);
    else setMinuteText(String(minute).padStart(2, "0"));
  };
  return (
    <View
      style={{
        width: 248,
        height: 248,
        alignSelf: "center",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <View
        style={{
          position: "absolute",
          width: 220,
          height: 220,
          borderRadius: 110,
          borderWidth: 17,
          borderColor: "#26263F",
          boxShadow: "inset 3px 3px 9px #8E81BC55, 0 0 30px #BDB0F510",
        }}
      />
      {Array.from({ length: 30 }, (_, i) => {
        const a = (i / 30) * Math.PI * 2 - Math.PI / 2;
        const warm = i < 13;
        return (
          <Tap
            key={i}
            label={`Set minutes to ${String(i * 2).padStart(2, "0")}`}
            onPress={() => onChange(hour, i * 2)}
            style={{
              position: "absolute",
              left: 124 + 101 * Math.cos(a) - 12,
              top: 124 + 101 * Math.sin(a) - 12,
            }}
          >
            <LinearGradient
              colors={
                warm
                  ? ["#F7D6B4", "#D69F9C", "#65587D"]
                  : ["#585074", "#34324E", "#211F36"]
              }
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                boxShadow: "2px 3px 5px #05071580",
              }}
            />
          </Tap>
        );
      })}
      <LinearGradient
        colors={["#FFE6CF", "#BEA8E0", "#7864AF"]}
        style={{
          position: "absolute",
          top: 8,
          left: 108,
          width: 32,
          height: 32,
          borderRadius: 16,
          boxShadow: "0 0 20px #DBB6DC66",
        }}
      />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
        <TextInput
          accessibilityLabel="Alarm hour"
          selectTextOnFocus
          keyboardType="number-pad"
          maxLength={2}
          value={hourText}
          onFocus={() => setFocused("hour")}
          onChangeText={(text) => {
            setHourText(text);
            const n = Number(text);
            if (n >= 1 && n <= 12 && Number.isInteger(n))
              onChange((n % 12) + (hour >= 12 ? 12 : 0), minute);
          }}
          onBlur={() => {
            commitHour();
            setFocused(null);
          }}
          onSubmitEditing={commitHour}
          style={s.timeInput}
        />
        <T style={{ fontSize: 40, fontFamily: fonts.medium, marginTop: -5 }}>
          :
        </T>
        <TextInput
          accessibilityLabel="Alarm minute"
          selectTextOnFocus
          keyboardType="number-pad"
          maxLength={2}
          value={minuteText}
          onFocus={() => setFocused("minute")}
          onChangeText={(text) => {
            setMinuteText(text);
            const n = Number(text);
            if (text !== "" && n >= 0 && n < 60 && Number.isInteger(n))
              onChange(hour, n);
          }}
          onBlur={() => {
            commitMinute();
            setFocused(null);
          }}
          onSubmitEditing={commitMinute}
          style={s.timeInput}
        />
      </View>
      <View style={{ flexDirection: "row", gap: 8, width: 116, marginTop: 12 }}>
        <Chip
          title="AM"
          active={hour < 12}
          onPress={() => onChange(hour % 12, minute)}
        />
        <Chip
          title="PM"
          active={hour >= 12}
          onPress={() => onChange((hour % 12) + 12, minute)}
        />
      </View>
    </View>
  );
}
export function AlarmEditor() {
  const { draft, edit, updateDraft, saveAlarm, deleteAlarm, data, busy } =
    useApp();
  const [repeatOpen, setRepeatOpen] = useState(false),
    [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => {
    if (!draft) edit();
  }, []);
  if (!draft) return null;
  const exists = data.alarms.some((a) => a.id === draft.id);
  async function save() {
    await saveAlarm({ ...draft!, enabled: true });
    goHome("alarms");
  }
  return (
    <Screen style={{ gap: 16 }}>
      <View style={{ gap: 4 }}>
        <TimeDial
          hour={draft.hour}
          minute={draft.minute}
          onChange={(hour, minute) => updateDraft({ hour, minute })}
        />
        <T variant="small" style={{ color: c.muted, textAlign: "center" }}>
          Tap the time to edit · {timeUntil(nextOccurrence(draft))} from now
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
          <View style={{ padding: 16, gap: 14 }}>
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
          </View>
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
          title="Wake-up challenge"
          value={challengeNames[draft.challenge]}
          onPress={() =>
            router.push({ pathname: "/challenges", params: { editing: "1" } })
          }
        />
        <Row
          icon="time-outline"
          title="Snooze"
          value={`${draft.snooze} minutes`}
          onPress={() =>
            updateDraft({
              snooze: draft.snooze === 5 ? 10 : draft.snooze === 10 ? 15 : 5,
            })
          }
          last
        />
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
          Uses your device’s system sound for now. Your sound preference is
          saved for later.
        </T>
      </View>
      <Button
        title="Save alarm"
        onPress={() => void save().catch(() => {})}
        loading={busy}
      />
      {exists && (
        <Tap onPress={() => setConfirmDelete(!confirmDelete)}>
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
            loading={busy}
            onPress={() =>
              void deleteAlarm(draft)
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
  );
}
const s = StyleSheet.create({
  timeInput: {
    fontSize: 48,
    fontFamily: fonts.medium,
    color: c.text,
    textAlign: "center",
    width: 68,
    padding: 0,
    fontVariant: ["tabular-nums"],
  },
});
