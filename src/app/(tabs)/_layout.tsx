import { Tabs } from "expo-router";
import { haptic } from "@/services/haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/ui";
import { colors as c, fonts } from "@/theme";
import Animated from "react-native-reanimated";
import { useMotion, easeOut } from "@/components/motion";
import type { IconName } from "@/components/ui";
import type { ColorValue } from "react-native";

function TabIcon({ name, color, focused, size = 23 }: { name: IconName; color: ColorValue; focused: boolean; size?: number }) {
  const { reduced } = useMotion();
  return <Animated.View style={{
    transform: [{ translateY: focused && !reduced ? -3 : 0 }, { scale: focused && !reduced ? 1.12 : 1 }],
    transitionProperty: "transform", transitionDuration: reduced ? 0 : 200, transitionTimingFunction: easeOut,
  }}><Icon name={name} color={color} size={size} /></Animated.View>;
}
export default function TabLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      initialRouteName="alarms"
      screenListeners={{ tabPress: () => haptic("selection") }}
      screenOptions={{
        headerShown: false,
        animation: "none",
        tabBarActiveTintColor: c.lavender,
        tabBarInactiveTintColor: c.faint,
        tabBarLabelStyle: {
          fontFamily: fonts.bold,
          fontSize: 10,
          marginTop: 4,
        },
        tabBarStyle: {
          backgroundColor: c.surface,
          borderTopWidth: 1,
          borderTopColor: "#FFFFFF0C",
          height: 76 + Math.max(insets.bottom, 8),
          paddingTop: 12,
          paddingBottom: Math.max(insets.bottom, 12),
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
        },
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="home-outline" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="alarms"
        options={{
          title: "Alarms",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="alarm-outline" color={color} focused={focused} size={25} />
          ),
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: "Journal",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="book-outline" color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
