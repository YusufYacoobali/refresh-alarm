import { Host, Switch } from "@expo/ui";
import { colors as c } from "@/theme";
import type { AlarmSwitchProps } from "./alarm-switch.types";

export function AlarmSwitch({ label, ...props }: AlarmSwitchProps) {
  return (
    <Host matchContents colorScheme="dark" seedColor={c.lavender}>
      <Switch {...props} accessibilityLabel={label} />
    </Host>
  );
}
