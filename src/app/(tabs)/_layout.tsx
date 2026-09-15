import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/ui";
import { colors as c, fonts } from "@/theme";
export default function TabLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
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
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <Icon name="home-outline" color={color} size={23} />
          ),
        }}
      />
      <Tabs.Screen
        name="alarms"
        options={{
          title: "Alarms",
          tabBarIcon: ({ color }) => (
            <Icon name="alarm-outline" color={color} size={25} />
          ),
        }}
      />
      <Tabs.Screen
        name="sleep"
        options={{
          title: "Unwind",
          tabBarIcon: ({ color }) => (
            <Icon name="moon-outline" color={color} size={23} />
          ),
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: "Journal",
          tabBarIcon: ({ color }) => (
            <Icon name="book-outline" color={color} size={23} />
          ),
        }}
      />
    </Tabs>
  );
}
