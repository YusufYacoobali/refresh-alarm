import { Switch } from "react-native";
import { haptic } from "@/services/haptics";
import { colors as c } from "@/theme";
import type { AlarmSwitchProps } from "./alarm-switch.types";

// Expo UI's web switch cannot supply a hidden accessible label yet.
export function AlarmSwitch({ label, ...props }: AlarmSwitchProps) {
  return (
    <Switch
      {...props}
      onValueChange={(value) => {
        if (props.disabled || value === props.value) return;
        haptic("light");
        props.onValueChange(value);
      }}
      accessibilityLabel={label}
      trackColor={{ false: c.surface, true: c.lavender }}
      thumbColor="#FFFFFF"
      {...{ activeThumbColor: "#FFFFFF" }}
      style={{ height: 28, width: 56 }}
    />
  );
}
