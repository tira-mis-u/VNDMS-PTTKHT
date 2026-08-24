import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "docs/05-architecture/ui-system-full-repair-evidence/interactions");
fs.mkdirSync(output, { recursive: true });
const base = process.env.BASE_URL || "http://127.0.0.1:5173";
const axeSource = fs.readFileSync(path.join(root, "node_modules/axe-core/axe.min.js"), "utf8");
const browser = await chromium.launch({ headless: true });
const results = [];

async function login(viewport = { width: 1440, height: 900 }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
  const inputs = page.locator(".login-card input");
  await inputs.nth(0).fill("Trần Quốc Thuận");
  await inputs.nth(1).fill("VNDMS@2026");
  await page.getByRole("button", { name: /Đăng nhập/ }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"));
  return { context, page };
}

async function audit(page, name, extra = {}) {
  await page.addScriptTag({ content: axeSource });
  const measured = await page.evaluate(async () => {
    const serious = (await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } })).violations
      .filter((item) => item.impact === "serious" || item.impact === "critical")
      .map((item) => item.id);
    const dialogs = [...document.querySelectorAll('[role="dialog"]')].filter((el) => {
      const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0;
    }).map((el) => {
      const r = el.getBoundingClientRect();
      return { label: el.getAttribute("aria-label") || el.getAttribute("aria-labelledby"), left: r.left, top: r.top, right: r.right, bottom: r.bottom, withinViewport: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight };
    });
    return { serious, dialogs, horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 };
  });
  const screenshot = path.join(output, `${String(results.length + 1).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path: screenshot, fullPage: true });
  results.push({ name, screenshot: path.relative(root, screenshot), ...measured, ...extra });
}

// Focus, open select, hover, empty and error states.
{
  const { context, page } = await login();
  await page.goto(`${base}/alerts`); await page.locator(".workspace-content").waitFor();
  const search = page.locator(".ui-search input").first(); await search.focus();
  const focusStyle = await search.evaluate((el) => { const wrapper = el.closest(".ui-search"); const s = getComputedStyle(wrapper); return { borderColor: s.borderColor, boxShadow: s.boxShadow }; });
  await audit(page, "input-search-focus", { focusStyle });
  const select = page.locator('button[role="combobox"]').first(); await select.click();
  await page.waitForTimeout(180);
  const dropdown = await page.locator('[role="listbox"]').evaluate((el) => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, withinViewport: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight }; });
  await audit(page, "select-open", { dropdown });
  await page.keyboard.press("Escape");
  const row = page.locator(".alert-row").first();
  const before = await row.evaluate((el) => getComputedStyle(el).backgroundColor); await row.hover();
  const after = await row.evaluate((el) => getComputedStyle(el).backgroundColor);
  await audit(page, "table-row-hover", { hoverStyleChanged: before !== after, before, after });
  await search.fill("__khong_co_du_lieu__");
  await page.getByText(/Không tìm thấy|Không có/).first().waitFor();
  await audit(page, "empty-search-results", { emptyStateVisible: true });
  await page.goto(`${base}/alerts/__khong-ton-tai__`); await page.getByText("Không tìm thấy cảnh báo").waitFor();
  await audit(page, "detail-error-state", { errorStateVisible: true });
  await context.close();
}

// Shared create dialog.
{
  const { context, page } = await login();
  await page.goto(`${base}/incidents`); await page.getByRole("button", { name: /Tạo sự cố/ }).click();
  await page.locator('[role="dialog"]').waitFor();
  await audit(page, "create-incident-dialog", { dialogVisible: true });
  await context.close();
}

// Admin drawer at desktop and mobile.
for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  const { context, page } = await login(viewport);
  await page.goto(`${base}/admin/users`); await page.locator(".user-identity").first().click();
  await page.locator('[role="dialog"]').waitFor();
  await audit(page, `admin-user-drawer-${viewport.width}`, { drawerVisible: true, viewport });
  await context.close();
}

// AI composer: focus and a real locally-grounded conversation response.
{
  const { context, page } = await login();
  await page.goto(`${base}/ai-assistant`); const composer = page.locator("#ai-question"); await composer.focus();
  await audit(page, "ai-composer-focus", { composerFocused: true });
  await composer.fill("Tóm tắt sự cố đang xử lý và nêu nguồn dữ liệu.");
  await page.locator('.ai-composer button[type="submit"]').click();
  await page.locator(".ai-response").last().waitFor();
  await audit(page, "ai-conversation-response", { responseVisible: true });
  await context.close();
}

// Profile evidence.
{
  const { context, page } = await login();
  await page.goto(`${base}/profile`); await page.locator(".workspace-content").waitFor();
  await audit(page, "profile", { profileVisible: true });
  await context.close();
}

// Canonical detail routes: discover first available link rather than copying IDs.
const listRoutes = [
  { route: "incidents", selector: ".incident-list-row" },
  { route: "tasks", selector: ".task-list-row" },
  { route: "teams", selector: ".team-list-row" },
  { route: "shelters", selector: ".shelter-row" },
  { route: "evacuations", selector: ".evac-row-main" },
  { route: "sos", selector: ".sos-row" },
  { route: "relief", selector: ".relief-row" },
  { route: "relief/warehouses", selector: ".warehouse-row" },
  { route: "playbooks", selector: ".playbook-row" },
  { route: "recovery", selector: ".assessment-row" },
  { route: "recovery/projects", selector: ".project-row" },
];
{
  const { context, page } = await login();
  for (const item of listRoutes) {
    await page.goto(`${base}/${item.route}`); await page.locator(".workspace-content").waitFor();
    const entry = page.locator(item.selector).first();
    const entryReady = await entry.waitFor({ state: "visible", timeout: 10000 }).then(() => true).catch(() => false);
    if (!entryReady) { results.push({ name: `detail-${item.route.replaceAll("/", "-")}`, missingDetailLink: true, serious: ["missing-detail-link"] }); continue; }
    await entry.click(); await page.waitForURL((url) => url.pathname !== `/${item.route}`);
    const href = new URL(page.url()).pathname;
    await page.locator(".workspace-content:not(.route-loading)").last().waitFor();
    await page.waitForTimeout(300);
    await audit(page, `detail-${item.route.replaceAll("/", "-")}`, { href });
  }
  await context.close();
}

// Deliberately hold external map resources to capture a deterministic loading state.
{
  const { context, page } = await login();
  await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (route) => route.abort());
  await page.goto(`${base}/`, { waitUntil: "domcontentloaded" });
  await page.getByText(/Đang tải bản đồ tác nghiệp/).waitFor({ timeout: 5000 });
  await audit(page, "map-loading-state", { loadingStateVisible: true });
  await context.close();
}

await browser.close();
const failures = results.filter((item) => item.serious?.length || item.horizontalOverflow || item.dialogs?.some((dialog) => !dialog.withinViewport) || item.dropdown?.withinViewport === false || item.missingDetailLink);
const summary = { generatedAt: new Date().toISOString(), checks: results.length, screenshots: results.filter((item) => item.screenshot).length, axeSeriousCritical: results.reduce((sum, item) => sum + (item.serious?.length || 0), 0), failures: failures.length, results };
fs.writeFileSync(path.join(output, "interaction-verification.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ ...summary, results: undefined }, null, 2));
if (failures.length) process.exitCode = 1;
