import React, { useEffect, useState } from "react";
import { View, Platform } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  T,
  Screen,
  Heading,
  CircleButton,
  Enter,
  Card,
  Button,
  Quote,
  Tap,
  Icon,
  SoundArt,
} from "@/components/ui";
import { AlarmCard } from "@/components/alarm-card";
import { colors as c, art } from "@/theme";
import { useApp, newAlarm } from "@/state/app-state";
import { nextOccurrence, timeUntil } from "@/utils/alarms";
import { Float } from "@/components/motion";
import { ClayMotion } from "@/components/clay-motion";
export function Home() {
  const { data, edit } = useApp(),
    insets = useSafeAreaInsets();
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  const alarm = [...data.alarms]
    .filter((a) => a.enabled)
    .sort((a, b) => +nextOccurrence(a, now) - +nextOccurrence(b, now))[0];
  const greeting =
    now.getHours() < 12
      ? "Good morning"
      : now.getHours() < 18
        ? "Good afternoon"
        : "Good evening";
  return (
    <Screen style={{ paddingTop: insets.top + 28, gap: 22 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
          <Icon name="sunny-outline" size={17} color={c.peach} />
          <T variant="eyebrow" style={{ color: c.peach }}>
            REFRESH
          </T>
        </View>
        <Tap onPress={() => router.push("/settings")} label="Open settings">
          <Icon name="options-outline" size={22} color={c.muted} />
        </Tap>
      </View>
      <Heading
        title={`${greeting},`}
        subtitle={
          now.getHours() < 18
            ? "Make room for a fresh start."
            : "Set tonight. Start fresh tomorrow."
        }
        right={
          <CircleButton
            icon="add"
            label="Create alarm"
            onPress={() => {
              edit();
              router.push("/alarm");
            }}
          />
        }
      />
      <Enter>
        {alarm ? (
          <AlarmCard alarm={alarm} featured />
        ) : (
          <Card style={{ padding: 22, gap: 14 }}>
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <T variant="small" style={{ color: c.lavender }}>
                YOUR NEXT FRESH START
              </T>
              <Icon name="alarm-outline" size={19} />
            </View>
            <T variant="heading">Give tomorrow a better start.</T>
            <T style={{ color: c.muted }}>
              Pick your sound. Add a wake-up mission. Make the first move easier.
            </T>
            <Button
              title="Set your first alarm"
              onPress={() => {
                edit();
                router.push("/alarm");
              }}
              icon="add"
            />
          </Card>
        )}
      </Enter>
      {alarm && (
        <View
          style={{ flexDirection: "row", justifyContent: "center", gap: 6 }}
        >
          <Icon name="moon-outline" size={14} color={c.faint} />
          <T variant="small" style={{ color: c.muted }}>
            {data.snoozed
              ? `Snoozing · ${timeUntil(new Date(data.snoozed.at), now)} to go`
              : `${timeUntil(nextOccurrence(alarm, now), now)} until your next wake-up`}
          </T>
        </View>
      )}
      <View
        style={{
          height: 285,
          marginHorizontal: -24,
          marginTop: -4,
          marginBottom: -8,
          overflow: "hidden",
        }}
      >
        <Float style={{ position: "absolute", inset: -5 }} distance={5}>{data.theme === "serene" ? (
          <Image
            source={art.home}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: 285,
            }}
            contentFit="cover"
            contentPosition="bottom"
          />
        ) : data.theme === "moonlight" ? (
          <Image
            source={art.moon}
            style={{ width: "100%", height: 360, marginTop: -40 }}
            contentFit="cover"
          />
        ) : (
          <SoundArt tile={2} style={{ width: "100%", marginTop: -100 }} />
        )}</Float>
        <LinearGradient
          colors={[c.bg, "transparent", "transparent", c.bg]}
          locations={[0, 0.15, 0.78, 1]}
          style={{ position: "absolute", inset: 0 }}
        />
        <ClayMotion name="stars" size={320} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
        <Tap
          onPress={() => router.push("/themes")}
          label="Change your landscape"
          style={{ position: "absolute", bottom: 20, right: 24 }}
        >
          <View
            style={{
              width: 35,
              height: 35,
              borderRadius: 18,
              backgroundColor: "#101426AC",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="color-palette-outline" size={16} color={c.text} />
          </View>
        </Tap>
      </View>
      <Quote />
      <Tap
        onPress={() =>
          router.push({
            pathname: "/ringing",
            params: { id: alarm?.id ?? "demo", preview: "1" },
          })
        }
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
          }}
        >
          <Icon name="play-circle-outline" size={17} color={c.faint} />
          <T variant="small" style={{ color: c.muted }}>
            Try your wake-up routine
          </T>
        </View>
      </Tap>
      {Platform.OS === "web" && (
        <T
          variant="small"
          style={{ color: c.faint, textAlign: "center", fontSize: 10 }}
        >
          Browser preview · Keep this page open for demo alarms.
        </T>
      )}
    </Screen>
  );
}
export function Alarms() {
  const { saved } = useLocalSearchParams<{ saved?: string }>();
  const { data, edit } = useApp();
  const insets = useSafeAreaInsets();
  return (
    <Screen style={{ paddingTop: insets.top + 28 }}>
      {saved && data.alarms.some(a => a.id === saved) && <Card style={{ padding: 16, borderColor: c.green, flexDirection: "row", gap: 10, alignItems: "center" }}><Icon name="checkmark-circle" color={c.green} /><T accessibilityLiveRegion="polite" style={{ flex: 1 }}>Alarm saved. You’re all set.</T><Tap label="Dismiss saved confirmation" onPress={() => router.setParams({ saved: undefined })}><Icon name="close" size={18} /></Tap></Card>}
      <T variant="eyebrow" style={{ color: c.peach }}>
        LESS SNOOZE. MORE MORNING.
      </T>
      <Heading
        title="Your mornings"
        subtitle={`${data.alarms.filter((a) => a.enabled).length} active · Ready for your next wake-up`}
        right={
          <CircleButton
            icon="add"
            label="Add alarm"
            onPress={() => {
              edit();
              router.push("/alarm");
            }}
          />
        }
      />
      {data.alarms.length ? (
        data.alarms.map((alarm, i) => <Enter key={alarm.id} delay={Math.min(i * 45, 180)}><AlarmCard alarm={alarm} /></Enter>)
      ) : (
        <>
          <Image
            source={art.moon}
            style={{ height: 280, width: "100%" }}
            contentFit="contain"
          />
          <T variant="heading" style={{ textAlign: "center" }}>
            A fresh start awaits.
          </T>
          <T style={{ color: c.muted, textAlign: "center" }}>
            Set a time, choose your sound, and give yourself a reason to get up.
          </T>
          <Button
            title="Create an alarm"
            onPress={() => {
              edit();
              router.push("/alarm");
            }}
            icon="add"
          />
        </>
      )}
      <Quote text="A little less snooze. A little more time for you." />
    </Screen>
  );
}
