import React, { useEffect, useState } from "react";
import { AppState, Platform, TextInput, View } from "react-native";
import { Host, Picker } from "@expo/ui";
import { AlarmSwitch } from "./alarm-switch";
import { Button, Card, Chip, Row, T } from "./ui";
import { colors as c } from "@/theme";
import type { Alarm } from "@/utils/alarms";
import { APP_BLOCK_MINUTES, SOCIAL_APPS, socialAppIds } from "@/utils/app-blocking";
import { appBlockingAvailable, appBlockStatus, chooseIOSBlockedApps, installedBlockableApps, requestAppBlockAccess } from "@/services/app-blocking";

export function AppBlockSettings({ alarm, onChange }: { alarm: Alarm; onChange(patch: Partial<Alarm>): void }) {
  const [open, setOpen] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apps, setApps] = useState<Awaited<ReturnType<typeof installedBlockableApps>> | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const available = appBlockingAvailable();
  const minutes = alarm.appBlock?.minutes ?? 5;
  const group = alarm.appBlock?.group ?? (alarm.appBlock?.count ? "custom" : "social");
  function updateBlock(patch: Partial<NonNullable<Alarm["appBlock"]>>) {
    onChange({ appBlock: { enabled: false, selection: "", count: 0, ...alarm.appBlock, minutes, group, ...patch } });
  }
  function changeGroup(next: "social" | "custom") {
    if (working || next === group) return;
    updateBlock({ group: next, enabled: false, selection: "", count: 0 });
    setApps(null); setError(null);
  }
  const refresh = () => { try { setAuthorized(appBlockStatus().authorized); } catch { setAuthorized(false); } };
  useEffect(() => {
    refresh();
    const listener = AppState.addEventListener("change", state => { if (state === "active") refresh(); });
    return () => listener.remove();
  }, []);
  async function run(action: () => Promise<void>) {
    setWorking(true); setError(null);
    try { await action(); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t set up app blocking. Try again."); }
    finally { setWorking(false); }
  }
  async function choose() {
    if (Platform.OS === "ios") {
      const result = await chooseIOSBlockedApps(alarm.appBlock?.selection, group);
      if (result) updateBlock({ ...result, enabled: result.count > 0 });
    } else {
      const installed = await installedBlockableApps();
      if (group === "social") {
        const social = socialAppIds(installed);
        if (!social.length) throw new Error("None of the Social apps are installed. Choose Custom apps to select others.");
        updateBlock({ selection: JSON.stringify(social), count: social.length, enabled: true });
        return;
      }
      const previous: unknown = alarm.appBlock?.selection ? JSON.parse(alarm.appBlock.selection) : null;
      setSelected(Array.isArray(previous) ? previous.filter(id => installed.some(app => app.id === id)) : socialAppIds(installed));
      setApps(installed);
      setSearch("");
    }
  }
  return <Card>
    <Row icon="shield-checkmark-outline" title="Block distracting apps" value={alarm.appBlock?.enabled ? `${group === "social" ? "Social · " : ""}${minutes} min` : "Off"} onPress={() => setOpen(!open)} last={!open} />
    {open && <View style={{ padding: 18, gap: 14 }}>
      <T>Give yourself a scroll-free start.</T>
      <T variant="small" style={{ color: c.muted }}>Blocks your chosen apps for {minutes} minutes from when this alarm rings. Finishing missions early keeps the block running. A snoozed alarm starts a new block when it rings.</T>
      <T>Apps to block</T>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Chip title="Social" active={group === "social"} onPress={() => changeGroup("social")} />
        <Chip title="Custom apps" active={group === "custom"} onPress={() => changeGroup("custom")} />
      </View>
      {group === "social" && <T variant="small" testID="social-apps-summary" style={{ color: c.lavender }}>{SOCIAL_APPS.map(app => app.name).join(" · ")}</T>}
      <T>Block duration</T>
      <Host style={{ minHeight: 44, width: "100%" }} colorScheme="dark" seedColor={c.lavender} accessibilityLabel="App block duration">
        <Picker testID="app-block-duration" enabled={!working} selectedValue={minutes} onValueChange={value => updateBlock({ minutes: value })}>
          {APP_BLOCK_MINUTES.map(value => <Picker.Item key={value} value={value} label={`${value} minutes`} />)}
        </Picker>
      </Host>
      {!available ? <T variant="small" testID="app-block-unavailable" style={{ color: c.peach }}>{Platform.OS === "web" ? "App blocking works on your phone. Open an updated Refresh iPhone or Android build to choose apps and allow access." : "Install an updated Refresh build to set up app blocking. It isn’t available in Expo Go."}</T> : <>
        <Row icon="timer-outline" title="Enable app blocking" last>
          <AlarmSwitch testID="app-block-enabled" label="Enable app blocking" value={alarm.appBlock?.enabled ?? false} disabled={working || (!alarm.appBlock?.enabled && (!authorized || !alarm.appBlock?.count))} onValueChange={enabled => updateBlock({ enabled })} />
        </Row>
        {!authorized && <>
          <T variant="small" style={{ color: c.muted }}>{Platform.OS === "ios" ? "Allow Screen Time access, then choose the apps for your group in Apple’s picker." : "Refresh uses accessibility access to detect when a chosen app opens and cover it during your block. It does not read screen content or send app activity off your phone. Enable Refresh app blocking in Accessibility settings."}</T>
          <Button title={Platform.OS === "ios" ? "Allow Screen Time access" : "Agree & open accessibility settings"} loading={working} onPress={() => void run(requestAppBlockAccess)} />
        </>}
        {authorized && <Button title={group === "social" ? (Platform.OS === "ios" ? "Choose Social apps" : "Use Social apps") : "Choose apps to block"} loading={working} onPress={() => void run(choose)} />}
        {!!alarm.appBlock?.count && <T variant="small" style={{ color: c.muted }}>{alarm.appBlock.count} apps or categories selected.</T>}
        {group === "social" && Platform.OS === "android" && !!alarm.appBlock?.count && <T variant="small" style={{ color: c.muted }}>Tap Use Social apps again to include newly added or installed apps.</T>}
        {Platform.OS === "ios" && <T variant="small" style={{ color: c.muted }}>{group === "social" ? "Choose the apps listed above in Apple’s picker to save your Social group. You can select Social and add video apps from Entertainment. " : ""}iOS controls Screen Time delivery, so blocking or unblocking may be delayed.</T>}
        {apps && <View style={{ gap: 10 }}>
          <T variant="small" style={{ color: c.muted }}>Common social apps are preselected. Add any others you want to block.</T>
          <TextInput accessibilityLabel="Search installed apps" placeholder="Search apps" placeholderTextColor={c.muted} value={search} onChangeText={setSearch} style={{ color: c.text, backgroundColor: c.raised, padding: 12, borderRadius: 12 }} />
          {apps.length === 0 && <T>No apps available to select.</T>}
          {apps.filter(app => app.name.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 20).map(app => <Row key={app.id} icon="apps-outline" title={app.name} last><AlarmSwitch testID={`block-${app.id}`} disabled={working} label={`Block ${app.name}`} value={selected.includes(app.id)} onValueChange={enabled => setSelected(ids => enabled ? [...ids, app.id] : ids.filter(id => id !== app.id))} /></Row>)}
          <T variant="small" style={{ color: c.muted }}>Showing up to 20 matches. Search to find more apps. {selected.length} selected.</T>
          <Button title="Use selected apps" onPress={() => { updateBlock({ enabled: selected.length > 0, selection: JSON.stringify(selected), count: selected.length }); setApps(null); }} />
          <Button title="Cancel selection" onPress={() => setApps(null)} />
        </View>}
      </>}
      {alarm.appBlock?.enabled && !available && <Button title="Turn off app blocking" onPress={() => onChange({ appBlock: { ...alarm.appBlock!, enabled: false } })} />}
      {error && <T accessibilityLiveRegion="assertive" style={{ color: c.danger }}>{error}</T>}
    </View>}
  </Card>;
}
