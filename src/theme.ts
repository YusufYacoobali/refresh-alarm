import { TextStyle } from "react-native";

// The deliberately dark, fixed art direction matches the supplied reference.
export const colors = {
  bg: "#090C18",
  surface: "#191D30",
  raised: "#24263E",
  line: "#33364E",
  text: "#F8F3EF",
  muted: "#B3B2CA",
  faint: "#797D9C",
  lavender: "#BDB0F5",
  peach: "#F8CEAF",
  lilac: "#8D7CD6",
  green: "#B7D2B0",
  danger: "#F3A5AE",
  ink: "#222036",
  transparent: "transparent",
  white: "#FFFFFF",
};
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  huge: 48,
};
export const radius = { sm: 12, md: 20, lg: 28, full: 999 };
export const fonts = {
  regular: "NunitoRegular",
  medium: "NunitoSemiBold",
  bold: "NunitoBold",
  heavy: "NunitoExtraBold",
};
export const type = {
  title: {
    fontFamily: fonts.bold,
    fontSize: 30,
    lineHeight: 37,
    letterSpacing: -0.8,
  },
  heading: {
    fontFamily: fonts.bold,
    fontSize: 22,
    lineHeight: 29,
    letterSpacing: -0.3,
  },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 23 },
  label: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 18 },
  eyebrow: {
    fontFamily: fonts.bold,
    fontSize: 10,
    lineHeight: 16,
    letterSpacing: 2,
  },
} satisfies Record<string, TextStyle>;
export const art = {
  home: require("../assets/art/home.png"),
  moon: require("../assets/art/moon.png"),
  valley: require("../assets/art/valley.png"),
  alarmValley: require("../assets/art/valley-no-sun.png"),
  sounds: require("../assets/art/sounds.png"),
};
