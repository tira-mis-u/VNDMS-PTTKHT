import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const base = process.env.VNDMS_URL ?? "http://127.0.0.1:5173";
const output = path.resolve("docs/05-architecture/phase-4-evidence/detail-and-interaction");
fs.mkdirSync(output, { recursive: true });
const scope = process.env.VERIFY_SCOPE ?? "all";
const viewports = [
  ["1440x900", { width: 1440, height: 900 }],
  ["768x1024", { width: 768, height: 1024 }],
  ["390x844", { width: 390, height: 844 }],
];
const modes = viewports.flatMap(([label, viewport]) => [
  [`sang-${label}`, viewport, "light"],
  [`toi-${label}`, viewport, "dark"],
]);
const detailRoutes = [
  ["su-co", "/incidents/INC-0241"],
  ["nhiem-vu", "/tasks/TSK-0241"],
  ["doi-cuu-ho", "/teams/CH-01"],
  ["diem-so-tan", "/shelters/TH-01"],
  ["so-tan", "/evacuations/EVAC-001"],
  ["sos", "/sos/SOS-0241"],
  ["yeu-cau-cuu-tro", "/relief/requests/REQ-0241"],
  ["kho-vat-tu", "/relief/warehouses/KHO-01"],
  ["phuong-an", "/playbooks/PB-FLOOD-001"],
  ["danh-gia-thiet-hai", "/recovery/assessments/DA-0241"],
  ["du-an-phuc-hoi", "/recovery/projects/RP-0241"],
];
const forbiddenVisible = /\b(canonical|OperationalProvider|Playbook|Incident|workspace|provider|ownership|backend|production|SUCCESS|DENIED|FAILED|Seed|Tick|Loading|Error|Warning|Critical)\b/i;
const browser = await chromium.launch({ headless: true, args: ["--enable-unsafe-swiftshader"] });
const context = await browser.newContext({ viewport: modes[0][1] });
const page = await context.newPage();
page.setDefaultTimeout(20_000);
page.setDefaultNavigationTimeout(30_000);
await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
const inputs = page.locator(".login-card input");
await inputs.nth(0).fill("Trần Quốc Thuận");
await inputs.nth(1).fill("VNDMS@2026");
await page.getByRole("button", { name: /^Đăng nhập$/ }).click();
await page.waitForURL((url) => !url.pathname.endsWith("/login"));

await page.goto(`${base}/alerts`, { waitUntil: "domcontentloaded" });
await page.locator(".alert-row-main").first().click();
await page.waitForURL((url) => url.pathname.startsWith("/alerts/"));
const alertPath = new URL(page.url()).pathname;
detailRoutes.push(["canh-bao", alertPath]);

const previousResultFile = path.join(output, "verification-results.json");
const results = scope === "interactions" && fs.existsSync(previousResultFile)
  ? JSON.parse(fs.readFileSync(previousResultFile, "utf8")).results.filter((item) => item.kind === "detail")
  : [];
const axeSerious = async () => (await new AxeBuilder({ page }).analyze()).violations
  .filter((item) => ["serious", "critical"].includes(item.impact ?? ""))
  .map((item) => item.id);
const setTheme = async (theme) => {
  await page.evaluate((value) => {
    document.documentElement.dataset.theme = value;
    localStorage.setItem("vndms-theme", value);
  }, theme);
  await page.waitForTimeout(120);
};
const visibleMetrics = async () => page.evaluate((forbiddenSource) => {
  const text = document.body.innerText;
  const forbidden = new RegExp(forbiddenSource, "i").exec(text)?.[0] ?? null;
  const h1 = document.querySelector("h1");
  const header = h1?.closest("header, .page-header") ?? null;
  const rect = header?.getBoundingClientRect();
  return {
    title: h1?.textContent?.trim() ?? "",
    missingTitle: !h1,
    missingDetailHeader: !header,
    headerOutside: rect ? rect.left < -2 || rect.right > innerWidth + 2 : false,
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
    forbiddenVisible: forbidden,
  };
}, forbiddenVisible.source);
const capture = async (name) => {
  await page.screenshot({ path: path.join(output, `${name}.jpg`), type: "jpeg", quality: 65, timeout: 20_000 });
};
const verifyInteraction = async ({ mode, viewport, theme, slug, selector, screenshot }) => {
  const element = page.locator(selector).first();
  await element.waitFor();
  const metrics = await element.evaluate((node, forbiddenSource) => {
    const rect = node.getBoundingClientRect();
    const forbidden = new RegExp(forbiddenSource, "i").exec(document.body.innerText)?.[0] ?? null;
    return {
      visible: rect.width > 0 && rect.height > 0 && getComputedStyle(node).visibility !== "hidden",
      clippedHorizontally: rect.left < -2 || rect.right > innerWidth + 2,
      documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
      forbiddenVisible: forbidden,
    };
  }, forbiddenVisible.source);
  const serious = await axeSerious();
  await capture(screenshot);
  results.push({
    kind: "interaction", mode, viewport: `${viewport.width}x${viewport.height}`,
    theme, slug, selector, serious, ...metrics,
  });
};

for (const [mode, viewport, theme] of modes) {
  await page.setViewportSize(viewport);
  if (scope !== "interactions") {
    for (const [slug, route] of detailRoutes) {
      await page.goto(`${base}${route}`, { waitUntil: "domcontentloaded" });
      await setTheme(theme);
      await page.locator("h1").first().waitFor();
      await page.waitForTimeout(180);
      const metrics = await visibleMetrics();
      const serious = await axeSerious();
      await capture(`${mode}--chi-tiet-${slug}`);
      results.push({ kind: "detail", mode, viewport: `${viewport.width}x${viewport.height}`, theme, route, slug, serious, ...metrics });
      console.log(`${mode} detail ${route}: axe=${serious.length} overflow=${metrics.horizontalOverflow}`);
    }
  }

  // Account popover.
  await page.goto(`${base}/`, { waitUntil: "domcontentloaded" }); await setTheme(theme);
  await page.locator(".account").click();
  await verifyInteraction({ mode, viewport, theme, slug: "account-popover", selector: ".account-popover", screenshot: `${mode}--tuong-tac-tai-khoan` });

  // Mobile navigation drawer where applicable.
  if (await page.getByRole("button", { name: "Mở điều hướng" }).isVisible()) {
    await page.getByRole("button", { name: "Mở điều hướng" }).click();
    await page.waitForTimeout(320);
    await verifyInteraction({ mode, viewport, theme, slug: "mobile-sidebar", selector: ".sidebar-mobile-open", screenshot: `${mode}--tuong-tac-dieu-huong` });
  }

  // Map entity drawer.
  await page.goto(`${base}/workspace/B%E1%BA%A3n%20%C4%91%E1%BB%93%20t%C3%A1c%20nghi%E1%BB%87p`, { waitUntil: "domcontentloaded" }); await setTheme(theme);
  await page.locator(".om-result-row").first().click();
  await verifyInteraction({ mode, viewport, theme, slug: "map-drawer", selector: ".om-drawer", screenshot: `${mode}--tuong-tac-ban-do` });

  // Incident creation dialog.
  await page.goto(`${base}/incidents`, { waitUntil: "domcontentloaded" }); await setTheme(theme);
  await page.getByRole("button", { name: /Tạo sự cố/ }).first().click();
  await verifyInteraction({ mode, viewport, theme, slug: "incident-dialog", selector: ".incident-form-dialog", screenshot: `${mode}--tuong-tac-tao-su-co` });

  // User drawer.
  await page.goto(`${base}/admin/users`, { waitUntil: "domcontentloaded" }); await setTheme(theme);
  await page.locator(".row-open").first().click();
  await verifyInteraction({ mode, viewport, theme, slug: "user-drawer", selector: ".admin-user-drawer", screenshot: `${mode}--tuong-tac-nguoi-dung` });

  // AI conversation composer and deterministic response.
  await page.goto(`${base}/ai-assistant`, { waitUntil: "domcontentloaded" }); await setTheme(theme);
  await page.locator(".ai-composer textarea").fill("Điều gì cần xử lý ngay?");
  await page.locator(".ai-composer button").click();
  await page.locator(".ai-response").last().waitFor();
  await verifyInteraction({ mode, viewport, theme, slug: "ai-conversation", selector: ".ai-response", screenshot: `${mode}--tuong-tac-tro-ly` });
}
const failures = results.filter((item) => item.kind === "detail"
  ? item.serious.length || item.missingTitle || item.missingDetailHeader || item.headerOutside ||
    item.horizontalOverflow || item.forbiddenVisible
  : item.serious.length || !item.visible || item.clippedHorizontally ||
    item.documentOverflow || item.forbiddenVisible
);
const summary = {
  generatedAt: new Date().toISOString(),
  detailRoutes: detailRoutes.length,
  modes: modes.length,
  detailChecks: results.filter((item) => item.kind === "detail").length,
  interactionChecks: results.filter((item) => item.kind === "interaction").length,
  failures: failures.length,
  axeSeriousCritical: results.reduce((sum, item) => sum + item.serious.length, 0),
  results,
};
fs.writeFileSync(path.join(output, "verification-results.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ ...summary, results: undefined }, null, 2));
await browser.close();
if (failures.length) process.exitCode = 1;
