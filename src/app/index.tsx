import { Redirect } from "expo-router";
import { useApp } from "@/state/app-state";
import { useWakeHandoff } from "@/components/wake-handoff-router";
import { Button, Screen, T } from "@/components/ui";

export default function Index() {
  const { data, ready } = useApp();
  const { status, retry } = useWakeHandoff();
  if (!ready || status.state === "checking" || status.state === "pending") return null;
  if (status.state === "error") return <Screen safeTop>
    <T variant="heading">Couldn’t check your wake-up.</T>
    <T>Your pending alarm is kept. Try again to resume it.</T>
    <Button title="Retry alarm handoff" onPress={retry} />
  </Screen>;
  return <Redirect href={data.onboarded ? "/(tabs)/alarms" : "/onboarding"} />;
}
