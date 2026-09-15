import React, { useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import {
  Screen,
  T,
  Chip,
  Tap,
  SoundArt,
  Icon,
  Card,
  Button,
  Heading,
  IconName,
} from "@/components/ui";
import { useApp } from "@/state/app-state";
import { Challenge, sounds, SoundId } from "@/utils/alarms";
import { colors as c, art } from "@/theme";

export function Sounds() {
  const { editing } = useLocalSearchParams<{ editing?: string }>();
  const { draft, updateDraft } = useApp();
  const [filter, setFilter] = useState("All"),
    [selected, setSelected] = useState<SoundId>(draft?.sound ?? "morning");
  const { width } = useWindowDimensions();
  const size = (Math.min(width, 480) - 60) / 2;
  return (
    <Screen style={{ gap: 20 }}>
      <Heading
        title="Find your morning."
        subtitle="A sound for every kind of beginning."
      />
      <View style={{ flexDirection: "row", gap: 8 }}>
        {["All", "Nature", "Cosmic", "Focus"].map((f) => (
          <Chip
            key={f}
            title={f}
            active={filter === f}
            onPress={() => setFilter(f)}
          />
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {sounds
          .filter((s) => filter === "All" || s.category === filter)
          .map((sound) => (
            <Tap
              key={sound.id}
              label={`Select ${sound.name}`}
              selected={selected === sound.id}
              onPress={() => setSelected(sound.id)}
              style={{ width: size }}
            >
              <View
                style={{
                  borderRadius: 24,
                  overflow: "hidden",
                  borderWidth: 2,
                  borderColor:
                    selected === sound.id ? c.lavender : "transparent",
                }}
              >
                <SoundArt tile={sound.tile} />
                <LinearGradient
                  colors={["transparent", "#0A0C1AD9"]}
                  style={{ position: "absolute", inset: 0 }}
                />
                {selected === sound.id && (
                  <View
                    style={{
                      position: "absolute",
                      top: 10,
                      right: 10,
                      backgroundColor: c.lavender,
                      borderRadius: 18,
                      padding: 6,
                    }}
                  >
                    <Icon name="checkmark" size={18} color={c.ink} />
                  </View>
                )}
                <View
                  style={{
                    position: "absolute",
                    bottom: 14,
                    left: 12,
                    right: 12,
                    gap: 4,
                  }}
                >
                  <T variant="label" style={{ fontSize: 14 }}>
                    {sound.name}
                  </T>
                  <T variant="small" style={{ color: "#E0D6E8", fontSize: 10 }}>
                    {sound.category.toUpperCase()}
                  </T>
                </View>
              </View>
            </Tap>
          ))}
      </View>
      <Tap
        onPress={() => setSelected("system")}
        selected={selected === "system"}
      >
        <Card
          style={{
            padding: 18,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Icon name="phone-portrait-outline" />
          <T variant="label" style={{ flex: 1 }}>
            Device default
          </T>
          <Icon
            name={
              selected === "system" ? "checkmark-circle" : "ellipse-outline"
            }
            color={selected === "system" ? c.lavender : c.faint}
          />
        </Card>
      </Tap>
      <Card style={{ padding: 18, gap: 8 }}>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <Icon name="volume-mute-outline" size={18} color={c.peach} />
          <T variant="label">A little quiet, for now.</T>
        </View>
        <T variant="small" style={{ color: c.muted }}>
          The sound collection is being prepared. Alarms use your device’s
          system sound. No audio files or previews are included yet.
        </T>
      </Card>
      {editing && (
        <Button
          title="Use this sound"
          onPress={() => {
            updateDraft({ sound: selected });
            router.back();
          }}
        />
      )}
    </Screen>
  );
}
const challenges: {
  id: Challenge;
  name: string;
  subtitle: string;
  icon: IconName;
  hint: string;
}[] = [
  {
    id: "math",
    name: "Math puzzle",
    subtitle: "A little spark for your sleepy brain.",
    icon: "calculator-outline",
    hint: "Solve 3 questions",
  },
  {
    id: "memory",
    name: "Memory match",
    subtitle: "Find the pairs. Find your focus.",
    icon: "grid-outline",
    hint: "Match 4 pairs",
  },
  {
    id: "shake",
    name: "Shake to wake",
    subtitle: "A little movement goes a long way.",
    icon: "phone-portrait-outline",
    hint: "Shake 12 or 20 times",
  },
  {
    id: "none",
    name: "Keep it simple",
    subtitle: "Some mornings just need a gentle nudge.",
    icon: "sunny-outline",
    hint: "Tap to greet the day",
  },
];
export function Challenges() {
  const { editing } = useLocalSearchParams<{ editing?: string }>();
  const { draft, updateDraft } = useApp();
  const [selected, setSelected] = useState<Challenge>(
    draft?.challenge ?? "math",
  );
  const [difficulty, setDifficulty] = useState<"gentle" | "bright">(
    draft?.difficulty ?? "gentle",
  );
  return (
    <Screen>
      <View style={{ alignItems: "center", gap: 10 }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 24,
            backgroundColor: c.raised,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Icon name="sparkles-outline" size={30} color={c.peach} />
        </View>
        <T variant="heading">Wake up your way</T>
        <T style={{ color: c.muted, textAlign: "center" }}>
          {"A small challenge. A brighter start.\nChoose what gets you going."}
        </T>
      </View>
      <View style={{ gap: 12 }}>
        {challenges.map((item) => (
          <Tap
            key={item.id}
            selected={selected === item.id}
            onPress={() => setSelected(item.id)}
            label={item.name}
          >
            <Card
              style={{
                padding: 17,
                flexDirection: "row",
                gap: 14,
                alignItems: "center",
                borderColor: selected === item.id ? c.lavender : "#FFFFFF0C",
              }}
            >
              <LinearGradient
                colors={["#B8AAF0", "#7165AE"]}
                style={{
                  width: 49,
                  height: 53,
                  borderRadius: 18,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Icon name={item.icon} color={c.text} size={25} />
              </LinearGradient>
              <View style={{ flex: 1, gap: 4 }}>
                <T variant="label">{item.name}</T>
                <T variant="small" style={{ color: c.muted }}>
                  {item.subtitle}
                </T>
              </View>
              <Icon
                name={
                  selected === item.id ? "checkmark-circle" : "chevron-forward"
                }
                size={20}
                color={selected === item.id ? c.lavender : c.faint}
              />
            </Card>
          </Tap>
        ))}
      </View>
      {selected !== "none" && (
        <View style={{ gap: 12 }}>
          <T variant="eyebrow" style={{ color: c.muted }}>
            HOW MUCH OF A NUDGE?
          </T>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Chip
              title="Gentle"
              active={difficulty === "gentle"}
              onPress={() => setDifficulty("gentle")}
            />
            <Chip
              title="A little brighter"
              active={difficulty === "bright"}
              onPress={() => setDifficulty("bright")}
            />
          </View>
          <Tap
            onPress={() =>
              router.push({
                pathname: "/challenge",
                params: {
                  id: "demo",
                  preview: "1",
                  kind: selected,
                  difficulty,
                },
              })
            }
          >
            <T
              variant="small"
              style={{ textAlign: "center", color: c.lavender }}
            >
              Try this challenge →
            </T>
          </Tap>
        </View>
      )}
      <T variant="small" style={{ color: c.faint, textAlign: "center" }}>
        Challenges happen inside Daybreak. Your device’s alarm controls always
        remain available.
      </T>
      {editing && (
        <Button
          title="That’s my kind of morning"
          onPress={() => {
            updateDraft({ challenge: selected, difficulty });
            router.back();
          }}
        />
      )}
    </Screen>
  );
}
export function Themes() {
  const { data, update, busy } = useApp();
  const [selected, setSelected] = useState(data.theme);
  return (
    <Screen>
      <Heading
        title="Set the feeling."
        subtitle="A small world to make your own."
      />
      {(
        [
          {
            id: "serene",
            name: "Serene",
            description: "Peaceful. Balanced. You.",
            image: art.valley,
          },
          {
            id: "moonlight",
            name: "Moonlight",
            description: "Soft. Dreamy. A little magical.",
            image: art.moon,
          },
          {
            id: "ocean",
            name: "Ocean",
            description: "A fresh breath. An open horizon.",
          },
        ] as const
      ).map((theme) => (
        <Tap
          key={theme.id}
          selected={selected === theme.id}
          onPress={() => setSelected(theme.id)}
        >
          <View
            style={{
              height: 190,
              borderRadius: 24,
              overflow: "hidden",
              borderWidth: 2,
              borderColor: selected === theme.id ? c.peach : "transparent",
            }}
          >
            {"image" in theme ? (
              <Image
                source={theme.image}
                contentFit="cover"
                contentPosition={theme.id === "serene" ? "bottom" : "center"}
                style={{
                  height: theme.id === "serene" ? 410 : 300,
                  width: "100%",
                  position: "absolute",
                  bottom: theme.id === "serene" ? -10 : -70,
                }}
              />
            ) : (
              <SoundArt tile={2} style={{ width: "100%", marginTop: -80 }} />
            )}
            <LinearGradient
              colors={["transparent", "#0B0C1AE6"]}
              style={{ position: "absolute", inset: 0 }}
            />
            <View
              style={{
                position: "absolute",
                left: 20,
                bottom: 18,
                right: 20,
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <View style={{ flex: 1 }}>
                <T variant="heading">{theme.name}</T>
                <T variant="small" style={{ color: c.muted }}>
                  {theme.description}
                </T>
              </View>
              {selected === theme.id && (
                <View
                  style={{
                    padding: 7,
                    borderRadius: 20,
                    backgroundColor: c.peach,
                  }}
                >
                  <Icon name="checkmark" color={c.ink} size={20} />
                </View>
              )}
            </View>
          </View>
        </Tap>
      ))}
      <Button
        title="Make it mine"
        loading={busy}
        onPress={() =>
          void update({ theme: selected })
            .then(() => router.back())
            .catch(() => {})
        }
      />
    </Screen>
  );
}
