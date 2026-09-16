import { Redirect } from "expo-router";
import { useApp } from "@/state/app-state";
import AndroidAlarm from "@/services/android-alarm";
export default function Index() {
  const { data } = useApp();
  const active = AndroidAlarm?.activeAlarm();
  if (active && data.alarms.some(a => a.id === active.alarmId))
    return <Redirect href={{ pathname: "/ringing", params: { id: active.alarmId, eventId: active.eventId } }} />;
  return <Redirect href={data.onboarded ? "/(tabs)" : "/onboarding"} />;
}
