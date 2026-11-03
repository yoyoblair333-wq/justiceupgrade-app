// Records a short demo of the JusticeUpgrade v2 frontend reading the live v2
// contract on studionet: hero, how it works, the bike-1 case (ruling, panel
// votes, appeal ladder, evidence with the fetched excerpt) and the precedent
// ledger. Output: a .webm in the given directory (convert with ffmpeg).
//
//   node scripts/v2_demo_record.mjs http://localhost:3000 /tmp/out
import { chromium } from "playwright";

const URL = process.argv[2] ?? "http://localhost:3000";
const OUT = process.argv[3] ?? "/tmp/v2-demo";
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: "localhost,127.0.0.1" } : undefined;

const browser = await chromium.launch({ proxy, args: ["--ignore-certificate-errors"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: OUT, size: { width: 1280, height: 800 } }, colorScheme: "dark", ignoreHTTPSErrors: true });
const page = await ctx.newPage();
const pause = (ms) => page.waitForTimeout(ms);
const glide = async (y, steps = 25) => {
  const start = await page.evaluate(() => window.scrollY);
  for (let i = 1; i <= steps; i++) { await page.evaluate((v) => window.scrollTo(0, v), start + ((y - start) * i) / steps); await pause(40); }
};

await page.goto(URL, { waitUntil: "networkidle" });
await pause(2500);
await glide(500); await pause(2000);
await glide(1000); await pause(1500);

// Look up the live bike-1 case
const box = page.getByPlaceholder(/agreement/i).last();
await box.scrollIntoViewIfNeeded(); await pause(800);
await box.click(); await box.pressSequentially("bike-1", { delay: 120 }); await pause(500);
await page.keyboard.press("Enter");
await pause(7000);
const viewer = box.locator("xpath=ancestor::*[self::section or self::div][3]");
await viewer.scrollIntoViewIfNeeded().catch(() => {});
await pause(2500);
for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 260); await pause(1100); }

// Precedent ledger
const prec = page.getByText(/Precedent/i).first();
await prec.scrollIntoViewIfNeeded().catch(() => {}); await pause(4000);
for (let i = 0; i < 3; i++) { await page.mouse.wheel(0, 250); await pause(1100); }
await pause(1500);

await ctx.close();
await browser.close();
console.log("recorded to", OUT);
