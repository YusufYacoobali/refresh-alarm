import { test, expect, type Page } from "@playwright/test";

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
async function finishRoutine(page: Page, missions: any[]) {
  let count = 0;
  for (const mission of missions) {
    await expect(page.getByText(`Mission ${++count} of ${missions.length}`, { exact: true })).toBeVisible();
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
  await expect(page.getByText("First win of the day.")).toBeVisible();
}

test("Manual and Mystery settings remain independent through switching, previews, saving and reload", async ({ page }) => {
  await seed(page, true);
  await page.goto("/alarms");
  await page.getByRole("button", { name: /^Edit alarm at/ }).click();
  await page.getByRole("button", { name: /Wake-up missions/ }).click();
  await page.getByRole("button", { name: /Choose missions/ }).click();
  await expect(page.getByRole("button", { name: "Manual", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Mystery", exact: true }).click();
  await expect(page.getByTestId("rounds-math")).toHaveValue("3");
  for (const game of ["Memory match", "Number trail", "Tile recall", "Pattern echo"]) await page.getByRole("button", { name: game, exact: true }).click();
  await expect(page.getByRole("button", { name: "Math puzzle", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Shake to wake", exact: true })).toBeDisabled();
  for (const title of ["Contentment in faith", "Seeking protection"]) await page.getByRole("button", { name: `Dua: ${title}`, exact: true }).click();
  await expect(page.getByRole("button", { name: "Dua: Upon waking", exact: true })).toBeDisabled();
  await page.getByRole("switch", { name: "Include Fajr reminder", exact: true }).click();
  await page.getByTestId("rounds-math").selectOption("4");
  await page.getByRole("button", { name: "Preview Math puzzle", exact: true }).click();
  await expect(page.getByTestId("mission-round")).toHaveText("Round 1 of 4");
  await page.getByRole("button", { name: "Close challenge preview", exact: true }).click();
  await page.getByRole("button", { name: "Manual", exact: true }).click();
  await expect(page.getByTestId("rounds-math")).toHaveValue("3");
  await page.getByRole("button", { name: "Mystery", exact: true }).click();
  await expect(page.getByTestId("rounds-math")).toHaveValue("4");
  await page.getByRole("button", { name: "Use Mystery Mode", exact: true }).click();
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
  await expect(page.getByRole("button", { name: "Mystery", exact: true })).toHaveAttribute("aria-pressed", "true");
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
  expect((await session(page)).completed).toBe(true);
  expect((await saved(page)).fajrReminderIndex).toBe(3);
  expect((await saved(page)).completions).toHaveLength(1);
  await page.clock.fastForward(65000);
  await expect(page.getByText("First win of the day.")).toBeVisible();
  // The next scheduled wake-up generates once and avoids yesterday's order.
  await page.clock.fastForward(86400000);
  await page.goto("/ringing?id=mystery&eventId=next-scheduled");
  await expect.poll(async () => (await session(page))?.id).not.toBe(first.id);
  const next = await session(page);
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
