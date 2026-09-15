import type { RefObject } from "react";
import type { ScrollView } from "react-native";
import type { SharedValue } from "react-native-reanimated";

export type WheelInput = {
  scroll: RefObject<ScrollView | null>;
  row: number;
  count: number;
  reduced: boolean;
  interacting: SharedValue<boolean>;
};

// Native ScrollView owns touch tracking, deceleration, and snapping.
export function useWheelInput(_input: WheelInput) {}
