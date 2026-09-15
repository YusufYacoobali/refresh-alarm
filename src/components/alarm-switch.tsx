import { Host, Switch } from "@expo/ui";
import { haptic } from "@/services/haptics";
import { colors as c } from "@/theme";
import type { AlarmSwitchProps } from "./alarm-switch.types";

export function AlarmSwitch({ label, ...props }: AlarmSwitchProps) {
  const change = (value: boolean) => {
    if (props.disabled || value === props.value) return;
    haptic("light");
    props.onValueChange(value);
  };
  return (
    <Host
      matchContents
      colorScheme="dark"
      seedColor={c.lavender}
      accessible
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: props.value, disabled: props.disabled }}
      onAccessibilityTap={() => {
        change(!props.value);
      }}
    >
      <Switch {...props} onValueChange={change} />
    </Host>
  );
}
