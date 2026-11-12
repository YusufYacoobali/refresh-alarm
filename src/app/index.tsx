import { Redirect } from "expo-router";
import { useApp } from "@/state/app-state";
import { useWakeHandoff, WakeHandoffError } from "@/components/wake-handoff-router";
import { Screen, T } from "@/components/ui";

export default function Index() {
  const { data, ready } = useApp();
  const { status } = useWakeHandoff();
  if (!ready) return null;
  if (status.state === "checking" || status.state === "pending") return <Screen safeTop>
    <T variant="heading">{status.state === "pending" ? "Opening your wake-up…" : "Checking your alarm…"}</T>
    <T>Your pending alarm is kept while we prepare your screen.</T>
  </Screen>;
  if (status.state === "error") return <Screen safeTop><WakeHandoffError /></Screen>;
  return <Redirect href={data.onboarded ? "/(tabs)/alarms" : "/onboarding"} />;
}
