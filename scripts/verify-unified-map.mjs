import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const base = process.env.VNDMS_URL ?? "http://127.0.0.1:5173";
const route = "/workspace/B%E1%BA%A3n%20%C4%91%E1%BB%93%20t%C3%A1c%20nghi%E1%BB%87p";
const output = path.resolve("docs/05-architecture/unified-operational-map-evidence");
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
page.setDefaultTimeout(20_000);
page.setDefaultNavigationTimeout(30_000);

async function login() {
  await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
  const inputs = page.locator(".login-card input");
  await inputs.nth(0).fill("Trần Quốc Thuận");
  await inputs.nth(1).fill("VNDMS@2026");
  await page.getByRole("button", { name: /^Đăng nhập$/ }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"));
}

async function openWorkspace(target = route, requireCanvas = false) {
  await page.goto(`${base}${target}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Bản đồ tác nghiệp", level: 1 }).waitFor();
  await page.locator(".om-result-row").first().waitFor();
  await page.locator(".om-canvas-wrap").waitFor();
  if (requireCanvas)
    await page.locator(".om-canvas canvas.maplibregl-canvas").waitFor({ state: "attached" });
  await page.waitForTimeout(700);
}

async function inspect(mode, viewport) {
  const axe = await new AxeBuilder({ page }).analyze();
  const serious = axe.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? ""));
  const metrics = await page.evaluate(() => {
    const canvas = document.querySelector(".om-canvas canvas");
    const mapZone = document.querySelector(".om-map-zone");
    const panel = document.querySelector(".om-panel");
    return {
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
      resultCount: document.querySelectorAll(".om-result-row").length,
      layerCount: document.querySelectorAll(".om-layer-row").length,
      canvas: canvas ? { width: canvas.getBoundingClientRect().width, height: canvas.getBoundingClientRect().height } : null,
      mapZoneHeight: mapZone?.getBoundingClientRect().height ?? 0,
      panelHeight: panel?.getBoundingClientRect().height ?? 0,
      dataStatus: document.querySelector(".om-data-stamp")?.textContent?.trim() ?? "",
    };
  });
  await page.screenshot({ path: path.join(output, `${mode}.jpg`), type: "jpeg", quality: 76, timeout: 20_000 });
  return { mode, viewport, serious: serious.map((item) => item.id), ...metrics };
}

await login();
await openWorkspace(route, true);
const initialRows = await page.locator(".om-result-row").count();
const sosToggle = page.getByRole("checkbox", { name: /SOS/ });
await sosToggle.uncheck();
const rowsWithoutSos = await page.locator(".om-result-row").count();
if (rowsWithoutSos >= initialRows) throw new Error("Tắt lớp SOS không làm giảm kết quả bản đồ.");
await sosToggle.check();
const results = [await inspect("sang-desktop", "1440x900")];

await openWorkspace(`${route}?focus=SOS-0241`, true);
await page.locator(".om-drawer").waitFor();
if (!(await page.locator(".om-drawer").innerText()).includes("SOS-0241"))
  throw new Error("Deep-link focus không mở đúng drawer SOS-0241.");
await page.reload({ waitUntil: "domcontentloaded" });
await page.getByRole("heading", { name: "Bản đồ tác nghiệp", level: 1 }).waitFor();
await page.locator(".om-drawer").waitFor();
await page.screenshot({ path: path.join(output, "deep-link-sos-0241.jpg"), type: "jpeg", quality: 78, timeout: 20_000 });
await page.getByRole("button", { name: /Mở trang chi tiết/ }).click();
await page.waitForURL(/\/sos\/SOS-0241$/);
const canonicalDetailPath = new URL(page.url()).pathname;

await openWorkspace();
await page.evaluate(() => { document.documentElement.dataset.theme = "dark"; localStorage.setItem("vndms-theme", "dark"); });
results.push(await inspect("toi-desktop", "1440x900"));

for (const [mode, viewport] of [["sang-tablet", { width: 820, height: 1180 }], ["sang-mobile", { width: 390, height: 844 }]]) {
  await page.setViewportSize(viewport);
  await openWorkspace();
  await page.evaluate(() => { document.documentElement.dataset.theme = "light"; localStorage.setItem("vndms-theme", "light"); });
  results.push(await inspect(mode, `${viewport.width}x${viewport.height}`));
}

const summary = {
  route,
  checks: results.length,
  seriousAccessibilityViolations: results.reduce((sum, item) => sum + item.serious.length, 0),
  horizontalOverflowScreens: results.filter((item) => item.horizontalOverflow).length,
  initialRows,
  rowsWithoutSos,
  canonicalDetailPath,
  deepLinkRefreshDrawer: true,
  results,
};
fs.writeFileSync(path.join(output, "verification-results.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
await browser.close();
