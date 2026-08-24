import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const base = process.env.VNDMS_URL ?? "http://127.0.0.1:5173";
const output = path.resolve("docs/05-architecture/phase-4-evidence/routes");
fs.mkdirSync(output, { recursive: true });
const routes = [
  ["trung-tam", "/"],
  ["tinh-hinh-thien-tai", "/workspace/T%C3%ACnh%20h%C3%ACnh%20thi%C3%AAn%20tai"],
  ["ban-do", "/workspace/B%E1%BA%A3n%20%C4%91%E1%BB%93%20t%C3%A1c%20nghi%E1%BB%87p"],
  ["canh-bao", "/alerts"], ["su-co", "/incidents"], ["phuong-an", "/playbooks"],
  ["nhiem-vu", "/tasks"], ["doi-cuu-ho", "/teams"], ["so-tan", "/evacuations"], ["sos", "/sos"],
  ["diem-so-tan", "/shelters"], ["kho-vat-tu", "/relief/warehouses"], ["phan-phoi-cuu-tro", "/relief"],
  ["danh-gia-thiet-hai", "/recovery"], ["tai-thiet", "/workspace/T%C3%A1i%20thi%E1%BA%BFt"],
  ["phan-tich", "/analytics"], ["bao-cao", "/analytics/reports"], ["mo-phong", "/simulation"],
  ["lich-su-thien-tai", "/workspace/L%E1%BB%8Bch%20s%E1%BB%AD%20thi%C3%AAn%20tai"], ["xu-huong", "/workspace/Xu%20h%C6%B0%E1%BB%9Bng"],
  ["tro-ly-ai", "/ai-assistant"], ["nguoi-dung", "/admin/users"], ["phan-quyen", "/workspace/Ph%C3%A2n%20quy%E1%BB%81n"],
  ["nhat-ky", "/admin/audit"], ["cau-hinh", "/workspace/C%E1%BA%A5u%20h%C3%ACnh"], ["ho-so", "/profile"],
];
const viewports = [
  ["1440x900", { width: 1440, height: 900 }],
  ["1280x800", { width: 1280, height: 800 }],
  ["1024x768", { width: 1024, height: 768 }],
  ["768x1024", { width: 768, height: 1024 }],
  ["430x932", { width: 430, height: 932 }],
  ["390x844", { width: 390, height: 844 }],
];
const requestedViewports = new Set(
  (process.env.VERIFY_VIEWPORTS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
const selectedViewports = requestedViewports.size
  ? viewports.filter(([label]) => requestedViewports.has(label))
  : viewports;
const modes = selectedViewports.flatMap(([label, viewport]) => [
  [`sang-${label}`, viewport, "light"],
  [`toi-${label}`, viewport, "dark"],
]);
const forbiddenVisible = /\b(mutation|canonical|Incident|Playbooks?|workspace|tick|engine|ownership|entity|snapshot|payload|query|route|drawer|modal|state|status|loading|overview|detail|source|realtime|fallback|Assessment|execution|backend|production|adapter|milestone|rollback|occupancy|utilization|capacity|revision|workflow|override|module|application|hazard|baseline|refresh|local|ETA|GPS|triage|shortage|reservation|permission|[a-z]+_[a-z_]+|[A-Z]{2,}(?:_[A-Z]+)+)\b/i;

const browser = await chromium.launch({ headless: true, args: ["--enable-unsafe-swiftshader"] });
let context;
let page;
const createSession = async (viewport) => {
  await context?.close();
  context = await browser.newContext({ viewport });
  page = await context.newPage();
  page.setDefaultTimeout(12_000);
  page.setDefaultNavigationTimeout(20_000);
  await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
  const loginInputs = page.locator(".login-card input");
  await loginInputs.nth(0).fill("Trần Quốc Thuận");
  await loginInputs.nth(1).fill("VNDMS@2026");
  await page.getByRole("button", { name: /^Đăng nhập$/ }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"));
};

const results = [];
for (const [mode, viewport, theme] of modes) {
  for (const [slug, route] of routes) {
    await createSession(viewport);
    await page.goto(`${base}${route}`, { waitUntil: "domcontentloaded" });
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
      localStorage.setItem("vndms-theme", value);
    }, theme);
    await page.locator(".workspace-content,.analytics-page").first().waitFor();
    await page.locator("h1").first().waitFor();
    if (route === "/analytics/reports")
      await page.locator(".operational-report").waitFor();
    await page.waitForTimeout(slug === "ban-do" ? 800 : 250);

    const metrics = await page.evaluate((forbiddenSource) => {
      const visible = (element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      };
      const toolbars = [...document.querySelectorAll(
        ".incident-filters,.task-filters,.team-filters,.shelter-filters,.sos-filters,.relief-filters,.evac-toolbar,.alerts-toolbar,.analytics-filters,.admin-filters",
      )].filter(visible);
      const toolbarProblems = toolbars.flatMap((toolbar) => {
        const outer = toolbar.getBoundingClientRect();
        const children = [...toolbar.children].filter(visible);
        const outside = children.filter((child) => {
          const rect = child.getBoundingClientRect();
          return rect.bottom > outer.bottom + 2 || rect.top < outer.top - 2;
        });
        return outside.length
          ? [{ className: toolbar.className, height: outer.height, outside: outside.length }]
          : [];
      });
      const semanticMetadata = [...document.querySelectorAll(
        ".breadcrumbs,.metadata,.helper-text,.report-metadata-grid dt,.report-table th,.report-audit span",
      )].filter(visible);
      const tooSmall = semanticMetadata
        .map((element) => ({ text: element.textContent?.trim().slice(0, 40), size: parseFloat(getComputedStyle(element).fontSize) }))
        .filter((item) => item.size < 13);
      const nativeSelectVisible = [...document.querySelectorAll("select")].filter(visible).length;
      const tableOverlap = [...document.querySelectorAll("table")].filter(visible).flatMap((table) => {
        const cells = [...table.querySelectorAll("th,td")].filter(visible);
        return cells.filter((cell) => cell.scrollWidth > cell.clientWidth + 3 && getComputedStyle(cell).whiteSpace === "nowrap").length
          ? [table.className]
          : [];
      });
      const rowHeights = [...document.querySelectorAll(
        ".incident-row,.task-row,.team-row,.evac-row,.sos-row,.shelter-card,.alert-row,.relief-request-row",
      )].filter(visible).map((element) => Math.round(element.getBoundingClientRect().height));
      const sectionHeader = document.querySelector(".page-section-header,.page-header,.analytics-header,.om-header");
      const sectionHeaderProblem = !document.querySelector("h1") || Boolean(sectionHeader && sectionHeader.scrollWidth > sectionHeader.clientWidth + 2);
      const forbiddenHeaderState = document.querySelector(".app-header")?.textContent?.includes("Dữ liệu nghiệp vụ đã đồng bộ") || false;
      const comboboxChevronProblems = [...document.querySelectorAll('button[role="combobox"]')]
        .filter(visible)
        .filter((button) => button.querySelectorAll("svg").length !== 1).length;
      const map = document.querySelector(".om-map-zone");
      const panel = document.querySelector(".om-panel");
      let mapAlignmentProblem = false;
      if (map && panel && visible(map) && visible(panel) && innerWidth > 980) {
        const mapRect = map.getBoundingClientRect();
        const panelRect = panel.getBoundingClientRect();
        mapAlignmentProblem = Math.abs(mapRect.top - panelRect.top) > 2 || Math.abs(mapRect.bottom - panelRect.bottom) > 2;
      }
      const px = (value) => Number.parseFloat(value) || 0;
      const fontElements = [...document.querySelectorAll(
        ".workspace :where(h1,h2,h3,p,small,label,button,input,textarea,td,th),.topbar :where(strong,small,button),.sidebar :where(span,button)",
      )].filter(visible);
      const fontFamilies = [...new Set(fontElements.map((element) => getComputedStyle(element).fontFamily))];
      const fontFamilyProblems = fontFamilies.filter((family) => !/Be Vietnam Pro/i.test(family));
      const typography = {
        pageTitle: [...document.querySelectorAll(".page-section-header h1")].filter(visible).map((element) => {
          const style = getComputedStyle(element);
          return { size: px(style.fontSize), weight: style.fontWeight, lineHeight: style.lineHeight };
        }),
        sectionTitle: [...document.querySelectorAll(".section-heading h2,.cc-panel-header > div > span")].filter(visible).slice(0, 12).map((element) => {
          const style = getComputedStyle(element);
          return { size: px(style.fontSize), weight: style.fontWeight, lineHeight: style.lineHeight };
        }),
        body: [...document.querySelectorAll(".workspace p")].filter(visible).slice(0, 12).map((element) => px(getComputedStyle(element).fontSize)),
        metadata: [...document.querySelectorAll(".workspace small,.workspace time")].filter(visible).slice(0, 20).map((element) => px(getComputedStyle(element).fontSize)),
      };
      const controlElements = [...document.querySelectorAll(
        '.workspace input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="hidden"]):not([type="file"]),.workspace textarea,.workspace button[role="combobox"],.ui-search,.input-with-icon,.ai-composer',
      )].filter(visible).filter((element) =>
        !(element.matches("input") && element.closest(".ui-search,.input-with-icon")) &&
        !(element.matches("textarea") && element.closest(".ai-composer")),
      );
      const measuredControls = [...new Set(controlElements)].map((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return {
          kind: element.matches('button[role="combobox"]') ? "select" : element.matches(".ui-search") ? "search" : element.matches(".input-with-icon,.ai-composer") ? "control-wrapper" : element.tagName.toLowerCase(),
          height: Math.round(rect.height * 10) / 10,
          radius: px(style.borderRadius),
          fontSize: px(style.fontSize),
          paddingLeft: px(style.paddingLeft),
          paddingRight: px(style.paddingRight),
          borderWidth: px(style.borderTopWidth),
        };
      });
      const controlProblems = measuredControls.filter((item) =>
        ((item.kind === "input" || item.kind === "search" || item.kind === "select") && (item.height < 40 || item.height > 44)) ||
        item.radius < 7 || item.fontSize < 13 || item.borderWidth < 1,
      );
      const selectTextIconProblems = [...document.querySelectorAll('button[role="combobox"]')].filter(visible).filter((button) => {
        const span = button.querySelector("span");
        const text = span?.getBoundingClientRect();
        const icon = button.querySelector("svg")?.getBoundingClientRect();
        const reservedTextPadding = span ? px(getComputedStyle(span).paddingRight) : 0;
        return Boolean(text && icon && text.right - reservedTextPadding + 8 > icon.left);
      }).length;
      const toolbarMeasurements = toolbars.map((toolbar) => {
        const style = getComputedStyle(toolbar);
        return { className: toolbar.className, rowGap: px(style.rowGap), columnGap: px(style.columnGap), padding: [px(style.paddingTop), px(style.paddingRight), px(style.paddingBottom), px(style.paddingLeft)] };
      });
      const surfaceMeasurements = [...document.querySelectorAll(
        ".content-section,.side-section,.cc-panel,.incident-worklist,.task-worklist,.team-worklist,.analytics-section,.admin-content,.simulation-panel,.profile-hero,.profile-information",
      )].filter(visible).slice(0, 24).map((element) => {
        const style = getComputedStyle(element);
        return { className: element.className, radius: px(style.borderRadius), borderWidth: px(style.borderTopWidth), padding: [px(style.paddingTop), px(style.paddingRight), px(style.paddingBottom), px(style.paddingLeft)] };
      });
      const shellMeasurements = {
        sidebarWidth: Math.round(document.querySelector(".sidebar")?.getBoundingClientRect().width ?? 0),
        headerHeight: Math.round(document.querySelector(".topbar")?.getBoundingClientRect().height ?? 0),
      };
      return {
        title: document.querySelector("h1")?.textContent?.trim() ?? "",
        sectionHeaderProblem,
        forbiddenHeaderState,
        comboboxChevronProblems,
        mapAlignmentProblem,
        fontFamilies,
        fontFamilyProblems,
        typography,
        measuredControls,
        controlProblems,
        selectTextIconProblems,
        toolbarMeasurements,
        surfaceMeasurements,
        shellMeasurements,
        forbiddenVisible: new RegExp(forbiddenSource, "i").exec(document.body.innerText)?.[0] ?? null,
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
        nativeSelectVisible,
        toolbarProblems,
        tooSmall,
        tableOverlap,
        rowHeight: rowHeights.length
          ? { min: Math.min(...rowHeights), max: Math.max(...rowHeights), average: Math.round(rowHeights.reduce((a, b) => a + b, 0) / rowHeights.length) }
          : null,
        reportForm: location.pathname === "/analytics/reports" ? {
          metadata: document.querySelectorAll(".report-metadata-grid > div").length,
          sections: document.querySelectorAll(".report-block").length,
          tables: document.querySelectorAll(".report-table").length,
          status: document.querySelector(".report-document-state")?.textContent?.trim() ?? "",
        } : null,
      };
    }, forbiddenVisible.source);

    let dropdown = null;
    const combobox = page.locator('button[role="combobox"]:visible').first();
    if (await combobox.count()) {
      await combobox.click();
      const popover = page.locator("body > .ui-select-popover");
      try {
        await popover.waitFor({ timeout: 4_000 });
        dropdown = await popover.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return {
            left: Math.round(rect.left), top: Math.round(rect.top),
            right: Math.round(rect.right), bottom: Math.round(rect.bottom),
            withinViewport: rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1,
            optionCount: element.querySelectorAll('[role="option"]').length,
          };
        });
        await page.keyboard.press("Escape");
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      } catch {
        dropdown = { openFailed: true, withinViewport: false, optionCount: 0 };
      }
    }
    await page.evaluate(() => {
      window.scrollTo({ top: 0, behavior: "instant" });
      document
        .querySelectorAll(".workspace,.workspace-content,.analytics-page")
        .forEach((element) => element.scrollTo({ top: 0, behavior: "instant" }));
    });
    await page.waitForTimeout(60);
    const axe = await new AxeBuilder({ page }).analyze();
    const serious = axe.violations
      .filter((item) => ["serious", "critical"].includes(item.impact ?? ""))
      .map((item) => item.id);
    await page.screenshot({
      path: path.join(output, `${mode}--${slug}.jpg`),
      type: "jpeg", quality: 62, timeout: 20_000,
    });
    results.push({ mode, viewport: `${viewport.width}x${viewport.height}`, route, slug, serious, dropdown, ...metrics });
    console.log(`${mode} ${route}: axe=${serious.length} overflow=${metrics.horizontalOverflow} toolbar=${metrics.toolbarProblems.length}`);
  }
}

const failures = results.filter((item) =>
  item.serious.length || item.horizontalOverflow || item.nativeSelectVisible ||
  item.toolbarProblems.length || item.tooSmall.length || item.tableOverlap.length ||
  item.sectionHeaderProblem || item.forbiddenHeaderState || item.comboboxChevronProblems ||
  item.mapAlignmentProblem || item.forbiddenVisible || item.fontFamilyProblems.length ||
  item.controlProblems.length || item.selectTextIconProblems ||
  (item.dropdown && !item.dropdown.withinViewport),
);
const summary = {
  generatedAt: new Date().toISOString(),
  routes: routes.length,
  modes: modes.length,
  checks: results.length,
  failures: failures.length,
  axeSeriousCritical: results.reduce((sum, item) => sum + item.serious.length, 0),
  overflowScreens: results.filter((item) => item.horizontalOverflow).length,
  visibleNativeSelectScreens: results.filter((item) => item.nativeSelectVisible).length,
  toolbarProblemScreens: results.filter((item) => item.toolbarProblems.length).length,
  dropdownProblemScreens: results.filter((item) => item.dropdown && !item.dropdown.withinViewport).length,
  sectionHeaderProblemScreens: results.filter((item) => item.sectionHeaderProblem).length,
  forbiddenHeaderStateScreens: results.filter((item) => item.forbiddenHeaderState).length,
  doubleChevronScreens: results.filter((item) => item.comboboxChevronProblems).length,
  mapAlignmentProblemScreens: results.filter((item) => item.mapAlignmentProblem).length,
  forbiddenVisibleScreens: results.filter((item) => item.forbiddenVisible).length,
  fontFamilyProblemScreens: results.filter((item) => item.fontFamilyProblems.length).length,
  controlMeasurementProblemScreens: results.filter((item) => item.controlProblems.length).length,
  selectTextIconProblemScreens: results.filter((item) => item.selectTextIconProblems).length,
  results,
};
fs.writeFileSync(path.join(output, "route-matrix-results.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ ...summary, results: undefined }, null, 2));
await context?.close();
await browser.close();
if (failures.length) process.exitCode = 1;
