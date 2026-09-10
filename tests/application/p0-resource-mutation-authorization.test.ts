/*
 * V2 (4 vai): test "warehouse ownership" gỡ cùng module Kho (thay bằng test công dân
 * cũ là thủ kho không còn quyền kho); test geographic dùng công dân (sos_create);
 * ownership rescue_unit dựa vào Task/SOS đã phân công, không còn teamId trên tài khoản.
 * Ngưỡng số lệnh enforcePermission hạ từ 100 → 40 vì 6 nhóm nghiệp vụ đã xóa thật.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  authorizeResources,
  type AuthorizationResource,
} from "../../src/lib/security/authorization";
import { demoUsers } from "../../src/infrastructure/auth/demoUsers";

const user = (username: string) => {
  const found = demoUsers.find((item) => item.username === username);
  if (!found) throw new Error(`demo user ${username} không tồn tại`);
  return structuredClone(found);
};
const resource = (
  changes: Partial<AuthorizationResource>,
): AuthorizationResource => ({
  type: "Incident",
  id: "INC-0241",
  geographicScope: "Tứ Liên, Tây Hồ, Hà Nội",
  ...changes,
});

test("authorized resource mutation thành công và sai địa bàn bị từ chối", () => {
  const local = user("phamdam"); // công dân, scope Tây Hồ
  assert.equal(
    authorizeResources(local, {
      permission: "sos_create",
      resources: [resource({ type: "SosRequest", id: "new" })],
    }).allowed,
    true,
  );
  const denied = authorizeResources(local, {
    permission: "sos_create",
    resources: [
      resource({
        type: "SosRequest",
        id: "new",
        geographicScope: "Ngọc Thụy, Long Biên, Hà Nội",
      }),
    ],
  });
  assert.equal(denied.allowed, false);
  assert.match(denied.reason, /ngoài phạm vi/);
});

test("rescue ownership: đơn vị cứu hộ chỉ thao tác Task/SOS đã được phân công, nhưng cập nhật mọi đội", () => {
  const unit = user("phamhieu");
  assert.equal(
    authorizeResources(unit, {
      permission: "task_report_done",
      resources: [resource({ type: "Task", id: "TSK-YAGI-01", geographicScope: "Lào Cai", assignedTeamId: "CH-LC-01" })],
    }).allowed,
    true,
  );
  const denied = authorizeResources(unit, {
    permission: "task_report_done",
    resources: [resource({ type: "Task", id: "TSK-YAGI-02", geographicScope: "Lào Cai", assignedTeamId: null })],
  });
  assert.equal(denied.allowed, false);
  assert.match(denied.reason, /đã được cán bộ phân công/);
  // Chỉ huy toàn bộ lực lượng: mọi đội đều cập nhật được trạng thái.
  for (const id of ["CH-LC-01", "CH-CB-01", "CH-QN-01"])
    assert.equal(
      authorizeResources(unit, {
        permission: "team_update_status",
        resources: [resource({ type: "Team", id, geographicScope: "Toàn quốc", assignedTeamId: id })],
      }).allowed,
      true,
      id,
    );
});

test("thủ kho cũ (nay công dân) không còn bất kỳ quyền kho/điều phối nào", () => {
  const former = user("namanh");
  assert.equal(former.role, "citizen");
  for (const permission of ["dispatch", "task_assign", "team_update_status", "shelter_update"] as const)
    assert.equal(
      authorizeResources(former, {
        permission,
        resources: [resource({ geographicScope: "Hoàn Kiếm, Hà Nội" })],
      }).allowed,
      false,
      permission,
    );
  // Vẫn gửi SOS trong địa bàn của mình.
  assert.equal(
    authorizeResources(former, {
      permission: "sos_create",
      resources: [resource({ type: "SosRequest", id: "new", geographicScope: "Hoàn Kiếm, Hà Nội" })],
    }).allowed,
    true,
  );
});

test("multi-resource mutation từ chối nếu chỉ một resource ngoài scope", () => {
  const scopedOperator = user("nguyentrung");
  scopedOperator.geographicScope = {
    level: "district",
    name: "Tây Hồ, Hà Nội",
    code: "HN-TAYHO",
  };
  const decision = authorizeResources(scopedOperator, {
    permission: "task_assign",
    sensitiveOperation: "gán nhiệm vụ cho đội",
    resources: [
      resource({ type: "Task", id: "TSK-YAGI-04", assignedTeamId: null }),
      resource({
        type: "Team",
        id: "CH-LC-01",
        geographicScope: "Lào Cai",
        assignedTeamId: "CH-LC-01",
      }),
    ],
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.resourceId, "CH-LC-01");
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
  // Baseline 102 lệnh; sau khi xóa 6 nhóm nghiệp vụ còn ~48 (9 command V2 mới đều có resource context).
  assert.ok(calls >= 40, `chỉ còn ${calls} lệnh enforcePermission`);
});
