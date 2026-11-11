import { isCustomSound, resolveSoundId } from "@/utils/sounds";
import { importAudio } from "@/services/custom-audio";
import { useSoundPlayer } from "@/components/use-sound-player";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { haptic, withHapticFeedback } from "@/services/haptics";
import React, { useState } from "react";
import { Host, Picker } from "@expo/ui";
import { View, Platform, useWindowDimensions } from "react-native";
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
import { Mission, alarmMissions, missionDescription, missionLabel, missionRounds, missionSupportsRounds, MAX_MISSION_ROUNDS, sounds, SoundId } from "@/utils/alarms";
import { colors as c, art } from "@/theme";
import { ClayMotion } from "@/components/clay-motion";
import { selectedSupplications, supplications } from "@/utils/supplications";

export function Sounds() {
  const { editing } = useLocalSearchParams<{ editing?: string }>();
  const { data, draft, updateDraft, addCustomSound } = useApp();
  const [selected, setSelected] = useState<SoundId>(resolveSoundId(draft?.sound ?? "lofi"));
  const [section, setSection] = useState(() => isCustomSound(selected) ? "Custom" : sounds.find(s => s.id === selected)?.category === "Islamic" ? "Islamic" : "Alarm tones");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string>();
  const { play, stop, playing, error } = useSoundPlayer();
  const insets = useSafeAreaInsets();
  const visibleSounds = section === "Custom"
    ? (data.customSounds ?? []).map(sound => ({ ...sound, category: "Custom" }))
    : sounds.filter(sound => (sound.category === "Islamic") === (section === "Islamic"));
  async function importSound() {
    if (importing) return;
    stop(); setImportError(undefined); setImporting(true);
    try {
      const sound = await importAudio();
      if (sound) { await addCustomSound(sound); setSelected(sound.id); haptic("success"); }
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Couldn’t import this audio. Please try again.");
      haptic("error");
    } finally { setImporting(false); }
  }
  return <View style={{ flex: 1, backgroundColor: c.bg }}><Screen style={{ gap: 18 }}>
    <Heading title="Alarm sounds" subtitle="Tap play to listen." />
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {["Alarm tones", "Islamic", "Custom"].map(name => <Chip key={name} title={name} active={section === name} onPress={() => { stop(); setSection(name); }} />)}
    </View>
    {section === "Custom" && <View style={{ gap: 12 }}>
      <Button title="Import audio" icon="add" secondary loading={importing} onPress={() => void importSound()} />
      <T variant="small" style={{ color: c.muted }}>MP3, M4A, WAV and more · up to 50 MB</T>
      {importError && <T accessibilityLiveRegion="polite" style={{ color: c.peach }}>{importError}</T>}
      {!visibleSounds.length && <Card style={{ padding: 24, alignItems: "center", gap: 10 }}><Icon name="musical-notes-outline" color={c.lavender} size={28} /><T style={{ color: c.muted }}>No custom sounds yet.</T></Card>}
    </View>}
    {error && <T accessibilityLiveRegion="polite" style={{ color: c.peach }}>{error}</T>}
    {!!visibleSounds.length && <Card>
      {visibleSounds.map(sound => <View key={sound.id} style={{ flexDirection: "row", alignItems: "center", paddingRight: 14, borderBottomWidth: 1, borderBottomColor: c.line }}>
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
    </Card>}
    {section === "Custom" && Platform.OS === "ios" && <T variant="small" style={{ color: c.muted }}>Full audio in the app. System alerts use the first 29 seconds.</T>}
    {section === "Islamic" && <T variant="small" style={{ color: c.muted }}>{Platform.OS === "android" ? "Full adhan for your alarm, including on the lock screen." : "Full adhan in the app. iOS system alerts use a 29-second excerpt."}</T>}
    <Tap label="Device default" selected={selected === "system"} onPress={() => { setSelected("system"); stop(); }}>
      <Card style={{ padding: 18, flexDirection: "row", gap: 12, alignItems: "center" }}><Icon name={selected === "system" ? "checkmark-circle" : "ellipse-outline"} /><T>Device default</T></Card>
    </Tap>
  </Screen>
  {editing && <View style={{ padding: 20, paddingBottom: Math.max(20, insets.bottom), borderTopWidth: 1, borderTopColor: c.line }}><Button title="Use this sound" loading={importing} onPress={() => { stop(); updateDraft({ sound: selected }); router.back(); }} /></View>}
  </View>;
}
const challenges: { id: Mission["kind"]; name: string; subtitle: string }[] = [
  { id: "math", name: "Math puzzle", subtitle: "Get your brain into gear." },
  { id: "memory", name: "Memory match", subtitle: "A little focus before the day begins." },
  { id: "shake", name: "Shake to wake", subtitle: "Get moving. Get your morning going." },
  { id: "number_order", name: "Number trail", subtitle: "Find your way through a jumble of numbers." },
  { id: "color_focus", name: "Tile recall", subtitle: "Remember the lights. Find the same tiles." },
  { id: "sequence", name: "Pattern echo", subtitle: "Watch the lights. Echo the pattern." },
  { id: "supplication", name: "Islamic supplication", subtitle: "Make space for the duas you choose." },
  { id: "fajr_reminder", name: "Fajr reminder", subtitle: "A moment to remember the reward of Fajr." },
];
export function Challenges() {
  const { editing } = useLocalSearchParams<{ editing?: string }>();
  const { draft, updateDraft } = useApp();
  const [selected, setSelected] = useState<Mission[]>(() => draft ? alarmMissions(draft) : [{ kind: "math", difficulty: "gentle" }]);
  function change(missions: Mission[]) {
    setSelected(missions);
    if (editing) updateDraft({ missions, challenge: missions[0]?.kind ?? "none", difficulty: missions[0]?.difficulty ?? "gentle" });
  }
  // Expanding rows move offscreen siblings. Keep their Android native views
  // attached and their touch bounds in sync with the current Yoga layout.
  return <Screen style={{ gap: 22 }} removeClippedSubviews={false}>
    <Heading title="Get past snooze" subtitle="Choose what helps you start your morning." />
    <Card animated={Platform.OS !== "android"} style={{ padding: 16, gap: 8 }}>
      <T variant="eyebrow" style={{ color: c.peach }}>{selected.length ? `${selected.length} MISSION${selected.length > 1 ? "S" : ""} SELECTED` : "A SIMPLE START"}</T>
      <T style={{ color: c.muted }}>{selected.length ? selected.map((m, i) => `${i + 1}. ${missionLabel(m)}`).join("  →  ") : "No missions. Dismiss your alarm with a tap."}</T>
    </Card>
    {challenges.map(item => {
      const index = selected.findIndex(m => m.kind === item.id);
      const mission = selected[index];
      return <Card key={item.id} animated={Platform.OS !== "android"} style={{ borderColor: mission ? c.lavender : c.line }}>
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
          {item.id === "supplication" && <>
            <T variant="eyebrow" style={{ color: c.muted }}>YOUR DUAS</T>
            <T variant="small" style={{ color: c.muted }}>Choose one or more. Each keeps its recitation count.</T>
            {supplications.map(dua => {
              const ids = selectedSupplications(mission.duaIds).map(d => d.id);
              const active = ids.includes(dua.id);
              return <Tap key={dua.id} label={`Dua: ${dua.title}`} selected={active} disabled={active && ids.length === 1} onPress={() => change(selected.map(m => m.kind === item.id ? { ...m, duaIds: active ? ids.filter(id => id !== dua.id) : [...ids, dua.id] } : m))}>
                <View style={{ padding: 12, borderRadius: 14, backgroundColor: c.raised, flexDirection: "row", gap: 10, alignItems: "center" }}>
                  <Icon name={active ? "checkmark-circle" : "ellipse-outline"} color={active ? c.lavender : c.faint} />
                  <View style={{ flex: 1 }}><T variant="label">{dua.title}</T><T variant="small" style={{ color: c.muted }}>{dua.occasion} · {dua.repetitions}×</T></View>
                </View>
              </Tap>;
            })}
          </>}
          {missionSupportsRounds(item.id) && <>
          <T variant="eyebrow" style={{ color: c.muted }}>DIFFICULTY</T>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {(["gentle", "bright"] as const).map(level => <Tap key={level} label={`${item.name} ${level === "gentle" ? "Easy" : "Hard"}`} selected={mission.difficulty === level} style={{ flex: 1 }} onPress={() => change(selected.map(m => m.kind === item.id ? { ...m, difficulty: level } : m))}>
              <View style={{ padding: 12, borderRadius: 16, backgroundColor: mission.difficulty === level ? c.lavender : c.raised, alignItems: "center" }}><T variant="label" style={{ color: mission.difficulty === level ? c.ink : c.muted }}>{level === "gentle" ? "Easy" : "Hard"}</T></View>
            </Tap>)}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <T variant="label">Rounds</T>
            <Host matchContents={Platform.OS !== "android"}
              style={Platform.OS === "android" ? { width: 148, height: 56 } : undefined}
              colorScheme="dark" seedColor={c.lavender} accessibilityLabel={`${item.name} rounds`}>
              <Picker selectedValue={missionRounds(mission)} testID={`rounds-${item.id}`}
                onValueChange={(rounds) => {
                  haptic("selection");
                  change(selected.map(m => m.kind === item.id ? { ...m, rounds } : m));
                }}>
                {Array.from({ length: MAX_MISSION_ROUNDS }, (_, i) => i + 1).map(rounds =>
                  <Picker.Item key={rounds} value={rounds} label={`${rounds} round${rounds === 1 ? "" : "s"}`} />)}
              </Picker>
            </Host>
          </View>
          </>}
          <T variant="small" style={{ color: c.peach }}>{missionSupportsRounds(item.id) ? "Per round: " : ""}{missionDescription(item.id, mission.difficulty, mission.duaIds)}</T>
          <Tap label={`Preview ${item.name}`} onPress={() => router.push({ pathname: "/challenge", params: { id: "demo", preview: "1", kind: item.id, difficulty: mission.difficulty, rounds: missionSupportsRounds(item.id) ? String(missionRounds(mission)) : undefined, duaIds: mission.duaIds?.join(",") } })}>
            <T variant="small" style={{ color: c.lavender }}>Try this mission →</T>
          </Tap>
        </View>}
      </Card>;
    })}
    <Tap label="No missions" selected={!selected.length} onPress={() => change([])}>
      <Card animated={Platform.OS !== "android"} style={{ padding: 18, flexDirection: "row", alignItems: "center", gap: 12 }}><Icon name="sunny-outline" /><View style={{ flex: 1 }}><T variant="label">No missions</T><T variant="small" style={{ color: c.muted }}>Just tap to dismiss.</T></View>{!selected.length && <Icon name="checkmark-circle" />}</Card>
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
        title="Your morning view"
        subtitle="Choose the scene that greets your fresh start."
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

