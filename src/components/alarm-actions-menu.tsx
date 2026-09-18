import { View } from "react-native";
import { MenuView } from "@expo/ui/community/menu";
import { Icon } from "./icon";
import { colors } from "@/theme";

export type AlarmActionsMenuProps = {
  label: string;
  disabled: boolean;
  onDuplicate: () => void;
  onDelete: () => void;
};

export function AlarmActionsMenu({ label, disabled, onDuplicate, onDelete }: AlarmActionsMenuProps) {
  return (
    <View pointerEvents={disabled ? "none" : "auto"} style={{ opacity: disabled ? 0.45 : 1 }}>
      <MenuView
        shouldOpenOnLongPress={false}
        actions={[
          { id: "duplicate", title: "Duplicate", image: "doc.on.doc", attributes: { disabled } },
          { id: "delete", title: "Delete", image: "trash", attributes: { destructive: true, disabled } },
        ]}
        onPressAction={({ nativeEvent }) => {
          if (disabled) return;
          if (nativeEvent.event === "duplicate") onDuplicate();
          if (nativeEvent.event === "delete") onDelete();
        }}
      >
        <View accessibilityLabel={`More options for ${label}`} accessibilityRole="button"
          style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
          <Icon name="ellipsis-vertical" size={21} color={colors.muted} />
        </View>
      </MenuView>
    </View>
  );
}
