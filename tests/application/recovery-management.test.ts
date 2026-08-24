import test from "node:test";
import assert from "node:assert/strict";
import {
  addDamageItem,
  approveRecoveryProject,
  assertRecoveryScope,
  completeMilestone,
  createDamageAssessment,
  createRecoveryProject,
  createRevision,
  rejectDamageAssessment,
  skipMilestone,
  startMilestone,
  submitDamageAssessment,
  updateDamageAssessment,
  updateRecoveryBudget,
  verifyDamageAssessment,
} from "../../src/application/recovery/recoveryUseCases";
import {
  filterDamageAssessments,
  filterRecoveryProjects,
  getRecoveryExceptions,
} from "../../src/application/recovery/recoveryQueries";
import {
  initialDamageAssessments,
  initialRecoveryProjects,
} from "../../src/data/scenarios/red-river-flood/recoverySeed";
import {
  assertPermission,
  hasPermission,
} from "../../src/lib/permissions/permissions";
const clone = <T>(value: T): T => structuredClone(value);
test("create, add item và submit assessment dùng workflow thật", () => {
  let value = createDamageAssessment(
    "DA-X",
    {
      incidentId: "INC-0241",
      area: "Tây Hồ, Hà Nội",
      assessmentType: "Hạ tầng",
      severity: "Trung bình",
      assessor: "A",
      assessedAt: "x",
      summary: "Thiệt hại",
      affectedPopulation: 1,
      affectedHouseholds: 1,
      damagedBuildings: 1,
      damagedInfrastructure: 1,
      damagedRoads: 0,
      damagedAgriculture: 0,
      damagedUtilities: 0,
      estimatedLoss: 0,
      geographicScope: "Tây Hồ, Hà Nội",
      location: { name: "X", coordinates: [105.8, 21.0] },
      affectedAreaCoordinates: [],
    },
    "x",
  );
  value = addDamageItem(
    value,
    {
      id: "I",
      category: "Nhà",
      description: "Hư hỏng",
      quantity: 1,
      unit: "căn",
      damageLevel: "Nghiêm trọng",
      estimatedCost: 100,
      affectedArea: "X",
      location: value.location,
      evidence: [],
      notes: "",
    },
    "y",
  );
  assert.equal(submitDamageAssessment(value, "z").status, "Đã gửi");
});
test("verified assessment không sửa trực tiếp và revision giữ nguồn", () => {
  const value = clone(initialDamageAssessments[0]);
  assert.throws(
    () => updateDamageAssessment(value, { summary: "Sửa" }, "x"),
    /bản điều chỉnh/,
  );
  const revision = createRevision("DA-0241-R2", value, "B", "x");
  assert.equal(revision.status, "Nháp");
  assert.equal(revision.revisionOf, "DA-0241");
  assert.equal(revision.revision, 2);
});
test("verification yêu cầu actor evidence note; rejection yêu cầu reason", () => {
  const review = {
    ...clone(initialDamageAssessments[1]),
    status: "Đang thẩm định" as const,
  };
  assert.throws(
    () => verifyDamageAssessment(review, "A", [], "", "x"),
    /căn cứ/,
  );
  assert.equal(
    verifyDamageAssessment(
      review,
      "A",
      [review.evidence[0].id],
      "Đủ cơ sở",
      "x",
    ).status,
    "Đã xác minh",
  );
  assert.throws(
    () => rejectDamageAssessment(review, "A", "", [], "x"),
    /lý do/,
  );
  assert.equal(
    rejectDamageAssessment(review, "A", "Thiếu ảnh", [], "x").status,
    "Từ chối",
  );
});
test("project approval chỉ nhận verified assessment và budget hợp lệ", () => {
  const project = clone(initialRecoveryProjects[2]);
  assert.equal(
    approveRecoveryProject(
      project,
      clone(initialDamageAssessments),
      18000000000,
      "x",
    ).status,
    "Đã phê duyệt",
  );
  assert.throws(
    () =>
      approveRecoveryProject(
        { ...project, assessmentIds: ["DA-0242"] },
        clone(initialDamageAssessments),
        1,
        "x",
      ),
    /đã xác minh/,
  );
});
test("budget vượt mức cần explicit override", () => {
  const project = clone(initialRecoveryProjects[0]);
  assert.throws(
    () => updateRecoveryBudget(project, project.approvedBudget + 1, null, "x"),
    /phê duyệt ngoại lệ/,
  );
  assert.equal(
    updateRecoveryBudget(
      project,
      project.approvedBudget + 1,
      "Chỉ huy phê duyệt bổ sung",
      "x",
    ).spentBudget,
    project.approvedBudget + 1,
  );
});
test("milestone start/complete và optional skip được enforcement", () => {
  let project = clone(initialRecoveryProjects[1]);
  project = startMilestone(project, "RM-242-1", "x");
  project = completeMilestone(project, "RM-242-1", "y");
  assert.equal(project.milestones[0].status, "Hoàn thành");
  assert.throws(
    () => skipMilestone(clone(initialRecoveryProjects[1]), "RM-242-1", "x"),
    /bắt buộc/,
  );
  const optional = {
    ...clone(initialRecoveryProjects[1]),
    milestones: clone(initialRecoveryProjects[1].milestones).map(
      (item, index) => (index === 0 ? { ...item, required: false } : item),
    ),
  };
  assert.equal(
    skipMilestone(optional, "RM-242-1", "x").milestones[0].status,
    "Bỏ qua",
  );
});
test("queries operational sort và exceptions", () => {
  const assessments = filterDamageAssessments(clone(initialDamageAssessments), {
    search: "",
    status: "Tất cả trạng thái",
    type: "Tất cả loại đánh giá",
    severity: "Tất cả mức độ",
    area: "Tất cả khu vực",
    assessor: "Tất cả cán bộ",
    incident: "Tất cả sự cố",
    verification: "Tất cả xác minh",
    dateRange: "Tất cả thời gian",
  });
  assert.equal(
    ["Đã gửi", "Đang thẩm định"].includes(assessments[0].status),
    true,
  );
  const projects = filterRecoveryProjects(clone(initialRecoveryProjects), {
    search: "",
    status: "Tất cả trạng thái",
    priority: "Tất cả ưu tiên",
    category: "Tất cả nhóm dự án",
    area: "Tất cả khu vực",
    incident: "Tất cả sự cố",
    owner: "Tất cả phụ trách",
    overdue: "Tất cả tiến độ",
  });
  assert.equal(projects[0].priority, "Khẩn cấp");
  assert.ok(
    getRecoveryExceptions(initialDamageAssessments, initialRecoveryProjects)
      .length > 0,
  );
});
test("RBAC và geographic scope được enforce", () => {
  assert.equal(hasPermission("commander", "damage_assessment_verify"), true);
  assert.equal(
    hasPermission("local_officer", "damage_assessment_verify"),
    false,
  );
  assert.equal(hasPermission("operator", "recovery_project_execute"), true);
  assert.throws(
    () => assertPermission("local_officer", "recovery_project_approve"),
    /không có quyền/,
  );
  assert.throws(
    () => assertRecoveryScope("local_officer", "Đà Nẵng", "Hà Nội"),
    /ngoài phạm vi/,
  );
  assert.doesNotThrow(() =>
    assertRecoveryScope("local_officer", "Tây Hồ, Hà Nội", "Hà Nội"),
  );
});
test("create project giữ reference assessment, không sao chép entity", () => {
  const input = {
    name: "P",
    incidentId: "INC-0241",
    assessmentIds: ["DA-0241"],
    category: "Nhà ở",
    priority: "Cao" as const,
    owner: "A",
    geographicScope: "Hà Nội",
    estimatedBudget: 1,
    targetDate: "30/09/2026",
    location: { name: "X", coordinates: [105.8, 21.0] as [number, number] },
    affectedAreaCoordinates: [] as [number, number][],
    notes: "",
  };
  const value = createRecoveryProject("RP-X", input, "x");
  assert.deepEqual(value.assessmentIds, ["DA-0241"]);
  assert.equal("summary" in value, false);
});
