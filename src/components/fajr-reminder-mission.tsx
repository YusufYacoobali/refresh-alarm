import React, { useRef } from "react";
import { View } from "react-native";
import { Link } from "expo-router";
import { Button, T } from "./ui";
import { WithHonorific } from "./supplication-mission";
import { fajrReminders, fajrReminderIndex } from "@/utils/fajr-reminders";
import { colors as c, fonts } from "@/theme";

export function FajrReminderMission({ index, isExpired, onDone }: {
  index: number; isExpired(): boolean; onDone(): void;
}) {
  const position = fajrReminderIndex(index), hadith = fajrReminders[position];
  const done = useRef(false);
  return <View style={{ gap: 20 }}>
    <T variant="small" style={{ color: c.peach }}>Reminder {position + 1} of {fajrReminders.length}</T>
    <T testID="hadith-arabic" selectable accessibilityLanguage="ar" style={{ fontFamily: fonts.arabic, fontSize: 16, lineHeight: 30, letterSpacing: 0, writingDirection: "rtl", textAlign: "right", paddingVertical: 4 }}>{hadith.arabic}</T>
    <T variant="heading" selectable style={{ color: c.peach }}><WithHonorific text={hadith.narrator} /></T>
    <T testID="hadith-translation" variant="heading" selectable><WithHonorific text={hadith.translation} /></T>
    <View style={{ gap: 12 }}>
      {hadith.grade && <T variant="small" style={{ color: c.muted }}>Grade: {hadith.grade}</T>}
      <Link href={hadith.url} target="_blank" asChild><T testID="hadith-reference" style={{ color: c.lavender, textDecorationLine: "underline" }}>{hadith.reference} ↗</T></Link>
      <Button title="I’ve read it" icon="checkmark" onPress={() => {
        if (done.current || isExpired()) return;
        done.current = true; onDone();
      }} />
      <T variant="small" style={{ color: c.faint, textAlign: "center" }}>A new reminder on your next wake-up.</T>
    </View>
  </View>;
}
