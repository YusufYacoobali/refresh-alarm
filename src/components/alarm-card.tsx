import { View } from "react-native";
import { haptic } from "@/services/haptics";
import { AlarmSwitch } from "./alarm-switch";
import { router } from "expo-router";
import { Card, T, Tap, Icon } from "./ui";
import { colors as c, fonts } from "@/theme";
import {
  Alarm,
  displayTime,
  repeatLabel,
  challengeNames,
  alarmMissions,
} from "@/utils/alarms";
import { useApp } from "@/state/app-state";
export function AlarmCard({
  alarm,
  featured = false,
}: {
  alarm: Alarm;
  featured?: boolean;
}) {
  const { edit, saveAlarm, busy } = useApp();
  return (
    <Card
      style={{
        padding: 22,
        backgroundColor: featured ? "#25263F" : c.surface,
        borderColor: featured ? "#BDB0F52A" : "#FFFFFF0C",
        gap: 8,
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
                lineHeight: 65,
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
          label={`Enable ${alarm.label}`}
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
            {alarmMissions(alarm).length > 1 ? `${alarmMissions(alarm).length} missions` : alarmMissions(alarm)[0] ? challengeNames[alarmMissions(alarm)[0].kind] : "No missions"}
          </T>
        </View>
      </View>
    </Card>
  );
}
