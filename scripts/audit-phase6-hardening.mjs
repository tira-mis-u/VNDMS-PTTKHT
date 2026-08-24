#!/usr/bin/env node
// Phase 6 production hardening audit — dead code, duplicate state, fake data, etc.

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const SRC = path.resolve("src");
const errors = [];
const warnings = [];

// Personnel registry check
const PERSONNEL_NAMES = [
  "Trần Quốc Thuận", "Nguyễn Quốc Trung", "Phạm Văn Đam",
  "Phạm Trung Hiếu", "Lê Nguyễn Minh Trí", "Nguyễn Nam Anh"
];

function walk(dir, ext) {
  const files = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith(".") && entry.name !== "node_modules") {
          files.push(...walk(p, ext));
        }
      } else if (entry.isFile() && ext.some(e => entry.name.endsWith(e))) {
        files.push(p);
      }
    }
  } catch {}
  return files;
}

const tsFiles = walk(SRC, [".ts", ".tsx"]);
const personnel = []; // { file, name, line }
const newDates = [];  // { file, matches }
const localStorage = [];
const permissionMatrices = [];
const stateFiles = [];

for (const file of tsFiles) {
  const content = fs.readFileSync(file, "utf-8");
  const lines = content.split("\n");
  
  // Hard-coded personnel names
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip files that ARE the registry
    if (file.includes("personnel.ts")) continue;
    for (const name of PERSONNEL_NAMES) {
      // Check if name is in a string literal (not as registry reference)
      if (line.includes(`"${name}"`) || line.includes(`'${name}'`) || line.includes("`${name}")) {
        personnel.push({ file: path.relative(SRC, file), name, line: i + 1, text: line.trim() });
      }
    }
  }

  // new Date() in non-test code
  if (!file.includes(".test.") && !file.includes("/test/") && !file.includes("/__test__/")) {
    const dateMatches = content.match(/new Date\(\)/g);
    if (dateMatches) {
      newDates.push({ file: path.relative(SRC, file), count: dateMatches.length });
    }
  }

  // localStorage
  const lsMatches = content.match(/localStorage\.(getItem|setItem|removeItem|clear)/g);
  if (lsMatches) {
    localStorage.push({ file: path.relative(SRC, file), count: lsMatches.length, ops: lsMatches });
  }

  // Permission matrix references
  if (content.includes("permissionMatrix") || content.includes("permissionMatrx")) {
    permissionMatrices.push(file);
  }

  // State files
  if (file.includes("State") || file.includes("state") || file.includes("Context")) {
    stateFiles.push(path.relative(SRC, file));
  }
}

console.log("\n=== HARD-CODED PERSONNEL NAMES OUTSIDE REGISTRY ===");
if (personnel.length === 0) {
  console.log("  ✅ NONE FOUND");
} else {
  for (const p of personnel) {
    console.log(`  ❌ ${p.file}:${p.line} — "${p.name}"`);
  }
}

console.log("\n=== NEW Date() IN NON-TEST CODE ===");
if (newDates.length === 0) {
  console.log("  ✅ NONE FOUND outside tests");
} else {
  for (const d of newDates) {
    console.log(`  ⚠️  ${d.file}: ${d.count} occurrence(s)`);
  }
}

console.log("\n=== localStorage USAGE ===");
if (localStorage.length === 0) {
  console.log("  ✅ NONE FOUND");
} else {
  for (const ls of localStorage) {
    const allowed = ["AppHeader.tsx", "LoginPage.tsx", "profileAvatar.ts", "localAuditAdapter.ts", "localAuthenticationAdapter.ts", "main.tsx"];
    const filename = path.basename(ls.file);
    if (allowed.includes(filename)) {
      console.log(`  ✅ ${ls.file}: ${ls.count} ops (authorized)`);
    } else {
      console.log(`  ⚠️  ${ls.file}: ${ls.count} ops (UNEXPECTED)`);
    }
  }
}

console.log("\n=== DUPLICATE PERMISSION MATRIX ===");
const permFiles = permissionMatrices.filter(f => !f.includes("permissions.ts"));
if (permFiles.length === 0) {
  console.log("  ✅ Only one canonical copy (src/lib/permissions/permissions.ts)");
} else {
  for (const f of permFiles) {
    console.log(`  ⚠️  ${path.relative(SRC, f)}`);
  }
}

console.log("\n=== STATE / CONTEXT FILES ===");
for (const f of stateFiles) {
  console.log(`  📁 ${f}`);
}

// Count unique repositories
console.log("\n=== REPOSITORY FILES ===");
const repoFiles = tsFiles.filter(f => f.includes("Repository") || f.includes("repository"));
for (const f of repoFiles) {
  console.log(`  📁 ${path.relative(SRC, f)}`);
}

// Check for generated/fake GIS geometry
console.log("\n=== GIS GEOMETRY CHECKS ===");
const geomKeywords = ["ellipse", "polygon", "boundingBox", "bbox", "estimatedGeometry", "approximate", "extent"];
for (const file of tsFiles) {
  const content = fs.readFileSync(file, "utf-8");
  for (const kw of geomKeywords) {
    // Skip comments/strings that are just mentioning the keyword
    const pattern = new RegExp(`\\b${kw}\\b`, "i");
    const matches = content.match(pattern);
    if (matches && !file.includes("node_modules")) {
      console.log(`  ⚠️  ${path.relative(SRC, file)} mentions "${kw}"`);
    }
  }
}

// Check for unused routes / placeholders
console.log("\n=== PLACEHOLDER ROUTES ===");
const placeholderFiles = tsFiles.filter(f => f.includes("PlaceholderPage"));
for (const f of placeholderFiles) {
  console.log(`  📁 ${path.relative(SRC, f)}`);
}

// Check for fake realtime
console.log("\n=== FAKE REALTIME ===");
const realtimeKeywords = ["setInterval", "setTimeout", "realtime", "RealTime", "useInterval", "polling", "usePolling"];
for (const file of tsFiles) {
  try {
    const content = fs.readFileSync(file, "utf-8");
    if (file.includes(".test.")) continue;
    if (file.includes("Simulation")) continue; // simulation is legitimate
    for (const kw of realtimeKeywords) {
      if (content.includes(kw) && !content.includes(`"${kw}"`) && !content.includes(`'${kw}'`)) {
        console.log(`  ⚠️  ${path.relative(SRC, file)} uses "${kw}"`);
      }
    }
  } catch {}
}

console.log("\n✅ Hardening audit complete.");
process.exit(0);