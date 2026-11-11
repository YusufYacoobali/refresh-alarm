import type { StyleProp, ViewStyle } from "react-native";
export const motionSources = {
  sun: require("../../assets/motion/wake-sun.json"),
  math: require("../../assets/motion/math-friend.json"),
  memory: require("../../assets/motion/memory-friends.json"),
  shake: require("../../assets/motion/shake-friend.json"),
  number_order: require("../../assets/motion/mission-number-trail.json"),
  color_focus: require("../../assets/motion/mission-tile-recall.json"),
  sequence: require("../../assets/motion/mission-pattern-echo.json"),
  supplication: require("../../assets/motion/mission-duas.json"),
  fajr_reminder: require("../../assets/motion/mission-fajr.json"),
  bloom: require("../../assets/motion/morning-bloom.json"),
  stars: require("../../assets/motion/stardust.json"),
  moon: require("../../assets/motion/moon-cradle.json"),
  sunrise: require("../../assets/motion/dawn-garden.json"),
  clock: require("../../assets/motion/cloud-clock.json"),
  buttonStarlight: require("../../assets/motion/button-starlight.json"),
  buttonSunrise: require("../../assets/motion/button-sunrise.json"),
  buttonMatch: require("../../assets/motion/button-match.json"),
  buttonBell: require("../../assets/motion/button-bell.json"),
};
export type ClayMotionProps = {
  name: keyof typeof motionSources;
  size?: number;
  loop?: boolean;
  playing?: boolean;
  revision?: number;
  style?: StyleProp<ViewStyle>;
};
