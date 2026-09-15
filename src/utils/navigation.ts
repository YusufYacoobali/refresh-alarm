import { router } from "expo-router";
// Clear alarm / challenge routes so Back cannot return to a dismissed alarm.
export function goHome(tab: "home" | "alarms" = "home") {
  if (router.canDismiss()) router.dismissAll();
  router.replace(tab === "alarms" ? "/(tabs)/alarms" : "/(tabs)");
}
