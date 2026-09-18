import React, { useRef, useState } from "react";
import { View } from "react-native";
import { Button, T } from "./ui";
import { colors as c, fonts } from "@/theme";
import { Supplication, supplications } from "@/utils/supplications";

// Keep the honorific in the Arabic font even within English/transliterated text.
function WithHonorific({ text }: { text: string }) {
  return text.split("ﷺ").map((part, i) => <React.Fragment key={i}>
    {i > 0 && <T style={{ fontFamily: fonts.arabic, fontSize: 22, lineHeight: 30 }}>ﷺ</T>}
    {part}
  </React.Fragment>);
}

export function SupplicationMission({ dua, index, isExpired, onDone }: {
  dua: Supplication;
  index: number;
  isExpired(): boolean;
  onDone(): void;
}) {
  const [recited, setRecited] = useState(0);
  const count = useRef(0);
  const done = useRef(false);
  function recite() {
    if (done.current || isExpired()) return;
    count.current += 1;
    setRecited(count.current);
    if (count.current >= dua.repetitions) {
      done.current = true;
      onDone();
    }
  }
  return <View style={{ gap: 20 }}>
    <View style={{ gap: 4 }}>
      <T variant="heading" testID="dua-title">{dua.title}</T>
      <T variant="small" style={{ color: c.muted }}>
        Dua {index + 1} of {supplications.length} · {dua.occasion}
      </T>
    </View>
    <T testID="dua-arabic" selectable accessibilityLanguage="ar"
      style={{ fontFamily: fonts.arabic, fontSize: 30, lineHeight: 52, letterSpacing: 0,
        writingDirection: "rtl", textAlign: "right", paddingVertical: 4 }}>
      {dua.arabic}
    </T>
    <T testID="dua-transliteration" selectable style={{ color: c.peach, lineHeight: 25 }}>
      <WithHonorific text={dua.transliteration} />
    </T>
    <T selectable style={{ color: c.muted, lineHeight: 25 }}>
      <WithHonorific text={dua.translation} />
    </T>
    <View style={{ gap: 10 }}>
      <T testID="dua-repetitions" variant="small" style={{ color: c.lavender, textAlign: "center" }}>
        {dua.repetitions === 1 ? "Recite once" : `Recite 3 times · ${recited}/3 completed`}
      </T>
      <Button title="I’ve recited it" onPress={recite} icon="checkmark" />
      <T variant="small" style={{ color: c.faint, textAlign: "center" }}>{dua.reference}</T>
    </View>
  </View>;
}
