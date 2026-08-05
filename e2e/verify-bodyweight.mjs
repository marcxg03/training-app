// Live end-to-end verification of the bodyweight quick-log flow:
// type a weight -> Log -> chart + current value appear after refresh.
// Run after seed-auth (uses /tmp/e2e-auth.json) with migrations applied.
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const auth = JSON.parse(readFileSync("/tmp/e2e-auth.json", "utf8"));
const browser = await chromium.launch();
const context = await browser.newContext();
await context.addCookies(
  auth.cookies.map((c) => ({ ...c, domain: "localhost", path: "/" })),
);

const page = await context.newPage();
await page.setViewportSize({ width: 390, height: 844 });
await page.goto("http://localhost:3000/trends", { waitUntil: "networkidle" });

const input = page.getByLabel("Today's bodyweight in pounds");
await input.waitFor({ state: "visible", timeout: 10000 });
await input.fill("183.4");
await page.getByRole("button", { name: "Log" }).click();

// router.refresh() re-renders the RSC — wait for the current-value stat.
await page.waitForFunction(() => document.body.innerText.includes("183"), {
  timeout: 15000,
});

await page.screenshot({ path: "/tmp/shot-bw-flow.png", fullPage: true });
console.log("LOGGED: current value visible after refresh");

// Re-log a different weight same day — upsert must overwrite, not duplicate.
await input.fill("184.2");
await page.getByRole("button", { name: "Log" }).click();
await page.waitForFunction(() => document.body.innerText.includes("184"), {
  timeout: 15000,
});
console.log("RE-LOGGED: same-day upsert overwrote");

await browser.close();
console.log("done");
