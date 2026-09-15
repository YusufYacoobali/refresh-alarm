import { router } from "expo-router";
import { Screen, T, Button } from "@/components/ui";
export default function NotFound() {
  return (
    <Screen>
      <T variant="title">A little off the path.</T>
      <T>Let’s get you back to your morning.</T>
      <Button title="Back to home" onPress={() => router.replace("/")} />
    </Screen>
  );
}
