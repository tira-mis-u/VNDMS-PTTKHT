import { chromium } from "playwright";
import fs from "node:fs";
const base = process.env.VNDMS_URL ?? "http://127.0.0.1:5173";
const output = "docs/05-architecture/phase-4-evidence/typography-contract.json";
const routes = ["/", "/alerts", "/incidents", "/playbooks", "/tasks", "/teams", "/evacuations", "/sos", "/shelters", "/relief/warehouses", "/relief", "/recovery", "/analytics", "/analytics/reports", "/simulation", "/ai-assistant", "/admin/users", "/admin/audit", "/profile", "/workspace/T%C3%ACnh%20h%C3%ACnh%20thi%C3%AAn%20tai", "/workspace/T%C3%A1i%20thi%E1%BA%BFt"];
const contract = { family: "Be Vietnam Pro", sizes: { pageTitle: 30, sectionTitle: 18, cardTitle: 16, body: 14, secondary: 13.5, metadata: 13, control: 13.5, badge: 12.5 }, minimumLineHeightRatio: 1.2 };
const browser = await chromium.launch({ headless: true, args: ["--enable-unsafe-swiftshader"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
await page.goto(`${base}/login`); const inputs = page.locator(".login-card input"); await inputs.nth(0).fill("Trần Quốc Thuận"); await inputs.nth(1).fill("VNDMS@2026"); await page.getByRole("button", { name: /^Đăng nhập$/ }).click(); await page.waitForURL((url) => !url.pathname.endsWith("/login"));
const results = [];
for (const route of routes) {
  await page.goto(`${base}${route}`, { waitUntil: "domcontentloaded" }); await page.locator("h1").first().waitFor(); await page.waitForTimeout(250);
  results.push(await page.evaluate(({ route, contract }) => {
    const visible = (element) => { const r = element.getBoundingClientRect(); const s = getComputedStyle(element); return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden"; };
    const metric = (element) => { const s = getComputedStyle(element); const size = parseFloat(s.fontSize); const lineHeight = s.lineHeight === "normal" ? null : parseFloat(s.lineHeight); return { tag: element.tagName.toLowerCase(), className: element.className, text: element.textContent?.trim().slice(0, 80), family: s.fontFamily, size, weight: Number(s.fontWeight) || s.fontWeight, lineHeight, lineHeightRatio: lineHeight ? Math.round(lineHeight / size * 100) / 100 : null }; };
    const select = (selector) => [...document.querySelectorAll(selector)].filter(visible).map(metric);
    const roles = {
      pageTitle: select("h1"), sectionTitle: select(".section-heading h2,.report-block h2,.analytics-section > header h2"), cardTitle: select("article h3,.card h3"),
      body: select(".workspace p,.analytics-page p").slice(0, 80), label: select(".workspace label,.analytics-page label").slice(0, 60), metadata: select(".workspace small,.workspace time,.analytics-page small,.analytics-page time").slice(0, 80),
      button: select(".workspace button").slice(0, 100), input: select(".workspace input,.workspace textarea,.workspace button[role=combobox]"), table: select("th,td").slice(0, 100), helperError: select("[class*=helper],[class*=hint],[class*=error],[role=alert]").slice(0, 50), badge: select(".badge").slice(0, 60),
    };
    const all = Object.values(roles).flat();
    const familyProblems = all.filter((item) => !item.family.includes(contract.family));
    const lineHeightProblems = all.filter((item) => item.lineHeightRatio !== null && item.lineHeightRatio < contract.minimumLineHeightRatio);
    const roleProblems = [
      ...roles.pageTitle.filter((item) => item.size !== contract.sizes.pageTitle),
      ...roles.sectionTitle.filter((item) => ![contract.sizes.sectionTitle, contract.sizes.cardTitle].includes(item.size)),
      ...roles.cardTitle.filter((item) => item.size !== contract.sizes.cardTitle),
      ...roles.body.filter((item) => item.size !== contract.sizes.body),
      ...roles.label.filter((item) => item.size !== contract.sizes.secondary),
      ...roles.button.filter((item) => item.size !== contract.sizes.control),
      ...roles.input.filter((item) => item.size !== contract.sizes.control),
      ...roles.table.filter((item) => ![contract.sizes.body, contract.sizes.metadata].includes(item.size)),
      ...roles.metadata.filter((item) => ![contract.sizes.metadata, contract.sizes.badge].includes(item.size)),
      ...roles.helperError.filter((item) => item.size < contract.sizes.metadata),
    ];
    return { route, roles, familyProblems, lineHeightProblems, roleProblems };
  }, { route, contract }));
}
await browser.close();
const failures = results.filter((result) => result.familyProblems.length || result.lineHeightProblems.length || result.roleProblems.length);
const summary = { generatedAt: new Date().toISOString(), contract, routes: routes.length, failures: failures.length, results };
fs.writeFileSync(output, JSON.stringify(summary, null, 2)); console.log(JSON.stringify({ generatedAt: summary.generatedAt, contract, routes: routes.length, failures: failures.length, failingRoutes: failures.map((item) => ({ route: item.route, families: item.familyProblems.length, lineHeights: item.lineHeightProblems.length, roles: item.roleProblems.length })) }, null, 2));
if (failures.length) process.exitCode = 1;
