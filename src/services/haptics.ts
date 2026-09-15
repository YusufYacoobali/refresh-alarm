import { AppState, Platform } from "react-native";
import * as Haptics from "expo-haptics";

export type HapticKind = "selection" | "light" | "medium" | "success" | "warning" | "error";

/** Feedback never blocks an interaction or runs while the app is backgrounded. */
export function haptic(kind: HapticKind = "selection"): void {
  if (AppState.currentState && AppState.currentState !== "active") return;
  if (Platform.OS === "web" && typeof document !== "undefined" && document.hidden) return;
  try {
    let feedback: Promise<void>;
    if (Platform.OS === "android") {
      const effects = {
        selection: Haptics.AndroidHaptics.Clock_Tick,
        light: Haptics.AndroidHaptics.Context_Click,
        medium: Haptics.AndroidHaptics.Long_Press,
        success: Haptics.AndroidHaptics.Confirm,
        warning: Haptics.AndroidHaptics.Reject,
        error: Haptics.AndroidHaptics.Reject,
      };
      feedback = Haptics.performAndroidHapticsAsync(effects[kind]);
    } else if (kind === "selection") {
      feedback = Haptics.selectionAsync();
    } else if (kind === "light" || kind === "medium") {
      feedback = Haptics.impactAsync(kind === "light" ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium);
    } else {
      feedback = Haptics.notificationAsync({
        success: Haptics.NotificationFeedbackType.Success,
        warning: Haptics.NotificationFeedbackType.Warning,
        error: Haptics.NotificationFeedbackType.Error,
      }[kind]);
    }
    void feedback.catch(() => {});
  } catch {
    // Unsupported hardware or a missing native implementation must not break a tap.
  }
}

/** Use instead of a press pulse for actions whose feedback depends on persistence. */
export async function withHapticFeedback<T>(action: () => Promise<T>): Promise<T> {
  try {
    const result = await action();
    haptic("success");
    return result;
  } catch (error) {
    haptic("error");
    throw error;
  }
}
