import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  authorizeResources,
  type AuthorizationResource,
} from "../../src/lib/security/authorization";
import { demoUsers } from "../../src/infrastructure/auth/demoUsers";

const user = (username: string) =>
  structuredClone(demoUsers.find((item) => item.username === username)!);
const resource = (
  changes: Partial<AuthorizationResource>,
): AuthorizationResource => ({
  type: "Incident",
  id: "INC-0241",
  geographicScope: "Tứ Liên, Tây Hồ, Hà Nội",
  ...changes,
});

test("authorized resource mutation thành công và sai địa bàn bị từ chối", () => {
  const local = user("Phạm Văn Đam");
  assert.equal(
    authorizeResources(local, {
      permission: "update",
      resources: [resource({})],
    }).allowed,
    true,
  );
  const denied = authorizeResources(local, {
    permission: "update",
    resources: [
      resource({
        id: "INC-0234",
        geographicScope: "Ngọc Thụy, Long Biên, Hà Nội",
      }),
    ],
  });
  assert.equal(denied.allowed, false);
  assert.match(denied.reason, /ngoài phạm vi/);
});

test("rescue ownership chặn Team không được phân công", () => {
  const leader = user("Phạm Trung Hiếu");
  assert.equal(
    authorizeResources(leader, {
      permission: "team_update_status",
      resources: [
        resource({
          type: "Team",
          id: "CH-05",
          geographicScope: "Long Biên, Hà Nội",
          assignedTeamId: "CH-05",
        }),
      ],
    }).allowed,
    true,
  );
  const denied = authorizeResources(leader, {
    permission: "team_update_status",
    resources: [
      resource({
        type: "Team",
        id: "CH-03",
        geographicScope: "Tây Hồ, Hà Nội",
        assignedTeamId: "CH-03",
      }),
    ],
  });
  assert.equal(denied.allowed, false);
});

test("warehouse ownership chặn thao tác kho khác", () => {
  const staff = user("Nguyễn Nam Anh");
  assert.equal(
    authorizeResources(staff, {
      permission: "warehouse_adjust_stock",
      resources: [
        resource({
          type: "Warehouse",
          id: "KHO-01",
          geographicScope: "Hoàn Kiếm, Hà Nội",
          warehouseId: "KHO-01",
        }),
      ],
    }).allowed,
    true,
  );
  assert.equal(
    authorizeResources(staff, {
      permission: "warehouse_adjust_stock",
      resources: [
        resource({
          type: "Warehouse",
          id: "KHO-02",
          geographicScope: "Tây Hồ, Hà Nội",
          warehouseId: "KHO-02",
        }),
      ],
    }).allowed,
    false,
  );
});

test("multi-resource mutation từ chối nếu chỉ một resource ngoài scope", () => {
  const scopedOperator = user("Nguyễn Quốc Trung");
  scopedOperator.geographicScope = {
    level: "district",
    name: "Tây Hồ, Hà Nội",
    code: "HN-TAYHO",
  };
  const decision = authorizeResources(scopedOperator, {
    permission: "task_assign",
    sensitiveOperation: "gán nhiệm vụ cho đội",
    resources: [
      resource({ type: "Task", id: "TSK-0241", assignedTeamId: null }),
      resource({
        type: "Team",
        id: "CH-05",
        geographicScope: "Long Biên, Hà Nội",
        assignedTeamId: "CH-05",
      }),
    ],
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.resourceId, "CH-05");
});

test("provider không còn mutation permission call thiếu resource context", () => {
  const sources = [
    readFileSync("src/state/operations/OperationalContext.tsx", "utf8"),
    readFileSync("src/state/operations/useOperationalSecurity.ts", "utf8"),
  ];
  const key = "enforcePermission(";
  let calls = 0;
  for (const source of sources) {
    const positions = [...source.matchAll(/enforcePermission\(/g)]
      .map((match) => match.index!)
      .filter(
        (position) =>
          !source
            .slice(Math.max(0, position - 20), position)
            .includes("const "),
      );
    calls += positions.length;
    for (const position of positions) {
      let index = position + key.length;
      let depth = 1;
      let quote = "";
      let topLevelComma = false;
      while (index < source.length && depth > 0) {
        const character = source[index++];
        if (quote) {
          if (character === quote && source[index - 2] !== "\\") quote = "";
        } else if (['"', "'", "`"].includes(character)) quote = character;
        else if (character === "(") depth++;
        else if (character === ")") depth--;
        else if (character === "," && depth === 1) topLevelComma = true;
      }
      assert.equal(
        topLevelComma,
        true,
        `Thiếu resource context gần offset ${position}`,
      );
    }
    assert.equal((source.match(/permissionMatrix/g) ?? []).length, 0);
  }
  assert.ok(calls >= 100);
});
