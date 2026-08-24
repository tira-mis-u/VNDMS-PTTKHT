import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const base = process.env.VNDMS_URL ?? "http://127.0.0.1:5173";
const workspacePath = `/workspace/${encodeURIComponent("Tái thiết")}`;
const output = path.join(
  root,
  "docs/05-architecture/reconstruction-workspace-evidence",
);
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];

async function login(viewport, username = "Trần Quốc Thuận") {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
  const inputs = page.locator(".login-card input");
  await inputs.nth(0).fill(username);
  await inputs.nth(1).fill("VNDMS@2026");
  await page.getByRole("button", { name: /^Đăng nhập$/ }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"));
  return { context, page };
}

async function audit(page, name, extra = {}) {
  await page.waitForTimeout(250);
  const axe = await new AxeBuilder({ page }).analyze();
  const serious = axe.violations
    .filter((item) => ["serious", "critical"].includes(item.impact ?? ""))
    .map((item) => ({
      id: item.id,
      targets: item.nodes.flatMap((node) => node.target),
    }));
  const metrics = await page.evaluate(() => {
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        rect.width > 0 &&
        rect.height > 0
      );
    };
    const activeNavigation = document
      .querySelector(".nav-item.active .nav-label")
      ?.textContent?.trim();
    const heading = document.querySelector("h1")?.textContent?.trim();
    const bodyText = document.body.innerText;
    const projectRows = [...document.querySelectorAll(".project-row")].filter(
      visible,
    );
    const controls = [...document.querySelectorAll("input,button[role='combobox']")]
      .filter(visible)
      .map((element) => ({
        tag: element.tagName,
        height: Math.round(element.getBoundingClientRect().height),
        family: getComputedStyle(element).fontFamily,
        size: getComputedStyle(element).fontSize,
      }));
    return {
      heading,
      activeNavigation,
      projectRows: projectRows.length,
      nativeSelects: [...document.querySelectorAll("select")].filter(visible)
        .length,
      horizontalOverflow:
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth + 1,
      technicalEnglish:
        /\b(owner|RecoveryProject|canonical|workspace|permission|lifecycle|milestone|budget|status|query|state)\b/i.exec(
          bodyText,
        )?.[0] ?? null,
      controls,
    };
  });
  const screenshot = path.join(output, `${name}.png`);
  await page.screenshot({ path: screenshot });
  results.push({
    name,
    screenshot: path.relative(root, screenshot),
    serious,
    ...metrics,
    ...extra,
  });
}

const configurations = [
  { label: "desktop", viewport: { width: 1440, height: 900 } },
  { label: "tablet", viewport: { width: 768, height: 1024 } },
  { label: "mobile", viewport: { width: 390, height: 844 } },
];
for (const configuration of configurations) {
  for (const theme of ["light", "dark"]) {
    const { context, page } = await login(configuration.viewport);
    await page.goto(`${base}${workspacePath}`, { waitUntil: "domcontentloaded" });
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
      localStorage.setItem("vndms-theme", value);
    }, theme);
    await page.locator(".recovery-project-table").waitFor();
    const beforeRefresh = new URL(page.url()).pathname;
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator(".recovery-project-table").waitFor();
    const afterRefresh = new URL(page.url()).pathname;
    await audit(page, `${configuration.label}-${theme}-list`, {
      theme,
      viewport: configuration.viewport,
      beforeRefresh,
      afterRefresh,
      deepLinkPreserved:
        beforeRefresh === workspacePath && afterRefresh === workspacePath,
    });
    if (configuration.viewport.width <= 768) {
      await page.locator(".project-row").first().scrollIntoViewIfNeeded();
      await audit(page, `${configuration.label}-${theme}-rows`, {
        theme,
        viewport: configuration.viewport,
        responsiveRowsVisible: true,
      });
    }

    if (configuration.viewport.width < 900 && theme === "light") {
      await page.getByRole("button", { name: "Mở điều hướng" }).click();
      await page.locator(".sidebar-mobile-open").waitFor();
      await audit(page, `${configuration.label}-${theme}-sidebar`, {
        sidebarOpen: true,
      });
      await page.getByRole("button", { name: "Đóng thanh điều hướng" }).click();
    }

    const firstRow = page.locator(".project-row").first();
    const projectCode = (await firstRow.locator("b").first().innerText()).split(" · ")[0];
    await firstRow.click();
    await page.waitForURL((url) => url.pathname.startsWith("/recovery/projects/"));
    await page.locator(".recovery-project-detail h1").waitFor();
    await audit(page, `${configuration.label}-${theme}-detail`, {
      theme,
      viewport: configuration.viewport,
      projectCode,
      detailPath: new URL(page.url()).pathname,
      canonicalDetailIdentity: new URL(page.url()).pathname.endsWith(`/${projectCode}`),
    });

    if (
      theme === "light" &&
      (configuration.label === "desktop" || configuration.label === "mobile")
    ) {
      await page.goto(`${base}/recovery/projects/RP-0241`);
      await page.locator(".recovery-project-detail h1").waitFor();
      const dialogButton = page.getByRole("button", {
        name: /Cập nhật chi phí|Phê duyệt|Thêm mốc tiến độ/,
      }).first();
      await dialogButton.click();
      await page.locator('[role="dialog"]').waitFor();
      await audit(page, `${configuration.label}-${theme}-dialog`, {
        dialogVisible: true,
      });
    }
    await context.close();
  }
}

{
  const { context, page } = await login(
    { width: 1440, height: 900 },
    "Nguyễn Nam Anh",
  );
  await page.goto(`${base}${workspacePath}`, { waitUntil: "domcontentloaded" });
  await page.getByText("Không được phép truy cập").waitFor();
  await audit(page, "rbac-warehouse-denied", {
    denied: true,
    projectDataVisible: await page.locator(".project-row").count(),
  });
  await context.close();
}

await browser.close();
const failures = results.filter(
  (item) =>
    item.serious.length ||
    item.horizontalOverflow ||
    item.nativeSelects ||
    item.technicalEnglish ||
    (item.name !== "rbac-warehouse-denied" &&
      item.activeNavigation !== "Tái thiết") ||
    (item.name.includes("-list") &&
      (item.heading !== "Dự án khôi phục" ||
        !item.projectRows ||
        !item.deepLinkPreserved)) ||
    (item.name.includes("-detail") && !item.canonicalDetailIdentity) ||
    (item.name === "rbac-warehouse-denied" && item.projectDataVisible),
);
const summary = {
  generatedAt: new Date().toISOString(),
  decision: "Route alias /workspace/Tái thiết → canonical Recovery Projects experience",
  checks: results.length,
  screenshots: results.length,
  failures: failures.length,
  axeSeriousCritical: results.reduce(
    (sum, item) => sum + item.serious.length,
    0,
  ),
  results,
};
fs.writeFileSync(
  path.join(output, "reconstruction-workspace-results.json"),
  JSON.stringify(summary, null, 2),
);
console.log(JSON.stringify({ ...summary, results: undefined }, null, 2));
if (failures.length) {
  console.error(
    JSON.stringify(
      failures.map((item) => ({ name: item.name, ...item })),
      null,
      2,
    ),
  );
  process.exitCode = 1;
}
