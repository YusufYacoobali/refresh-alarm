import { useRef, useState } from "react";
import { View } from "react-native";
import { haptic, withHapticFeedback } from "@/services/haptics";
import { AlarmSwitch } from "./alarm-switch";
import { router } from "expo-router";
import { Card, T, Tap, Icon } from "./ui";
import { colors as c, fonts } from "@/theme";
import {
  Alarm,
  displayTime,
  repeatLabel,
  alarmMissions,
  missionLabel,
} from "@/utils/alarms";
import { useApp } from "@/state/app-state";
export function AlarmCard({
  alarm,
  featured = false,
}: {
  alarm: Alarm;
  featured?: boolean;
}) {
  const { edit, saveAlarm, duplicateAlarm, deleteAlarm, busy } = useApp();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const acting = useRef(false);
  async function act(action: () => Promise<void>) {
    if (acting.current || busy) return;
    acting.current = true;
    try { await withHapticFeedback(action); } catch { /* Shared error layer offers retry. */ }
    finally { acting.current = false; }
  }
  return (
    <Card
      style={{
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: featured ? "#25263F" : c.surface,
        borderColor: featured ? "#BDB0F52A" : "#FFFFFF0C",
        gap: 4,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Tap
          onPress={() => {
            edit(alarm);
            router.push("/alarm");
          }}
          label={`Edit ${alarm.label} at ${displayTime(alarm)}`}
          style={{ flex: 1 }}
          disabled={busy}
        >
          <T variant="small" style={{ color: featured ? c.lavender : c.muted }}>
            {featured ? "YOUR NEXT ALARM" : alarm.label}
          </T>
          <View
            style={{
              flexDirection: "row",
              alignItems: "baseline",
              gap: 7,
              opacity: alarm.enabled ? 1 : 0.6,
            }}
          >
            <T
              style={{
                fontFamily: fonts.medium,
                fontSize: 49,
                lineHeight: 58,
                letterSpacing: -1.5,
                fontVariant: ["tabular-nums"],
              }}
            >
              {displayTime(alarm)}
            </T>
            <T variant="label">{alarm.hour < 12 ? "AM" : "PM"}</T>
          </View>
        </Tap>
        <View style={{ alignItems: "flex-end" }}>
          <AlarmSwitch
          value={alarm.enabled}
          onValueChange={(value) =>
            void saveAlarm({ ...alarm, enabled: value }).catch(() => haptic("error"))
          }
          disabled={busy}
          label={`Enable ${alarm.label}`}
          testID={`toggle-${alarm.id}`}
          />
          <View style={{ flexDirection: "row" }}>
            <Tap label={`Duplicate ${alarm.label}`} disabled={busy} haptic={false}
              onPress={() => { setConfirmDelete(false); void act(() => duplicateAlarm(alarm)); }}>
              <View style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
                <Icon name="copy-outline" size={18} color={c.muted} />
              </View>
            </Tap>
            <Tap label={`Delete ${alarm.label}`} disabled={busy} haptic="medium"
              onPress={() => setConfirmDelete(true)}>
              <View style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
                <Icon name="trash-outline" size={18} color={c.danger} />
              </View>
            </Tap>
          </View>
        </View>
      </View>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          gap: 8,
          alignItems: "center",
        }}
      >
        <T variant="small" style={{ color: c.muted, flex: 1 }}>
          {repeatLabel(alarm.days)}
        </T>
        <View style={{ flexDirection: "row", gap: 5, alignItems: "center" }}>
          <Icon
            name={
              alarmMissions(alarm).length === 0
                ? "sunny-outline"
                : "extension-puzzle-outline"
            }
            size={13}
            color={c.lavender}
          />
          <T variant="small" style={{ color: c.lavender, fontSize: 10 }}>
            {alarmMissions(alarm).length > 1 ? `${alarmMissions(alarm).length} missions` : alarmMissions(alarm)[0] ? missionLabel(alarmMissions(alarm)[0]) : "No missions"}
          </T>
        </View>
      </View>
      {confirmDelete && <View style={{ marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.line, gap: 8 }}>
        <T variant="small" accessibilityLiveRegion="polite">Delete “{alarm.label}” and cancel its scheduled alarm?</T>
        <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 12 }}>
          <Tap label={`Keep ${alarm.label}`} disabled={busy} onPress={() => setConfirmDelete(false)}>
            <View style={{ minHeight: 44, paddingHorizontal: 12, justifyContent: "center" }}><T variant="label">Keep alarm</T></View>
          </Tap>
          <Tap label={`Confirm delete ${alarm.label}`} disabled={busy} haptic={false} onPress={() => void act(() => deleteAlarm(alarm))}>
            <View style={{ minHeight: 44, paddingHorizontal: 12, justifyContent: "center" }}><T variant="label" style={{ color: c.danger }}>Delete</T></View>
          </Tap>
        </View>
      </View>}
    </Card>
  );
}
