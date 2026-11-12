import { test, expect, type Page } from "@playwright/test";
import { fajrReminders } from "../src/utils/fajr-reminders";

const time = new Date(2026, 8, 18, 8, 0);
async function seed(page: Page, manual = false) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install({ time });
  await page.addInitScript(manual => {
    if (localStorage.getItem("daybreak.state.v1")) return;
    localStorage.setItem("daybreak.state.v1", JSON.stringify({
      version: 1, onboarded: true, theme: "serene", journal: [], completions: [], fajrReminderIndex: 2,
      alarms: [{ id: "mystery", hour: 7, minute: 0, days: [0, 1, 2, 3, 4, 5, 6], label: "Mystery", enabled: true,
        sound: "system", challenge: "math", difficulty: "gentle", snooze: 5, silentMissions: true,
        missions: [{ kind: "math", difficulty: "bright", rounds: 3 }, { kind: "supplication", difficulty: "gentle", duaIds: ["waking"] }],
        ...(manual ? {} : { missionMode: "mystery", mystery: {
          games: [{ kind: "math", difficulty: "gentle", rounds: 2 }, { kind: "shake", difficulty: "gentle" }],
          duaIds: ["waking", "contentment", "protection"], fajr: true,
        } }),
      }],
    }));
  }, manual);
}
const saved = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("daybreak.state.v1")!));
const session = async (page: Page) => (await saved(page)).wakeSessions?.mystery;

async function solveMath(page: Page) {
  for (let i = 0; i < 3; i++) {
    const text = await page.getByTestId("math-question").innerText();
    const [a, b] = text.split(/[+×]/).map(Number);
    await page.getByRole("button", { name: `Answer ${text.includes("×") ? a * b : a + b}`, exact: true }).click();
  }
}
async function finishGame(page: Page, game: { kind: string; rounds?: number }) {
  for (let i = 0; i < (game.rounds ?? 1); i++) {
    if (game.kind === "shake") await page.getByRole("button", { name: /Prefer not to shake/ }).click();
    await solveMath(page);
  }
}
async function finishMission(page: Page, mission: any) {
    if (mission.kind === "supplication") {
      for (const id of mission.duaIds) {
        const titles: Record<string, string> = { waking: "Upon waking", contentment: "Contentment in faith", protection: "Seeking protection" };
        await expect(page.getByTestId("dua-title")).toHaveText(titles[id]);
        for (let i = 0; i < (id === "waking" ? 1 : 3); i++) await page.getByRole("button", { name: "I’ve recited it", exact: true }).click();
      }
    } else if (mission.kind === "fajr_reminder") {
      await expect(page.getByTestId("mission-timer")).toHaveText("5:00");
      await page.getByRole("button", { name: "I’ve read it", exact: true }).click();
    } else await finishGame(page, mission);
}
async function finishRoutine(page: Page, missions: any[]) {
  let count = 0;
  for (const mission of missions) {
    await expect(page.getByText(`Mission ${++count} of ${missions.length}`, { exact: true })).toBeVisible();
    await finishMission(page, mission);
  }
  await expect(page.getByText("First win of the day.")).toBeVisible();
}

async function changeStored(page: Page, change: (state: any) => void) {
  const state = await saved(page);
  change(state);
  await page.evaluate(state => localStorage.setItem("daybreak.state.v1", JSON.stringify(state)), state);
}

test("Set Order and Random Pick settings remain independent through switching, previews, saving and reload", async ({ page }) => {
  await seed(page, true);
  await page.goto("/alarms");
  await page.getByRole("button", { name: /^Edit alarm at/ }).click();
  await page.getByRole("button", { name: /Wake-up missions/ }).click();
  await page.getByRole("button", { name: /Choose missions/ }).click();
  await expect(page.getByRole("button", { name: "Set Order", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Random Pick", exact: true }).click();
  await expect(page.getByTestId("rounds-math")).toHaveValue("3");
  await expect(page.getByRole("button", { name: "Fajr reminder", exact: true })).toHaveAttribute("aria-pressed", "false");
  for (const game of ["Memory match", "Number trail", "Tile recall", "Pattern echo"]) await page.getByRole("button", { name: game, exact: true }).click();
  await expect(page.getByRole("button", { name: "Math puzzle", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Shake to wake", exact: true })).toBeDisabled();
  for (const title of ["Contentment in faith", "Seeking protection"]) await page.getByRole("button", { name: `Dua: ${title}`, exact: true }).click();
  await expect(page.getByRole("button", { name: "Dua: Upon waking", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Fajr reminder", exact: true }).click();
  await expect(page.getByText("2 ELIGIBLE GAMES", { exact: true })).toBeVisible();
  await page.getByTestId("rounds-math").selectOption("4");
  await page.getByRole("button", { name: "Preview Math puzzle", exact: true }).click();
  await expect(page.getByTestId("mission-round")).toHaveText("Round 1 of 4");
  await page.getByRole("button", { name: "Close challenge preview", exact: true }).click();
  await page.getByRole("button", { name: "Set Order", exact: true }).click();
  await expect(page.getByTestId("rounds-math")).toHaveValue("3");
  await page.getByRole("button", { name: "Random Pick", exact: true }).click();
  await expect(page.getByTestId("rounds-math")).toHaveValue("4");
  await page.getByRole("button", { name: "Use Random Pick", exact: true }).click();
  await page.getByRole("button", { name: "Save alarm", exact: true }).click();
  await expect(page.getByText("Alarm saved. You’re all set.")).toBeVisible();
  await page.reload();
  const alarm = (await saved(page)).alarms[0];
  expect(alarm.missionMode).toBe("mystery");
  expect(alarm.missions[0]).toEqual({ kind: "math", difficulty: "bright", rounds: 3 });
  expect(alarm.mystery).toEqual({ games: [{ kind: "math", difficulty: "bright", rounds: 4 }, { kind: "shake", difficulty: "gentle" }], duaIds: ["waking"], fajr: true });
  await page.getByRole("button", { name: /^Edit alarm at/ }).click();
  await page.getByRole("button", { name: /Wake-up missions/ }).click();
  await page.getByRole("button", { name: /Choose missions/ }).click();
  await expect(page.getByRole("button", { name: "Random Pick", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("rounds-math")).toHaveValue("4");
});

test("timeout and cold launches restart the same routine, preserve dua order, and complete mission progress", async ({ page }) => {
  await seed(page);
  await page.goto("/ringing?id=mystery&eventId=native-first");
  await page.getByRole("button", { name: "Wake up my mind", exact: true }).click();
  const first = await session(page);
  await finishGame(page, first.missions[0]);
  await expect(page.getByText("Mission 2 of 4", { exact: true })).toBeVisible();
  await page.clock.fastForward(60000);
  await expect(page.getByTestId("alarm-wallpaper-screen")).toBeVisible();
  expect(await session(page)).toEqual(first);
  // Android creates a different reminder eventId; a cold launch must still use
  // the original wake-up record and start at mission/round/dua one.
  await page.goto("/ringing?id=mystery&eventId=native%3Areminder%3Anew&reminder=1");
  await page.reload();
  await page.getByRole("button", { name: "Wake up my mind", exact: true }).click();
  expect(await session(page)).toEqual(first);
  await finishRoutine(page, first.missions);
  expect(await session(page)).toBeUndefined();
  expect((await saved(page)).mysteryHistory.mystery.completedAt).toBeDefined();
  expect((await saved(page)).fajrReminderIndex).toBe(3);
  expect((await saved(page)).completions).toHaveLength(1);
  await page.clock.fastForward(65000);
  await expect(page.getByText("First win of the day.")).toBeVisible();
  // The next scheduled wake-up generates once and avoids yesterday's order.
  await page.clock.fastForward(86400000);
  await page.goto("/ringing?id=mystery&eventId=next-scheduled");
  await expect(page.getByRole("button", { name: "Wake up my mind", exact: true })).toBeEnabled();
  const next = await session(page);
  expect(next.id).not.toBe(first.id);
  expect(next.missions.slice(0, 2).map((m: any) => m.kind)).not.toEqual(first.missions.slice(0, 2).map((m: any) => m.kind));
});

test("a persisted snooze reuses the original Mystery sequence", async ({ page }) => {
  await seed(page);
  await page.goto("/challenge?id=mystery");
  await expect(page.getByTestId("mission-timer")).toBeVisible();
  const first = await session(page);
  // The app currently exposes snooze through lifecycle state/native alarm
  // controls. Rehydrate exactly that persisted handoff, then use normal routes.
  const at = +time + 300000;
  await page.evaluate(at => {
    const state = JSON.parse(localStorage.getItem("daybreak.state.v1")!);
    state.snoozed = { alarmId: "mystery", at, registration: { kind: "preview", ids: [] }, sessionId: state.wakeSessions.mystery.id };
    localStorage.setItem("daybreak.state.v1", JSON.stringify(state));
  }, at);
  await page.clock.fastForward(300000);
  await page.goto(`/ringing?id=mystery&eventId=snooze-${at}`);
  await page.getByRole("button", { name: "Wake up my mind", exact: true }).click();
  expect(await session(page)).toEqual(first);
  await expect(page.getByText("Mission 1 of 4", { exact: true })).toBeVisible();
});

test("a routine is persisted before gameplay and a failed write remains retryable", async ({ page }) => {
  await seed(page);
  await page.addInitScript(() => {
    const write = Storage.prototype.setItem;
    let fail = true;
    Storage.prototype.setItem = function(key, value) {
      if (key === "daybreak.state.v1" && fail) {
        fail = false;
        throw new Error("Could not save wake-up session");
      }
      return write.call(this, key, value);
    };
  });
  await page.goto("/ringing?id=mystery");
  await expect(page.getByRole("alert")).toHaveText("Could not save wake-up session");
  expect(await session(page)).toBeUndefined();
  await expect(page.getByRole("button", { name: "Wake up my mind", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Dismiss message", exact: true }).click();
  await page.getByRole("button", { name: "Retry preparing routine", exact: true }).click();
  await page.getByRole("button", { name: "Wake up my mind", exact: true }).click();
  await expect(page.getByTestId("mission-timer")).toBeVisible();
  expect((await session(page)).missions).toHaveLength(4);
});

test("full Mystery previews retain their routine on timeout without saving history or completing an alarm", async ({ page }) => {
  await seed(page);
  await page.goto("/ringing?id=mystery&preview=1");
  const before = await saved(page);
  await page.getByRole("button", { name: "Wake up my mind", exact: true }).click();
  const sequence = new URL(page.url()).searchParams.get("previewSequence")!;
  const missions = JSON.parse(sequence);
  await page.clock.fastForward(60000);
  await expect(page.getByTestId("alarm-wallpaper-screen")).toBeVisible();
  await page.getByRole("button", { name: "Wake up my mind", exact: true }).click();
  expect(new URL(page.url()).searchParams.get("previewSequence")).toBe(sequence);
  await finishRoutine(page, missions);
  expect(await saved(page)).toEqual(before);
});

test("active routines survive mode, schedule and configuration changes and completion clears only the active snapshot", async ({ page }) => {
  await seed(page);
  await page.goto("/challenge?id=mystery");
  await expect(page.getByTestId("mission-timer")).toBeVisible();
  const first = await session(page);
  await changeStored(page, state => {
    state.alarms[0].missionMode = "manual";
    state.alarms[0].missions = [];
    state.alarms[0].hour = 9;
    state.alarms[0].mystery.games = [];
    state.fajrReminderIndex = 4;
  });
  await page.goto("/ringing?id=mystery&eventId=mystery%3Aactive");
  await page.getByRole("button", { name: "Wake up my mind", exact: true }).click();
  expect(await session(page)).toEqual(first);
  // Original hadith content stays fixed even after another alarm advances the
  // global rotation. Completion still advances the current global cursor once.
  for (const mission of first.missions) {
    if (mission.kind === "fajr_reminder") await expect(page.getByTestId("hadith-arabic")).toHaveText(fajrReminders[2].arabic);
    await finishMission(page, mission);
  }
  await expect(page.getByText("First win of the day.")).toBeVisible();
  const after = await saved(page);
  expect(after.wakeSessions.mystery).toBeUndefined();
  expect(after.mysteryHistory.mystery.gameplay).toEqual(first.missions.slice(0, 2).map((m: any) => m.kind));
  expect(after.mysteryHistory.mystery.missions).toBeUndefined();
  expect(after.fajrReminderIndex).toBe(0);
  expect(after.alarms[0].missionMode).toBe("manual");
});

for (const ending of ["before", "after", "disabled"] as const) test(`Fajr ${ending} duas uses the effective routine and advances only on completion`, async ({ page }) => {
  await seed(page);
  await page.goto("/alarms");
  await changeStored(page, state => {
    const alarm = state.alarms[0];
    alarm.mystery.fajr = ending !== "disabled";
    const duas = { kind: "supplication", difficulty: "gentle", duaIds: ["protection", "waking", "contentment"] };
    const fajr = { kind: "fajr_reminder", difficulty: "gentle" };
    state.wakeSessions = { mystery: { id: "fixed", occurrenceKey: `mystery:${+time - 3600000}`, startedAt: +time,
      config: alarm.mystery, fajrIndex: 2, missions: [...alarm.mystery.games,
        ...(ending === "before" ? [fajr, duas] : ending === "after" ? [duas, fajr] : [duas])] } };
  });
  await page.goto("/challenge?id=mystery&sessionId=fixed");
  await expect(page.getByTestId("mission-timer")).toBeVisible();
  const routine = await session(page);
  await finishRoutine(page, routine.missions);
  expect((await saved(page)).fajrReminderIndex).toBe(ending === "disabled" ? 2 : 3);
  expect(await session(page)).toBeUndefined();
});

test("invalid Mystery configuration rings and offers explicit, persistent recovery without adding games", async ({ page }) => {
  await seed(page);
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/alarms");
  await changeStored(page, state => {
    state.alarms[0].sound = "digital_beep";
    state.alarms[0].mystery = { games: [], duaIds: ["protection"], fajr: false };
  });
  await page.goto("/ringing?id=mystery");
  await expect(page.getByText(/Your Mystery settings need repair/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Wake up my mind", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Hello, new day", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Use morning duas this time", exact: true })).toBeInViewport();
  await expect(page.locator('audio[data-alarm="true"]').or(page.getByRole("button", { name: "Play alarm sound", exact: true }))).toHaveCount(1);
  await page.getByRole("button", { name: "Use morning duas this time", exact: true }).click();
  await page.getByRole("button", { name: "Wake up my mind", exact: true }).click();
  const recovery = await session(page);
  expect(recovery.fallback).toBe("duas-only");
  expect(recovery.missions).toEqual([{ kind: "supplication", difficulty: "gentle", duaIds: ["protection"] }]);
  await page.clock.fastForward(60000);
  await expect(page.getByTestId("alarm-wallpaper-screen")).toBeVisible();
  await page.getByRole("button", { name: "Wake up my mind", exact: true }).click();
  expect(await session(page)).toEqual(recovery);
  for (let n = 0; n < 3; n++) await page.getByRole("button", { name: "I’ve recited it", exact: true }).click();
  await expect(page.getByText("First win of the day.")).toBeVisible();
  expect((await saved(page)).alarms[0].mystery.games).toEqual([]);
  expect((await saved(page)).fajrReminderIndex).toBe(2);
});

test("corrupt sessions do not block startup or silently regenerate and can be explicitly recovered", async ({ page }) => {
  await seed(page);
  await page.goto("/alarms");
  await changeStored(page, state => { state.wakeSessions = { mystery: { id: "damaged", missions: [] } }; });
  await page.goto("/ringing?id=mystery");
  await expect(page.getByText(/The saved routine is damaged/)).toBeVisible();
  expect((await saved(page)).wakeSessions.mystery).toEqual({ id: "damaged", missions: [] });
  await page.reload();
  await expect(page.getByRole("button", { name: "Use morning duas this time", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Use morning duas this time", exact: true }).click();
  await page.getByRole("button", { name: "Wake up my mind", exact: true }).click();
  expect((await session(page)).fallback).toBe("duas-only");
  expect((await saved(page)).wakeSessionRecovery.mystery).toBeUndefined();
});

test("an excluded math game needs an explicit one-time shake fallback choice", async ({ page }) => {
  await seed(page);
  await page.goto("/alarms");
  await changeStored(page, state => {
    const config = { games: [{ kind: "shake", difficulty: "gentle" }, { kind: "memory", difficulty: "gentle" }], duaIds: ["waking"], fajr: false };
    state.alarms[0].mystery = config;
    state.wakeSessions = { mystery: { id: "shake-session", occurrenceKey: `mystery:${+time - 3600000}`, startedAt: +time,
      config, missions: [...config.games, { kind: "supplication", difficulty: "gentle", duaIds: ["waking"] }] } };
  });
  await page.goto("/challenge?id=mystery&sessionId=shake-session");
  await expect(page.getByText(/Math is outside your chosen games/)).toBeVisible();
  await expect(page.getByTestId("math-question")).toHaveCount(0);
  await page.getByRole("button", { name: "Use math once for this shake mission", exact: true }).click();
  await expect(page.getByTestId("math-question")).toBeVisible();
  expect((await session(page)).missions[0].kind).toBe("shake");
});

test("Mystery duplicate and delete preserve settings while keeping session ownership separate", async ({ page }) => {
  await seed(page);
  await page.goto("/challenge?id=mystery");
  await expect(page.getByTestId("mission-timer")).toBeVisible();
  const first = await session(page);
  await page.goto("/alarms");
  await page.getByRole("button", { name: "More options for alarm at 7:00 AM", exact: true }).click();
  await page.getByRole("menuitem", { name: "Duplicate alarm at 7:00 AM", exact: true }).click();
  await expect.poll(async () => (await saved(page)).alarms.length).toBe(2);
  const state = await saved(page);
  expect(state.alarms[1].mystery).toEqual(state.alarms[0].mystery);
  expect(state.wakeSessions[state.alarms[1].id]).toBeUndefined();
  expect(state.wakeSessions.mystery).toEqual(first);
  await page.getByRole("button", { name: "More options for alarm at 7:00 AM", exact: true }).first().click();
  await page.getByRole("menuitem", { name: "Delete alarm at 7:00 AM", exact: true }).click();
  await page.getByRole("button", { name: "Confirm delete alarm at 7:00 AM", exact: true }).click();
  await expect.poll(async () => (await saved(page)).alarms.length).toBe(1);
  expect((await saved(page)).wakeSessions.mystery).toBeUndefined();
});

test("a failed Mystery completion keeps its snapshot and Fajr rotation unchanged until retry succeeds", async ({ page }) => {
  await seed(page);
  await page.addInitScript(() => {
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === "daybreak.state.v1" && (window as any).failCompletion) {
        (window as any).failCompletion = false;
        throw new Error("Could not save Mystery completion");
      }
      return write.call(this, key, value);
    };
  });
  await page.goto("/challenge?id=mystery");
  await expect(page.getByTestId("mission-timer")).toBeVisible();
  const first = await session(page);
  for (const mission of first.missions.slice(0, -1)) await finishMission(page, mission);
  await page.evaluate(() => { (window as any).failCompletion = true; });
  await finishMission(page, first.missions.at(-1));
  await expect(page.getByRole("alert")).toHaveText("Could not save Mystery completion");
  expect(await session(page)).toEqual(first);
  expect((await saved(page)).fajrReminderIndex).toBe(2);
  await page.getByRole("button", { name: "Dismiss message", exact: true }).click();
  await page.getByRole("button", { name: "Finish waking up", exact: true }).click();
  await expect(page.getByText("First win of the day.")).toBeVisible();
  expect(await session(page)).toBeUndefined();
  expect((await saved(page)).fajrReminderIndex).toBe(3);
});

test("an empty corrupt pool stays editable and cannot be accepted until two games are selected", async ({ page }) => {
  await seed(page);
  await page.goto("/alarms");
  await changeStored(page, state => { state.alarms[0].mystery.games = []; });
  await page.reload();
  await page.getByRole("button", { name: /^Edit alarm at/ }).click();
  await page.getByRole("button", { name: /Wake-up missions/ }).click();
  await page.getByRole("button", { name: /Choose missions/ }).click();
  await expect(page.getByTestId("mystery-config-error")).toBeVisible();
  const use = page.getByRole("button", { name: "Use Random Pick", exact: true });
  await expect(use).toBeDisabled();
  await page.getByRole("button", { name: "Math puzzle", exact: true }).click();
  await expect(use).toBeDisabled();
  await page.getByRole("button", { name: "Shake to wake", exact: true }).click();
  await expect(use).toBeEnabled();
  await use.click();
  await page.getByRole("button", { name: "Save alarm", exact: true }).click();
  await expect(page.getByText("Alarm saved. You’re all set.")).toBeVisible();
  expect((await saved(page)).alarms[0].mystery.games.map((m: any) => m.kind)).toEqual(["math", "shake"]);
});

test("configuration sections respond on their first tap and repeated opening with motion enabled", async ({ page }) => {
  await seed(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/alarms");
  await page.getByRole("button", { name: /^Edit alarm at/ }).click();
  for (let i = 0; i < 3; i++) {
    for (const [section, control] of [[/Sound & volume/, page.getByTestId("alarm-volume")], [/Wake-up missions/, page.getByRole("switch", { name: "Silent during missions", exact: true })], [/More options/, page.getByRole("button", { name: /Alarm background/ })], [/Block distracting apps/, page.getByTestId("app-block-duration")]] as const) {
      const row = page.getByRole("button", { name: section });
      await row.click();
      await expect(control).toBeVisible();
      if (section.source.includes("Block")) await control.selectOption("15");
      await row.click();
      await expect(control).toHaveCount(0);
    }
  }
  await page.getByRole("button", { name: /Sound & volume/ }).click();
  await page.getByTestId("alarm-volume").fill("65");
  await page.getByRole("button", { name: /Choose sound/ }).click();
  await page.getByRole("button", { name: "Select Digital Beep", exact: true }).click();
  await page.getByRole("button", { name: "Use this sound", exact: true }).click();
  await expect(page.getByTestId("alarm-volume")).toHaveValue("65");
});

test("Fajr is a selectable card in both modes and keeps each mode's saved preferences", async ({ page }) => {
  await seed(page);
  await page.goto("/alarms");
  const original = (await saved(page)).alarms[0];
  const openPicker = async () => {
    await page.getByRole("button", { name: /^Edit alarm at/ }).click();
    await page.getByRole("button", { name: /Wake-up missions/ }).click();
    await page.getByRole("button", { name: /Choose missions/ }).click();
  };
  const fajr = page.getByRole("button", { name: "Fajr reminder", exact: true });
  await openPicker();
  await expect(page.getByRole("button", { name: "Random Pick", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(fajr).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("switch", { name: "Include Fajr reminder", exact: true })).toHaveCount(0);
  await expect(page.getByText(/Each wake-up chooses/)).toHaveCount(0);
  await expect(page.getByText(/Fajr appears immediately before or after/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Manual", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Mystery", exact: true })).toHaveCount(0);
  await expect(page.getByTestId("rounds-fajr_reminder")).toHaveCount(0);
  for (const selected of [false, true, false]) {
    await expect(fajr).toBeEnabled(); await fajr.click();
    await expect(fajr).toHaveAttribute("aria-pressed", String(selected));
    await expect(page.getByText("2 ELIGIBLE GAMES", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Math puzzle", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Shake to wake", exact: true })).toBeDisabled();
  }
  await page.getByRole("button", { name: "Use Random Pick", exact: true }).click();
  await page.getByRole("button", { name: "Save alarm", exact: true }).click();
  await expect(page.getByText("Alarm saved. You’re all set.")).toBeVisible();
  await page.reload();
  expect((await saved(page)).alarms[0].mystery).toEqual({ ...original.mystery, fajr: false });
  await openPicker();
  await expect(fajr).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Set Order", exact: true }).click();
  await expect(fajr).toHaveAttribute("aria-pressed", "false"); await fajr.click();
  await page.getByRole("button", { name: "Random Pick", exact: true }).click();
  await expect(fajr).toHaveAttribute("aria-pressed", "false"); await fajr.click();
  await page.getByRole("button", { name: "Set Order", exact: true }).click();
  await expect(fajr).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Random Pick", exact: true }).click();
  await expect(fajr).toHaveAttribute("aria-pressed", "true"); await fajr.click();
  await page.getByRole("button", { name: "Set Order", exact: true }).click();
  await expect(fajr).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Use 3 missions", exact: true }).click();
  await page.getByRole("button", { name: "Save alarm", exact: true }).click();
  await expect(page.getByText("Alarm saved. You’re all set.")).toBeVisible();
  await page.reload();
  const configured = (await saved(page)).alarms[0];
  expect(configured.missionMode).toBe("manual");
  expect(configured.missions).toEqual([...original.missions, { kind: "fajr_reminder", difficulty: "gentle" }]);
  expect(configured.mystery).toEqual({ ...original.mystery, fajr: false });
  await openPicker();
  await expect(page.getByRole("button", { name: "Set Order", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(fajr).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Random Pick", exact: true }).click();
  await expect(fajr).toHaveAttribute("aria-pressed", "false");
});

test("new alarms stay in Set Order when choosing Fajr without enabling Random Pick", async ({ page }) => {
  await seed(page, true);
  await page.goto("/alarm");
  await page.getByRole("button", { name: /Wake-up missions/ }).click();
  await page.getByRole("button", { name: /Choose missions/ }).click();
  await expect(page.getByRole("button", { name: "Set Order", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Random Pick", exact: true })).toHaveAttribute("aria-pressed", "false");
  const fajr = page.getByRole("button", { name: "Fajr reminder", exact: true });
  await expect(fajr).toHaveAttribute("aria-pressed", "false"); await fajr.click();
  await page.getByRole("button", { name: "Use 1 mission", exact: true }).click();
  await page.getByRole("button", { name: "Save alarm", exact: true }).click();
  await expect(page.getByText("Alarm saved. You’re all set.")).toBeVisible();
  await page.reload();
  const created = (await saved(page)).alarms.find((a: any) => a.id !== "mystery");
  expect(created.missionMode ?? "manual").toBe("manual");
  expect(created.mystery).toBeUndefined();
  expect(created.missions).toEqual([{ kind: "fajr_reminder", difficulty: "gentle" }]);
});
