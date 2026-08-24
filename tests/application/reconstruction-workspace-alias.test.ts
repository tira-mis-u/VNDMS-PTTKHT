import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  activeNavigationLabel,
  parseRoute,
  RECONSTRUCTION_WORKSPACE_PATH,
} from "../../src/app/routes/router";
import {
  navigationGroups,
  visibleNavigationGroups,
} from "../../src/components/navigation/navigationConfig";
import { createAuthorizedOperationalView } from "../../src/application/authorization/authorizedOperationalView";
import { demoUsers } from "../../src/infrastructure/auth/demoUsers";
import { inMemoryOperationalRepository } from "../../src/infrastructure/persistence/inMemoryOperationalRepository";
import {
  permissionMatrix,
  type Permission,
} from "../../src/lib/permissions/permissions";
import type { UserRole } from "../../src/domain/shared/auth";

const root = path.resolve(import.meta.dirname, "../..");
const source = (relative: string) =>
  fs.readFileSync(path.join(root, relative), "utf8");
const canFor =
  (role: UserRole) =>
  (permission: Permission) =>
    (permissionMatrix[role] as readonly Permission[]).includes(permission);
const account = (username: string) =>
  structuredClone(demoUsers.find((item) => item.username === username)!);

test("Tái thiết là alias điều hướng của canonical Recovery Project list", () => {
  assert.deepEqual(parseRoute(RECONSTRUCTION_WORKSPACE_PATH), {
    name: "recovery-project-list",
  });
  assert.deepEqual(parseRoute("/recovery/projects"), {
    name: "recovery-project-list",
  });
  assert.equal(
    activeNavigationLabel(parseRoute(RECONSTRUCTION_WORKSPACE_PATH)),
    "Tái thiết",
  );
  assert.equal(
    activeNavigationLabel(parseRoute("/recovery/projects/RP-0241")),
    "Tái thiết",
  );
});

test("sidebar Tái thiết có deep-link thật và giữ permission Recovery Project hiện hữu", () => {
  const item = navigationGroups
    .flatMap((group) => group.items)
    .find((entry) => entry.label === "Tái thiết");
  assert.ok(item);
  assert.equal(item.path, RECONSTRUCTION_WORKSPACE_PATH);
  assert.equal(item.permission, "recovery_project_view");
  for (const role of [
    "commander",
    "operator",
    "local_officer",
    "rescue_leader",
    "rescue_member",
    "relief_worker",
  ] as const) {
    const labels = visibleNavigationGroups(canFor(role)).flatMap((group) =>
      group.items.map((entry) => entry.label),
    );
    assert.ok(labels.includes("Tái thiết"), role);
  }
  for (const role of ["warehouse_staff", "citizen"] as const) {
    const labels = visibleNavigationGroups(canFor(role)).flatMap((group) =>
      group.items.map((entry) => entry.label),
    );
    assert.ok(!labels.includes("Tái thiết"), role);
  }
});

test("authorized canonical view chặn rò Recovery Project ngoài scope và ownership", () => {
  const snapshot = inMemoryOperationalRepository.load();
  const local = createAuthorizedOperationalView(account("Phạm Văn Đam"), snapshot);
  const localIncidentIds = new Set(local.incidents.map((item) => item.id));
  const localAssessmentIds = new Set(local.damageAssessments.map((item) => item.id));
  assert.ok(local.recoveryProjects.length > 0);
  assert.ok(
    local.recoveryProjects.every(
      (project) =>
        localIncidentIds.has(project.incidentId) &&
        project.assessmentIds.every((id) => localAssessmentIds.has(id)),
    ),
  );

  const rescue = createAuthorizedOperationalView(
    account("Phạm Trung Hiếu"),
    snapshot,
  );
  assert.ok(
    rescue.recoveryProjects.every(
      (project) =>
        !project.assignedTeamIds.length ||
        project.assignedTeamIds.includes("CH-05"),
    ),
  );

  const citizen = {
    ...account("Trần Quốc Thuận"),
    id: "USR-CITIZEN-RECONSTRUCTION",
    username: "Công dân kiểm thử tái thiết",
    displayName: "Công dân kiểm thử tái thiết",
    role: "citizen" as const,
  };
  assert.equal(
    createAuthorizedOperationalView(citizen, snapshot).recoveryProjects.length,
    0,
  );
});

test("cross-link giữ canonical Recovery Project detail làm source of truth", () => {
  for (const file of [
    "src/features/recovery/pages/DamageAssessmentDetailPage.tsx",
    "src/features/command-center/components/RecoveryExceptions.tsx",
    "src/features/analytics/pages/OperationalAnalyticsPage.tsx",
  ])
    assert.match(source(file), /\/recovery\/projects\/\$\{item\.id\}/, file);
});

test("alias không tạo page, entity hoặc state Recovery Project thứ hai", () => {
  const app = source("src/app/App.tsx");
  const context = source("src/state/operations/OperationalContext.tsx");
  assert.match(
    app,
    /route\.name === "recovery-project-list"[\s\S]*?<RecoveryProjectListPage/,
  );
  assert.match(context, /\.\.\.authorizedOperationalView/);
  assert.match(context, /createRecoveryProject: atomic\(createRecoveryProject\)/);
  assert.match(context, /updateRecoveryProject: atomic\(updateRecoveryProject\)/);
  assert.match(context, /completeRecoveryProject: atomic\(completeRecoveryProject\)/);

  const allRuntimeFiles = fs
    .readdirSync(path.join(root, "src"), { recursive: true })
    .map(String);
  assert.equal(
    allRuntimeFiles.some((file) =>
      /Reconstruction(Store|Context|Repository|EventBus|WorkspacePage)/.test(file),
    ),
    false,
  );
  const recoveryEntityDeclarations = allRuntimeFiles
    .filter((file) => /\.(ts|tsx)$/.test(file))
    .flatMap((file) =>
      source(path.join("src", file)).match(/interface\s+RecoveryProject\b/g) ?? [],
    );
  assert.equal(recoveryEntityDeclarations.length, 1);
});
