import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const base = process.env.VNDMS_URL ?? "http://127.0.0.1:5173";
const output = path.resolve("docs/05-architecture/ui-normalization-screenshots");
fs.mkdirSync(output, { recursive: true });
const routes = [
  ["trung-tam-dieu-hanh", "/"],
  ["su-co-danh-sach", "/incidents"],
  ["su-co-chi-tiet", "/incidents/INC-0241"],
  ["sos-danh-sach", "/sos"],
  ["sos-chi-tiet", "/sos/SOS-0241"],
  ["doi-cuu-ho-danh-sach", "/teams"],
  ["doi-cuu-ho-chi-tiet", "/teams/CH-05"],
  ["canh-bao", "/alerts"],
  ["so-tan", "/evacuations"],
  ["phuc-hoi", "/recovery"],
  ["mo-phong", "/simulation"],
  ["tro-ly-ai", "/ai-assistant"],
  ["quan-tri", "/admin/users"],
  ["ho-so", "/profile"],
];
const browser = await chromium.launch({ headless: true });
const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await desktop.newPage();
await page.goto(`${base}/login`);
await page.screenshot({ path: path.join(output, "dang-nhap-sang-desktop.jpg"), type: "jpeg", quality: 72 });
const inputs = page.locator(".login-card input");
await inputs.nth(0).fill("Trần Quốc Thuận");
await inputs.nth(1).fill("VNDMS@2026");
await page.getByRole("button", { name: /^Đăng nhập$/ }).click();
await page.waitForURL((url) => !url.pathname.endsWith("/login"));

const results = [];
async function inspect(page, name, route, mode, viewport) {
  await page.goto(`${base}${route}`, { waitUntil: "domcontentloaded" });
  await page
    .getByText(/Đang tải không gian tác nghiệp/)
    .waitFor({ state: "hidden", timeout: 10_000 })
    .catch(() => undefined);
  await page.waitForTimeout(route.includes("workspace") ? 1200 : 500);
  const axe = await new AxeBuilder({ page }).analyze();
  const serious = axe.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? ""));
  const metrics = await page.evaluate(() => {
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.visibility !== "hidden" &&
        style.display !== "none" &&
        style.clipPath !== "inset(50%)" &&
        rect.width > 0 &&
        rect.height > 0
      );
    };
    const textElements = [...document.querySelectorAll("body *")].filter(
      (element) => element.children.length === 0 && element.textContent?.trim() && visible(element),
    );
    const tooSmall = textElements
      .map((element) => ({ text: element.textContent.trim().slice(0, 80), size: parseFloat(getComputedStyle(element).fontSize) }))
      .filter((item) => item.size < 12.5);
    const controls = [...document.querySelectorAll('input:not([type="hidden"]), textarea, .ui-select-trigger')]
      .filter(visible)
      .map((element) => Math.round(element.getBoundingClientRect().height));
    return {
      title: document.title,
      tooSmall,
      controls,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
      customSelects: document.querySelectorAll(".ui-select").length,
      nativeVisibleSelects: [...document.querySelectorAll("select")].filter(visible).length,
    };
  });
  await page.screenshot({ path: path.join(output, `${name}-${mode}.jpg`), type: "jpeg", quality: 68 });
  results.push({
    name,
    route,
    mode,
    viewport,
    serious: serious.map((item) => ({
      id: item.id,
      nodes: item.nodes.map((node) => ({ target: node.target, html: node.html, failureSummary: node.failureSummary })),
    })),
    ...metrics,
  });
}

for (const [name, route] of routes) await inspect(page, name, route, "sang-desktop", "1440x900");

// Chứng minh popup Select tùy biến và thao tác bàn phím.
await page.goto(`${base}/incidents`, { waitUntil: "domcontentloaded" });
await page
  .getByText(/Đang tải không gian tác nghiệp/)
  .waitFor({ state: "hidden", timeout: 10_000 })
  .catch(() => undefined);
const firstSelect = page.locator(".ui-select-trigger").first();
if (await firstSelect.count()) {
  await firstSelect.focus();
  await firstSelect.press("ArrowDown");
  await page.screenshot({ path: path.join(output, "select-tuy-bien-ban-phim.jpg"), type: "jpeg", quality: 75 });
  await firstSelect.press("Escape");
}

await page.evaluate(() => { document.documentElement.dataset.theme = "dark"; localStorage.setItem("vndms-theme", "dark"); });
for (const [name, route] of routes) await inspect(page, name, route, "toi-desktop", "1440x900");
const storage = await desktop.storageState();

const tablet = await browser.newContext({ viewport: { width: 820, height: 1180 }, deviceScaleFactor: 1, storageState: storage });
const tabletPage = await tablet.newPage();
await tabletPage.goto(`${base}/`);
await tabletPage.evaluate(() => { document.documentElement.dataset.theme = "light"; localStorage.setItem("vndms-theme", "light"); });
for (const [name, route] of routes) await inspect(tabletPage, name, route, "sang-tablet", "820x1180");

const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, storageState: storage });
const mobilePage = await mobile.newPage();
await mobilePage.goto(`${base}/`);
await mobilePage.evaluate(() => { document.documentElement.dataset.theme = "light"; localStorage.setItem("vndms-theme", "light"); });
for (const [name, route] of routes) await inspect(mobilePage, name, route, "sang-mobile", "390x844");

fs.writeFileSync(path.join(output, "verification-results.json"), JSON.stringify(results, null, 2));
await browser.close();
const summary = {
  routeChecks: results.length,
  routes: routes.length,
  seriousAccessibilityViolations: results.reduce((sum, item) => sum + item.serious.length, 0),
  uniqueSeriousAccessibilityRules: [...new Set(results.flatMap((item) => item.serious.map((violation) => violation.id)))],
  screensWithTextBelow12_5: results.filter((item) => item.tooSmall.length).length,
  screensWithHorizontalOverflow: results.filter((item) => item.horizontalOverflow).length,
  visibleNativeSelects: Math.max(...results.map((item) => item.nativeVisibleSelects)),
};
console.log(JSON.stringify(summary, null, 2));
