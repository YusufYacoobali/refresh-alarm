import { useRef, useState } from "react";
import { View } from "react-native";
import { haptic, withHapticFeedback } from "@/services/haptics";
import { AlarmSwitch } from "./alarm-switch";
import { AlarmActionsMenu } from "./alarm-actions-menu";
import { router } from "expo-router";
import { Card, T, Tap, Icon } from "./ui";
import { colors as c, fonts } from "@/theme";
import {
  Alarm,
  displayTime,
  repeatLabel,
  alarmMissions,
  missionLabel,
  ALARM_NAMING_ENABLED,
  alarmDisplayLabel,
} from "@/utils/alarms";
import { useApp } from "@/state/app-state";
export function AlarmCard({
  alarm,
  featured = false,
  interactionDisabled = false,
  onMove,
}: {
  alarm: Alarm;
  featured?: boolean;
  interactionDisabled?: boolean;
  onMove?: (direction: number) => void;
}) {
  const { edit, saveAlarm, duplicateAlarm, deleteAlarm, busy: saving } = useApp();
  const busy = saving || interactionDisabled;
  const description = alarmDisplayLabel(alarm);
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
          label={`Edit ${description}`}
          accessibilityActions={onMove ? [{ name: "moveUp", label: "Move alarm up" }, { name: "moveDown", label: "Move alarm down" }] : undefined}
          onAccessibilityAction={event => {
            if (event.nativeEvent.actionName === "moveUp") onMove?.(-1);
            if (event.nativeEvent.actionName === "moveDown") onMove?.(1);
          }}
          style={{ flex: 1 }}
          disabled={busy}
        >
          {(featured || ALARM_NAMING_ENABLED) && <T variant="small" style={{ color: featured ? c.lavender : c.muted }}>
            {featured ? "YOUR NEXT ALARM" : alarm.label}
          </T>}
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
        <AlarmSwitch
          value={alarm.enabled}
          onValueChange={(value) =>
            void saveAlarm({ ...alarm, enabled: value }).catch(() => haptic("error"))
          }
          disabled={busy}
          label={`Enable ${description}`}
          testID={`toggle-${alarm.id}`}
        />
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
          <AlarmActionsMenu label={description} disabled={busy}
            onPreview={() => {
              setConfirmDelete(false);
              haptic("light");
              router.push({ pathname: "/ringing", params: { id: alarm.id, preview: "1" } });
            }}
            onDuplicate={() => { setConfirmDelete(false); void act(() => duplicateAlarm(alarm)); }}
            onDelete={() => { haptic("medium"); setConfirmDelete(true); }} />
        </View>
      </View>
      {confirmDelete && <View style={{ marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.line, gap: 8 }}>
        <T variant="small" accessibilityLiveRegion="polite">Delete {description} and cancel its scheduled alarm?</T>
        <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 12 }}>
          <Tap label={`Keep ${description}`} disabled={busy} onPress={() => setConfirmDelete(false)}>
            <View style={{ minHeight: 44, paddingHorizontal: 12, justifyContent: "center" }}><T variant="label">Keep alarm</T></View>
          </Tap>
          <Tap label={`Confirm delete ${description}`} disabled={busy} haptic={false} onPress={() => void act(() => deleteAlarm(alarm))}>
            <View style={{ minHeight: 44, paddingHorizontal: 12, justifyContent: "center" }}><T variant="label" style={{ color: c.danger }}>Delete</T></View>
          </Tap>
        </View>
      </View>}
    </Card>
  );
}
