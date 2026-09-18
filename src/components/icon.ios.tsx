import React from "react";
import { ColorValue } from "react-native";
import type Ionicons from "@expo/vector-icons/Ionicons";
import { SymbolView, SymbolViewProps } from "expo-symbols";
import { colors } from "@/theme";
export type IconName = React.ComponentProps<typeof Ionicons>["name"];
const symbols: Partial<Record<IconName, SymbolViewProps["name"]>> = {
  "sunny-outline": "sun.max",
  "moon-outline": "moon",
  "home-outline": "house",
  "alarm-outline": "alarm",
  "copy-outline": "doc.on.doc",
  "trash-outline": "trash",
  "ellipsis-horizontal": "ellipsis",
  "ellipsis-vertical": "ellipsis",
  "book-outline": "book.closed",
  add: "plus",
  checkmark: "checkmark",
  "checkmark-circle": "checkmark.circle.fill",
  "ellipse-outline": "circle",
  close: "xmark",
  "close-circle-outline": "xmark.circle",
  "arrow-forward": "arrow.right",
  "chevron-forward": "chevron.right",
  "sparkles-outline": "sparkles",
  "options-outline": "slider.horizontal.3",
  "color-palette-outline": "paintpalette",
  "play-circle-outline": "play.circle",
  "extension-puzzle-outline": "puzzlepiece.extension",
  "repeat-outline": "repeat",
  "pricetag-outline": "tag",
  "musical-notes-outline": "music.note",
  "time-outline": "clock",
  "information-circle-outline": "info.circle",
  "phone-portrait-outline": "iphone",
  "volume-mute-outline": "speaker.slash",
  "calculator-outline": "plus.forwardslash.minus",
  "grid-outline": "square.grid.2x2",
  "partly-sunny-outline": "cloud.sun",
  "cloud-outline": "cloud",
  "notifications-outline": "bell",
};
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
    <SymbolView
      name={symbols[name] ?? "circle"}
      size={size}
      tintColor={color}
      style={{ width: size, height: size, ...(name === "ellipsis-vertical" ? { transform: [{ rotate: "90deg" }] } : {}) }}
      accessible={false}
    />
  );
}
