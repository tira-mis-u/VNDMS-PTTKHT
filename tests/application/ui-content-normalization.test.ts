import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { PERSONNEL } from "../../src/data/identity/personnel";

function files(directory: string, extension: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const value = join(directory, entry);
    return statSync(value).isDirectory()
      ? files(value, extension)
      : value.endsWith(extension)
        ? [value]
        : [];
  });
}

test("mọi lựa chọn giao diện dùng Select chung có hỗ trợ bàn phím", () => {
  const tsx = files("src", ".tsx").map((file) => readFileSync(file, "utf8"));
  assert.equal(tsx.some((source) => /<select\b/.test(source)), false);
  assert.equal(tsx.reduce((sum, source) => sum + (source.match(/<UiSelect\b/g)?.length ?? 0), 0), 81);
  const source = readFileSync("src/components/ui/Select.tsx", "utf8");
  for (const contract of [
    'role="combobox"',
    'role="listbox"',
    'role="option"',
    '"ArrowDown"',
    '"ArrowUp"',
    '"Home"',
    '"End"',
    '"Escape"',
    'aria-expanded',
    'aria-controls',
  ])
    assert.ok(source.includes(contract), `Select thiếu ${contract}`);
});

test("tên nhân sự chỉ được khai báo tại nguồn danh tính duy nhất", () => {
  const sourceFiles = files("src", ".ts").concat(files("src", ".tsx"));
  const allowed = "src/data/identity/personnel.ts";
  for (const person of Object.values(PERSONNEL)) {
    const duplicates = sourceFiles.filter(
      (file) => file !== allowed && readFileSync(file, "utf8").includes(`"${person.displayName}"`),
    );
    assert.deepEqual(duplicates, [], `${person.displayName} còn bị khai báo lặp`);
  }
});

test("không còn thuật ngữ tiếng Anh bị cấm trong chuỗi giao diện", () => {
  assert.doesNotThrow(() =>
    execFileSync(process.execPath, ["scripts/audit-ui-content.mjs"], {
      stdio: "pipe",
    }),
  );
});

test("không còn cỡ chữ giao diện dưới 12,5px", () => {
  const css = files("src/styles", ".css")
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");
  assert.equal(/font-size:\s*(?:8|9|10(?:\.5)?|11(?:\.5)?|12)px/.test(css), false);
});
