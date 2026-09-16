import React, { useEffect, useState } from "react";
import { AppState, Linking } from "react-native";
import AndroidAlarm from "@/services/android-alarm";
import { Card, Row, T } from "./ui";
import { colors as c } from "@/theme";

export function AndroidAlarmSettings() {
  const [access, setAccess] = useState(() => AndroidAlarm?.permissions());
  useEffect(() => {
    const sub = AppState.addEventListener("change", state => { if (state === "active") setAccess(AndroidAlarm?.permissions()); });
    return () => sub.remove();
  }, []);
  if (!AndroidAlarm || !access) return null;
  return <Card>
    <Row icon="alarm-outline" title="Alarms & reminders" value={access.exact ? "Allowed" : "Enable"} onPress={() => void AndroidAlarm!.openSettings("exact").catch(() => Linking.openSettings())} />
    <Row icon="phone-portrait-outline" title="Lock-screen alarms" value={access.fullScreen ? "Allowed" : "Enable"} onPress={() => void AndroidAlarm!.openSettings("fullScreen").catch(() => Linking.openSettings())} />
    <Row icon="notifications-outline" title="Ringing alarm notifications" value={access.notifications && access.channel ? "Allowed" : "Enable"} onPress={() => void AndroidAlarm!.openSettings("channel").catch(() => Linking.openSettings())} last />
    <T variant="small" style={{ paddingHorizontal: 18, paddingBottom: 18, color: c.muted }}>Uses your phone’s alarm volume. Allow alarms in Do Not Disturb if you use it overnight.</T>
  </Card>;
}
