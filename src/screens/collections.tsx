import { resolveSoundId } from "@/utils/sounds";
import { useSoundPlayer } from "@/components/use-sound-player";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { withHapticFeedback } from "@/services/haptics";
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
import { Mission, alarmMissions, missionDescription, sounds, SoundId } from "@/utils/alarms";
import { colors as c, art } from "@/theme";
import { ClayMotion } from "@/components/clay-motion";

export function Sounds() {
  const { editing } = useLocalSearchParams<{ editing?: string }>();
  const { draft, updateDraft } = useApp();
  const [selected, setSelected] = useState<SoundId>(resolveSoundId(draft?.sound ?? "lofi"));
  const [section, setSection] = useState(() => sounds.find(s => s.id === resolveSoundId(draft?.sound ?? "lofi"))?.category === "Islamic" ? "Islamic" : "Alarm tones");
  const { play, stop, playing, error } = useSoundPlayer();
  const insets = useSafeAreaInsets();
  return <View style={{ flex: 1, backgroundColor: c.bg }}><Screen style={{ gap: 18 }}>
    <Heading title="Alarm sounds" subtitle="Tap play to listen." />
    <View style={{ flexDirection: "row", gap: 10 }}>
      {["Alarm tones", "Islamic"].map(name => <Chip key={name} title={name} active={section === name} onPress={() => { stop(); setSection(name); }} />)}
    </View>
    {error && <T accessibilityLiveRegion="polite" style={{ color: c.peach }}>{error}</T>}
    <Card>
      {sounds.filter(sound => (sound.category === "Islamic") === (section === "Islamic")).map(sound => <View key={sound.id} style={{ flexDirection: "row", alignItems: "center", paddingRight: 14, borderBottomWidth: 1, borderBottomColor: c.line }}>
        <Tap label={`Select ${sound.name}`} selected={selected === sound.id} style={{ flex: 1 }} onPress={() => { setSelected(sound.id); stop(); }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 16 }}>
            <Icon name={selected === sound.id ? "checkmark-circle" : "ellipse-outline"} color={selected === sound.id ? c.lavender : c.faint} />
            <View style={{ flex: 1, gap: 3 }}><T variant="label">{sound.name}</T><T variant="small" style={{ color: c.muted }}>{sound.category} · {Math.floor(Math.ceil(sound.duration) / 60)}:{String(Math.ceil(sound.duration) % 60).padStart(2, "0")}</T></View>
          </View>
        </Tap>
        <Tap label={`${playing === sound.id ? "Stop" : "Play"} ${sound.name}`} onPress={() => playing === sound.id ? stop() : void play(sound.id)}>
          <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: playing === sound.id ? c.lavender : c.raised }}><Icon name={playing === sound.id ? "stop" : "play"} size={18} color={playing === sound.id ? c.ink : c.lavender} /></View>
        </Tap>
      </View>)}
    </Card>
    {section === "Islamic" && <T variant="small" style={{ color: c.muted }}>Full adhan in the app. System alerts use a 29-second excerpt.</T>}
    <Tap label="Device default" selected={selected === "system"} onPress={() => { setSelected("system"); stop(); }}>
      <Card style={{ padding: 18, flexDirection: "row", gap: 12, alignItems: "center" }}><Icon name={selected === "system" ? "checkmark-circle" : "ellipse-outline"} /><T>Device default</T></Card>
    </Tap>
  </Screen>
  {editing && <View style={{ padding: 20, paddingBottom: Math.max(20, insets.bottom), borderTopWidth: 1, borderTopColor: c.line }}><Button title="Use this sound" onPress={() => { stop(); updateDraft({ sound: selected }); router.back(); }} /></View>}
  </View>;
}
const challenges: { id: Mission["kind"]; name: string; subtitle: string }[] = [
  { id: "math", name: "Math puzzle", subtitle: "Give your mind a little spark." },
  { id: "memory", name: "Memory match", subtitle: "Find the friends that belong together." },
  { id: "shake", name: "Shake to wake", subtitle: "A little movement to start the day." },
];
export function Challenges() {
  const { editing } = useLocalSearchParams<{ editing?: string }>();
  const { draft, updateDraft } = useApp();
  const [selected, setSelected] = useState<Mission[]>(() => draft ? alarmMissions(draft) : [{ kind: "math", difficulty: "gentle" }]);
  function change(missions: Mission[]) {
    setSelected(missions);
    if (editing) updateDraft({ missions, challenge: missions[0]?.kind ?? "none", difficulty: missions[0]?.difficulty ?? "gentle" });
  }
  return <Screen style={{ gap: 22 }}>
    <Heading title="Build your wake-up" subtitle="Pick one or more missions. Complete them in the order you choose." />
    <Card style={{ padding: 16, gap: 8 }}>
      <T variant="eyebrow" style={{ color: c.peach }}>{selected.length ? `${selected.length} MISSION${selected.length > 1 ? "S" : ""} SELECTED` : "A SIMPLE START"}</T>
      <T style={{ color: c.muted }}>{selected.length ? selected.map((m, i) => `${i + 1}. ${challenges.find(c => c.id === m.kind)!.name}`).join("  →  ") : "No missions. Dismiss your alarm with a tap."}</T>
    </Card>
    {challenges.map(item => {
      const index = selected.findIndex(m => m.kind === item.id);
      const mission = selected[index];
      return <Card key={item.id} style={{ borderColor: mission ? c.lavender : c.line }}>
        <Tap label={item.name} selected={!!mission} onPress={() => change(mission ? selected.filter(m => m.kind !== item.id) : [...selected, { kind: item.id, difficulty: "gentle" }])}>
          <View style={{ flexDirection: "row", alignItems: "center", padding: 14, gap: 10 }}>
            <ClayMotion name={item.id} size={88} />
            <View style={{ flex: 1, gap: 4 }}><T variant="label">{item.name}</T><T variant="small" style={{ color: c.muted }}>{item.subtitle}</T></View>
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: mission ? c.lavender : c.raised, alignItems: "center", justifyContent: "center" }}>
              {mission ? <T variant="label" style={{ color: c.ink }}>{index + 1}</T> : <Icon name="add" size={18} />}
            </View>
          </View>
        </Tap>
        {mission && <View style={{ paddingHorizontal: 18, paddingBottom: 18, gap: 12 }}>
          <T variant="eyebrow" style={{ color: c.muted }}>DIFFICULTY</T>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {(["gentle", "bright"] as const).map(level => <Tap key={level} label={`${item.name} ${level === "gentle" ? "Easy" : "Hard"}`} selected={mission.difficulty === level} style={{ flex: 1 }} onPress={() => change(selected.map(m => m.kind === item.id ? { ...m, difficulty: level } : m))}>
              <View style={{ padding: 12, borderRadius: 16, backgroundColor: mission.difficulty === level ? c.lavender : c.raised, alignItems: "center" }}><T variant="label" style={{ color: mission.difficulty === level ? c.ink : c.muted }}>{level === "gentle" ? "Easy" : "Hard"}</T></View>
            </Tap>)}
          </View>
          <T variant="small" style={{ color: c.peach }}>{missionDescription(item.id, mission.difficulty)}</T>
          <Tap label={`Preview ${item.name}`} onPress={() => router.push({ pathname: "/challenge", params: { id: "demo", preview: "1", kind: item.id, difficulty: mission.difficulty } })}>
            <T variant="small" style={{ color: c.lavender }}>Try this mission →</T>
          </Tap>
        </View>}
      </Card>;
    })}
    <Tap label="No missions" selected={!selected.length} onPress={() => change([])}>
      <Card style={{ padding: 18, flexDirection: "row", alignItems: "center", gap: 12 }}><Icon name="sunny-outline" /><View style={{ flex: 1 }}><T variant="label">No missions</T><T variant="small" style={{ color: c.muted }}>Just tap to dismiss.</T></View>{!selected.length && <Icon name="checkmark-circle" />}</Card>
    </Tap>
    <T variant="small" style={{ color: c.faint }}>Missions run inside Refresh. Your device’s alarm controls remain available.</T>
    {editing && <Button title={selected.length ? `Use ${selected.length} mission${selected.length > 1 ? "s" : ""}` : "Use no missions"} onPress={() => router.back()} icon="checkmark" />}
  </Screen>;
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
        haptic={false}
        loading={busy}
        onPress={() =>
          void withHapticFeedback(() => update({ theme: selected }))
            .then(() => router.back())
            .catch(() => {})
        }
      />
    </Screen>
  );
}

