import React from "react";
import { Host } from "@expo/ui";
import { AlertDialog, Text, TextButton } from "@expo/ui/jetpack-compose";
import { verticalScroll } from "@expo/ui/jetpack-compose/modifiers";
import { colors as c } from "@/theme";
import type { AppBlockDisclosureProps } from "./app-block-disclosure";

export function AppBlockDisclosure({ onAgree, onDecline }: AppBlockDisclosureProps) {
  // AlertDialog owns its native window; the bridge must not measure a dialog
  // against an expanding/clipped card or an unbounded ScrollView.
  return <Host style={{ width: 1, height: 1 }} colorScheme="dark" seedColor={c.lavender}>
    <AlertDialog onDismissRequest={onDecline}
      properties={{ dismissOnBackPress: true, dismissOnClickOutside: true }}
      colors={{ containerColor: c.surface, titleContentColor: c.text, textContentColor: c.text }}>
      <AlertDialog.Title><Text>Enable App Blocking</Text></AlertDialog.Title>
      <AlertDialog.Text>
        <Text modifiers={[verticalScroll()]}>{"Refresh uses Android’s Accessibility Service to detect which app is open by accessing its app identifier. This lets Refresh cover apps you selected during the blocking period that starts when your alarm rings.\n\nAccessibility access is used only for app blocking. App activity is processed on your device and is not stored or shared. Refresh does not read screen content.\n\nDo you agree to this use of Accessibility Service?"}</Text>
      </AlertDialog.Text>
      <AlertDialog.DismissButton>
        <TextButton onClick={onDecline} colors={{ contentColor: c.lavender }}><Text>No thanks</Text></TextButton>
      </AlertDialog.DismissButton>
      <AlertDialog.ConfirmButton>
        <TextButton onClick={onAgree} colors={{ contentColor: c.lavender }}><Text>Agree</Text></TextButton>
      </AlertDialog.ConfirmButton>
    </AlertDialog>
  </Host>;
}
