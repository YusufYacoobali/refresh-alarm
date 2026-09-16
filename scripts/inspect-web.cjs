const { chromium } = require("@playwright/test");
const fs = require("node:fs");
(async () => {
  fs.mkdirSync("artifacts/screenshots", { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("http://localhost:8081", {
    waitUntil: "networkidle",
    timeout: 120000,
  });
  await page
    .getByRole("button", { name: "Refresh my mornings", exact: true })
    .waitFor({ timeout: 45000 })
    .catch(() => {});
  await page.waitForTimeout(2500);
  console.log(
    "images",
    await page.locator("img").evaluateAll((images) =>
      images.map((i) => ({
        src: i.src,
        complete: i.complete,
        width: i.naturalWidth,
      })),
    ),
  );
  await page.screenshot({ path: "artifacts/screenshots/01-onboarding.png" });
  console.log(
    JSON.stringify({
      url: page.url(),
      text: await page.locator("body").innerText(),
      errors,
    }),
  );
  await browser.close();
})();
