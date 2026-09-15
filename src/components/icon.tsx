import React from "react";
import { ColorValue } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { colors } from "@/theme";
export type IconName = React.ComponentProps<typeof Ionicons>["name"];
export function Icon({
  name,
  size = 22,
  color = colors.lavender,
}: {
  name: IconName;
  size?: number;
  color?: ColorValue;
}) {
  return (
    <Ionicons
      name={name}
      size={size}
      color={color}
      accessible={false}
      aria-hidden
    />
  );
}
