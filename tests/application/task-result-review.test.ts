/*
 * V2 (4 vai) — vòng đời nhiệm vụ mới:
 * Đơn vị cứu hộ báo xong → "Chờ xác nhận" (không tự đóng) → cán bộ chấp nhận (Hoàn thành,
 * progress 100) hoặc từ chối (quay về Đang thực hiện, phải ghi lý do). Phân công lại bắt buộc
 * lý do và ghi lịch sử from → to; kết quả chờ xác nhận bị vô hiệu khi đổi đội.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  createTaskReview,
  decideTaskReview,
  initialAssignmentRecord,
  reassignTaskEntity,
  reportTaskDoneEntity,
  reviewTaskResultEntity,
} from "../../src/application/tasks/taskUseCases";
import { getValidTransitions } from "../../src/domain/tasks/rules";
import { hasPermission } from "../../src/lib/permissions/permissions";
import { inMemoryOperationalRepository } from "../../src/infrastructure/persistence/inMemoryOperationalRepository";

const NOW = "10/09/2024 15:00";
const LATER = "10/09/2024 15:30";
const load = () => inMemoryOperationalRepository.load();
const running = () => structuredClone(load().tasks.find((item) => item.id === "TSK-YAGI-01")!); // Đang thực hiện, CH-LC-01
const unassigned = () => structuredClone(load().tasks.find((item) => item.id === "TSK-YAGI-02")!); // Chờ giao

test("đơn vị báo xong → Chờ xác nhận, không tự Hoàn thành; kèm TaskReview chờ duyệt", () => {
  const task = running();
  const reported = reportTaskDoneEntity(task, NOW);
  assert.equal(reported.status, "Chờ xác nhận");
  assert.ok(reported.progress >= 90 && reported.progress < 100);
  const review = createTaskReview("TRV-0001", reported, "Phạm Trung Hiếu", "Đã tìm thấy 3 nạn nhân, bàn giao y tế.", NOW);
  assert.equal(review.decision, "Chờ xác nhận");
  assert.equal(review.taskId, task.id);
  assert.equal(review.reviewedBy, null);
  assert.throws(() => createTaskReview("TRV-0002", reported, "x", "   ", NOW), /tóm tắt kết quả/);
});

test("chỉ nhiệm vụ Đang thực hiện có đội mới báo xong được", () => {
  assert.throws(() => reportTaskDoneEntity(unassigned(), NOW), /đang thực hiện/);
  const noTeam = { ...running(), teamId: "" };
  assert.throws(() => reportTaskDoneEntity(noTeam, NOW), /đang thực hiện|chưa có đội/);
  const alreadyWaiting = reportTaskDoneEntity(running(), NOW);
  assert.throws(() => reportTaskDoneEntity(alreadyWaiting, LATER), /đang thực hiện/);
});

test("cán bộ chấp nhận → Hoàn thành progress 100; từ chối → quay lại Đang thực hiện và phải có lý do", () => {
  const waiting = reportTaskDoneEntity(running(), NOW);
  const review = createTaskReview("TRV-0001", waiting, "Đội", "Xong", NOW);
  const accepted = reviewTaskResultEntity(waiting, true, LATER);
  assert.equal(accepted.status, "Hoàn thành");
  assert.equal(accepted.progress, 100);
  const decidedOk = decideTaskReview(review, true, "", "Nguyễn Quốc Trung", LATER);
  assert.equal(decidedOk.decision, "Chấp nhận");
  assert.equal(decidedOk.reviewedBy, "Nguyễn Quốc Trung");
  const rejected = reviewTaskResultEntity(waiting, false, LATER);
  assert.equal(rejected.status, "Đang thực hiện");
  assert.throws(() => decideTaskReview(review, false, "  ", "Nguyễn Quốc Trung", LATER), /lý do khi từ chối/);
  const decidedNo = decideTaskReview(review, false, "Thiếu ảnh hiện trường", "Nguyễn Quốc Trung", LATER);
  assert.equal(decidedNo.decision, "Từ chối");
  assert.throws(() => decideTaskReview(decidedNo, true, "", "x", LATER), /đã được xử lý/);
  assert.throws(() => reviewTaskResultEntity(running(), true, LATER), /chờ xác nhận/);
});

test("bảng chuyển trạng thái: Chờ xác nhận chỉ đi tới Hoàn thành hoặc Đang thực hiện", () => {
  assert.deepEqual([...getValidTransitions("Chờ xác nhận")].sort(), ["Hoàn thành", "Đang thực hiện"].sort());
  assert.ok(getValidTransitions("Đang thực hiện").includes("Chờ xác nhận"));
  assert.equal(getValidTransitions("Hoàn thành").length, 0);
});

test("phân công lại bắt buộc lý do, ghi lịch sử from→to, đội mới phải tiếp nhận lại", () => {
  const task = { ...running(), assignmentHistory: [initialAssignmentRecord("CH-LC-01", "Nguyễn Quốc Trung", "10/09/2024 07:00")] };
  const target = { teamId: "CN-QUANDOI-01", teamLeader: "Nguyễn Đăng Ái" };
  assert.throws(() => reassignTaskEntity(task, target, "", "Nguyễn Quốc Trung", NOW), /lý do/);
  assert.throws(
    () => reassignTaskEntity(task, { teamId: "CH-LC-01", teamLeader: task.teamLeader }, "Đổi", "x", NOW),
    /đang là đội phụ trách/,
  );
  const reassigned = reassignTaskEntity(task, target, "CH-LC-01 quá tải tại Làng Nủ", "Nguyễn Quốc Trung", NOW);
  assert.equal(reassigned.teamId, "CN-QUANDOI-01");
  assert.equal(reassigned.status, "Đã giao");
  assert.equal(reassigned.assignmentHistory?.length, 2);
  assert.deepEqual(reassigned.assignmentHistory?.at(-1), {
    at: NOW,
    fromTeamId: "CH-LC-01",
    toTeamId: "CN-QUANDOI-01",
    actor: "Nguyễn Quốc Trung",
    reason: "CH-LC-01 quá tải tại Làng Nủ",
  });
  // Kết quả đang chờ xác nhận không còn giá trị sau khi đổi đội.
  const waiting = reportTaskDoneEntity(running(), NOW);
  const afterSwap = reassignTaskEntity(waiting, target, "Đổi đội", "x", LATER);
  assert.equal(afterSwap.status, "Đã giao");
  const done = reviewTaskResultEntity(waiting, true, LATER);
  assert.throws(() => reassignTaskEntity(done, target, "Đổi", "x", LATER), /đã kết thúc/);
});

test("ma trận quyền: rescue_unit báo xong, disaster_officer duyệt/phân công lại, Quản trị viên toàn quyền", () => {
  assert.equal(hasPermission("rescue_unit", "task_report_done"), true);
  assert.equal(hasPermission("rescue_unit", "task_review"), false);
  assert.equal(hasPermission("rescue_unit", "task_assign"), false);
  assert.equal(hasPermission("disaster_officer", "task_review"), true);
  assert.equal(hasPermission("disaster_officer", "task_assign"), true);
  assert.equal(hasPermission("admin", "task_review"), true);
  assert.equal(hasPermission("admin", "task_report_done"), true);
  assert.equal(hasPermission("citizen", "task_view"), false);
});
