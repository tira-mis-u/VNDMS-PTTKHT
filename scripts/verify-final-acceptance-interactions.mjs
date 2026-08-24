import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "docs/05-architecture/final-acceptance-evidence/interactions");
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
  await page.waitForTimeout(220);
  await page.addScriptTag({ content: axeSource });
  const measured = await page.evaluate(async () => {
    const serious = (await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } })).violations
      .filter((item) => item.impact === "serious" || item.impact === "critical")
      .map((item) => ({
        id: item.id,
        nodes: item.nodes.map((node) => ({
          target: node.target,
          html: node.html,
          failureSummary: node.failureSummary,
        })),
      }));
    const dialogs = [...document.querySelectorAll('[role="dialog"]')].filter((el) => {
      const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0;
    }).map((el) => {
      const r = el.getBoundingClientRect();
      return { label: el.getAttribute("aria-label") || el.getAttribute("aria-labelledby"), left: r.left, top: r.top, right: r.right, bottom: r.bottom, withinViewport: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight };
    });
    const visibleText = document.body.innerText;
    const pseudoContent = [...document.querySelectorAll("*")].flatMap((element) =>
      ["::before", "::after"].map((pseudo) => getComputedStyle(element, pseudo).content)
        .filter((content) => content && !["none", "normal", '""'].includes(content)),
    );
    const renderedContent = `${visibleText}\n${pseudoContent.join("\n")}`;
    const forbiddenVisible =
      /\b(mutation|canonical|Incident|Playbooks?|workspace|tick|engine|ownership|entity|snapshot|payload|query|route|drawer|modal|state|status|loading|overview|detail|source|realtime|fallback|Assessment|execution|backend|production|adapter|milestone|rollback|occupancy|utilization|capacity|revision|workflow|override|module|application|hazard|baseline|refresh|local|ETA|GPS|triage|shortage|reservation|permission)\b/i.exec(renderedContent)?.[0] ??
      /\b(?:[a-z]+_[a-z_]+|[A-Z]{2,}(?:_[A-Z]+)+)\b/.exec(renderedContent)?.[0] ??
      null;
    return { serious, dialogs, horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, forbiddenVisible, visibleText, pseudoContent };
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
for (const item of listRoutes) {
  const { context, page } = await login();
  console.log(`detail ${item.route}`);
  await page.goto(`${base}/${item.route}`); await page.locator(".workspace-content").first().waitFor();
  const entry = page.locator(item.selector).first();
  const entryReady = await entry.waitFor({ state: "visible", timeout: 10000 }).then(() => true).catch(() => false);
  if (!entryReady) {
    results.push({ name: `detail-${item.route.replaceAll("/", "-")}`, missingDetailLink: true, serious: ["missing-detail-link"] });
    await context.close();
    continue;
  }
  await entry.click(); await page.waitForURL((url) => url.pathname !== `/${item.route}`);
  const href = new URL(page.url()).pathname;
  await page.locator(".workspace-content:not(.route-loading)").last().waitFor();
  await page.waitForTimeout(300);
  await audit(page, `detail-${item.route.replaceAll("/", "-")}`, { href });
  await context.close();
}


// Valid alert detail, analytical subroutes and an active playbook execution route.
{
  const { context, page } = await login();
  await page.goto(`${base}/alerts`); await page.locator(".alert-row-main").first().click();
  await page.waitForURL((url) => url.pathname.startsWith("/alerts/") && url.pathname !== "/alerts/");
  await audit(page, "detail-alert-valid", { href: new URL(page.url()).pathname });
  for (const route of ["/analytics/incidents", "/analytics/resources"]) {
    await page.goto(`${base}${route}`); await page.locator(".analytics-page").waitFor();
    await audit(page, `route-${route.split("/").pop()}`, { href: route });
  }
  await page.goto(`${base}/playbooks`); await page.locator(".playbook-row").first().click();
  await page.waitForURL((url) => /^\/playbooks\/[^/]+$/.test(url.pathname));
  const executionPath = `${new URL(page.url()).pathname}/execute`;
  await page.goto(`${base}${executionPath}`); await page.locator(".workspace-content").waitFor();
  await audit(page, "detail-playbook-execution", { href: executionPath });
  await context.close();
}

// Header popover, Command Center drawer and Unified Operational Map drawer.
{
  const { context, page } = await login();
  await page.goto(`${base}/alerts`); await page.locator('button[title="Thông báo tác nghiệp"]').click();
  await page.getByRole("dialog", { name: "Trung tâm thông báo tác nghiệp" }).waitFor();
  await audit(page, "alert-notification-popover", { popoverVisible: true });
  await page.goto(`${base}/`); await page.locator(".cc-layout").waitFor();
  await audit(page, "command-center-dashboard", { commandCenterVisible: true });
  await page.goto(`${base}/workspace/${encodeURIComponent("Bản đồ tác nghiệp")}?focus=INC-0241`);
  await page.locator(".om-drawer").waitFor({ timeout: 10000 });
  await audit(page, "operational-map-entity-drawer", { drawerVisible: true });
  await context.close();
}

// Evacuation action form/dialog and report product hierarchy.
{
  const { context, page } = await login();
  await page.goto(`${base}/evacuations`); await page.locator(".evac-row-main").first().click();
  await page.waitForURL((url) => url.pathname.startsWith("/evacuations/"));
  const updateRoute = page.getByRole("button", { name: "Cập nhật tuyến", exact: true });
  if (await updateRoute.isEnabled()) {
    await updateRoute.click(); await page.locator('[role="dialog"]').waitFor();
    await audit(page, "evacuation-route-dialog", { dialogVisible: true });
  }
  await page.goto(`${base}/analytics/reports`); await page.locator(".operational-report").waitFor();
  const reportContract = await page.evaluate(() => ({
    agency: Boolean(document.querySelector(".report-agency")),
    title: document.querySelector(".operational-report h1")?.textContent?.trim(),
    metadataCount: document.querySelectorAll(".report-metadata-grid > div").length,
    sectionTitles: [...document.querySelectorAll(".report-block h2")].map((element) => element.textContent?.trim()),
    source: document.querySelector(".report-audit")?.textContent?.trim(),
  }));
  await audit(page, "operational-report-product", { reportContract });
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
const failures = results.filter((item) => item.serious?.length || item.horizontalOverflow || item.forbiddenVisible || item.dialogs?.some((dialog) => !dialog.withinViewport) || item.dropdown?.withinViewport === false || item.missingDetailLink);
const summary = { generatedAt: new Date().toISOString(), checks: results.length, screenshots: results.filter((item) => item.screenshot).length, axeSeriousCritical: results.reduce((sum, item) => sum + (item.serious?.length || 0), 0), failures: failures.length, results };
fs.writeFileSync(path.join(output, "interaction-results.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ ...summary, results: undefined }, null, 2));
if (failures.length) process.exitCode = 1;
