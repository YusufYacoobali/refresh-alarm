import { test, expect, Page } from "@playwright/test";

async function seed(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    if (localStorage.getItem("daybreak.state.v1")) return;
    localStorage.setItem("daybreak.state.v1", JSON.stringify({ version: 1, onboarded: true, theme: "serene", journal: [], completions: [],
      alarms: [{ id: "focus", hour: 7, minute: 20, days: [], label: "Fresh focus", enabled: true, sound: "system", challenge: "number_order", difficulty: "gentle", snooze: 0,
        missions: [{ kind: "number_order", difficulty: "gentle", rounds: 2 }, { kind: "color_focus", difficulty: "bright" }, { kind: "sequence", difficulty: "gentle" }] }] }));
  });
}

test("new missions enforce answers, rounds and sequence before dismissing", async ({ page }) => {
  await seed(page);
  await page.goto("/challenge?id=focus");
  await page.getByRole("button", { name: "Number 8", exact: true }).click();
  await expect(page.getByText("Tap 1", { exact: true })).toBeVisible();
  for (let round = 1; round <= 2; round++) {
    await expect(page.getByTestId("mission-round")).toHaveText(`Round ${round} of 2`);
    for (let n = 1; n <= 8; n++) await page.getByRole("button", { name: `Number ${n}`, exact: true }).click();
  }
  await expect(page.getByText("Mission 2 of 3", { exact: true })).toBeVisible();
  const highlighted = page.getByRole('button', { name: /^Tile /, pressed: true });
  await expect(highlighted).toHaveCount(8);
  const targets = await highlighted.evaluateAll(tiles => tiles.map(t => t.getAttribute('aria-label')!));
  await expect(page.getByTestId('recall-phase')).toHaveText('Find the 8 tiles');
  for (const tile of targets.reverse()) await page.getByRole('button', { name: tile, exact: true }).click();
  await expect(page.getByText("Mission 3 of 3", { exact: true })).toBeVisible();
  const cues = await watchPattern(page);
  const wrong = ["Pad 1", "Pad 2"].find(t => t !== cues[0])!;
  await page.getByRole("button", { name: wrong, exact: true }).click();
  await expect(page.getByTestId("pattern-phase")).toHaveText("Watch the lights");
  expect(await watchPattern(page)).toEqual(cues);
  for (const cue of cues) await page.getByRole("button", { name: cue, exact: true }).click();
  await expect(page.getByText("First win of the day.")).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("daybreak.state.v1")!));
  expect(saved.completions).toHaveLength(1);
  expect(saved.alarms[0].enabled).toBe(false);
});

test('tile recall scales its grid and targets, keeps a two-second preview and resets mistakes', async ({ page }) => {
  await seed(page);
  await page.setViewportSize({ width: 320, height: 640 });
  await page.clock.install({ time: new Date('2026-09-23T06:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-23T06:00:01Z'));
  for (const [difficulty, count, targetCount] of [['gentle', 16, 3], ['bright', 36, 8]] as const) {
    await page.goto(`/challenge?id=demo&preview=1&kind=color_focus&difficulty=${difficulty}&rounds=2`);
    const tiles = page.getByRole('button', { name: /^Tile / });
    const lit = page.getByRole('button', { name: /^Tile /, pressed: true });
    await expect(tiles).toHaveCount(count);
    await expect(lit).toHaveCount(targetCount);
    expect(await tiles.allTextContents()).toEqual(Array(count).fill(''));
    for (const tile of await tiles.all()) {
      await expect(tile).toBeDisabled();
      const bounds = (await tile.boundingBox())!;
      expect(bounds.width).toBeGreaterThanOrEqual(44);
      expect(bounds.height).toBeGreaterThanOrEqual(44);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(640);
    }
    const targets = await lit.evaluateAll(elements => elements.map(e => e.getAttribute('aria-label')!));
    await page.clock.runFor(1999);
    await expect(lit).toHaveCount(targetCount);
    await expect(page.getByTestId('recall-phase')).toHaveText('Remember these tiles');
    await page.screenshot({ path: `artifacts/islamic-refresh/tile-recall-${difficulty}.png` });
    await page.clock.runFor(1);
    await expect(lit).toHaveCount(0);
    await expect(page.getByTestId('recall-phase')).toHaveText(`Find the ${targetCount} tiles`);
    await page.getByRole('button', { name: targets[0], exact: true }).click();
    await expect(page.getByRole('button', { name: targets[0], exact: true })).toBeDisabled();
    const wrong = Array.from({ length: count }, (_, i) => `Tile ${i + 1}`).find(t => !targets.includes(t))!;
    await page.getByRole('button', { name: wrong, exact: true }).click();
    await expect(page.getByTestId('recall-phase')).toHaveText('Remember these tiles');
    await page.clock.runFor(2000);
    await expect(lit).toHaveCount(0);
    for (const tile of targets.reverse()) await page.getByRole('button', { name: tile, exact: true }).click();
    await expect(page.getByTestId('mission-round')).toHaveText('Round 2 of 2');
    await expect(lit).toHaveCount(targetCount);
    const second = await lit.evaluateAll(elements => elements.map(e => e.getAttribute('aria-label')!));
    await page.clock.runFor(2000);
    for (const tile of second.reverse()) await page.getByRole('button', { name: tile, exact: true }).click();
    await expect(page.getByText('First win of the day.')).toBeVisible();
  }
});

async function watchPattern(page: Page) {
  const cues: string[] = [];
  while (await page.getByTestId("pattern-phase").textContent() === "Watch the lights") {
    const lit = await page.getByRole("button", { name: /^Pad /, pressed: true }).evaluateAll(elements => elements[0]?.getAttribute("aria-label"));
    if (lit && cues.at(-1) !== lit) cues.push(lit);
    await page.waitForTimeout(80);
  }
  expect(cues).toHaveLength(4);
  return cues;
}

test("visual games fill the phone and every pad remains onscreen", async ({ page }) => {
  await seed(page);
  for (const size of [{ width: 320, height: 640 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(size);
    for (const kind of ['sequence', 'color_focus', 'number_order']) {
      await page.goto(`/challenge?id=demo&preview=1&kind=${kind}`);
      const board = page.getByTestId('mission-board');
      await expect(board).toBeVisible();
      const box = (await board.boundingBox())!;
      expect(box.height).toBeGreaterThan(size.height * .60);
      expect(box.y + box.height).toBeLessThanOrEqual(size.height);
      for (const pad of await board.getByRole('button').all()) {
        const rect = (await pad.boundingBox())!;
        expect(rect.height).toBeGreaterThan(70);
        expect(rect.x + rect.width).toBeLessThanOrEqual(size.width);
      }
    }
  }
});

test("chosen duas survive preview, save and reload and only chosen duas run", async ({ page }) => {
  await seed(page);
  await page.goto("/alarms");
  await page.getByRole("button", { name: /^Edit Fresh focus/ }).click();
  await page.getByRole("button", { name: /Wake-up missions/ }).click();
  await page.getByRole("button", { name: /Choose missions/ }).click();
  await page.getByRole("button", { name: "No missions", exact: true }).click();
  await page.getByRole("button", { name: "Islamic supplication", exact: true }).click();
  for (const title of ["Upon waking", "Contentment in faith"]) await page.getByRole("button", { name: `Dua: ${title}`, exact: true }).click();
  await expect(page.getByRole("button", { name: "Dua: Seeking protection", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Preview Islamic supplication", exact: true }).click();
  await expect(page.getByTestId("dua-title")).toHaveText("Seeking protection");
  await expect(page.getByText("Dua 1 of 1 · Morning & evening")).toBeVisible();
  await page.getByRole("button", { name: "Close challenge preview", exact: true }).click();
  await page.getByRole("button", { name: "Use 1 mission", exact: true }).click();
  await page.getByRole("button", { name: "Save alarm", exact: true }).click();
  await expect(page.getByText("Alarm saved. You’re all set.")).toBeVisible();
  await page.reload();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("daybreak.state.v1")!));
  expect(saved.alarms[0].missions[0].duaIds).toEqual(["protection"]);
  expect(saved.alarms[0].minute).toBe(20);
  await page.goto("/challenge?id=focus");
  await expect(page.getByTestId("dua-title")).toHaveText("Seeking protection");
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "I’ve recited it", exact: true }).click();
  await expect(page.getByText("First win of the day.")).toBeVisible();
});

test("hard number trail counts backwards and new previews fit a small phone", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/challenge?id=demo&preview=1&kind=number_order&difficulty=bright");
  for (let n = 12; n >= 1; n--) {
    await expect(page.getByText(`Tap ${n}`, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: `Number ${n}`, exact: true }).click();
  }
  await expect(page.getByText("First win of the day.")).toBeVisible();
});
