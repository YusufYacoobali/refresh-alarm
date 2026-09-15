import { Redirect } from "expo-router";
import { useApp } from "@/state/app-state";
export default function Index() {
  const { data } = useApp();
  return <Redirect href={data.onboarded ? "/(tabs)" : "/onboarding"} />;
}
