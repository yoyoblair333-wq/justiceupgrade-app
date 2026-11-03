// Records a short demo of the JusticeUpgrade v2 frontend reading the live v2
// contract on studionet: hero, how it works, the bike-1 case (ruling, panel
// votes, appeal ladder, evidence with the fetched excerpt) and the precedent
// ledger. Output: a .webm in the given directory (convert with ffmpeg).
//
//   node scripts/v2_demo_record.mjs http://localhost:3000 /tmp/out
import { chromium } from "/home/claude/.npm-global/lib/node_modules/playwright/index.mjs";

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
await pause(3000);                               // hero
await glide(420); await pause(2500);             // live web evidence + how it works
// Jump to the tracker and open the live bike-1 case
const box = page.getByPlaceholder(/agreement ID/i).last();
const boxY = await box.evaluate((el) => el.getBoundingClientRect().top + window.scrollY - 160);
await glide(boxY, 30); await pause(800);
await box.click(); await box.pressSequentially("bike-1", { delay: 110 }); await pause(400);
await page.keyboard.press("Enter");
await page.getByText(/Arbiter.s verdict/i).first().waitFor({ timeout: 30000 }).catch(() => {});
await pause(2500);
// Walk down the case: parties, terms, evidence (with the page the chain fetched), verdict, appeal ladder
for (let i = 0; i < 16; i++) { await page.mouse.wheel(0, 140); await pause(650); }
await pause(1500);
// Precedent ledger at the bottom
const prec = page.getByRole("heading", { name: /Precedent/i });
const pY = await prec.evaluate((el) => el.getBoundingClientRect().top + window.scrollY - 120).catch(() => null);
if (pY !== null) { await glide(pY, 30); }
await pause(4500);
await ctx.close();
await browser.close();
console.log("recorded to", OUT);
