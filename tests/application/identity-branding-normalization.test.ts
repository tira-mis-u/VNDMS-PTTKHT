import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { groundOperationalQuestion } from "../../src/application/ai/aiGrounding";
import { resetSimulationState } from "../../src/application/simulation/simulationUseCases";
import { demoUsers } from "../../src/infrastructure/auth/demoUsers";
import {
  LocalAuthenticationAdapter,
  type StorageLike,
} from "../../src/infrastructure/auth/localAuthenticationAdapter";
import { VIETNAM_SEA_LABELS } from "../../src/infrastructure/gis/mapConfig";
import { PERSONNEL } from "../../src/data/identity/personnel";
import { inMemoryOperationalRepository } from "../../src/infrastructure/persistence/inMemoryOperationalRepository";

class MemoryStorage implements StorageLike {
  private values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}

const accounts = [
  ["Trần Quốc Thuận", "commander"],
  ["Nguyễn Quốc Trung", "operator"],
  ["Phạm Văn Đam", "local_officer"],
  ["Phạm Trung Hiếu", "rescue_leader"],
  ["Lê Nguyễn Minh Trí", "rescue_member"],
  ["Nguyễn Nam Anh", "warehouse_staff"],
] as const;

const requiredRescueMembers = [
  "Phạm Mạnh Hùng",
  "Nguyễn Ngọc Long",
  "Nguyễn Công Minh",
  "Nguyễn Văn Thành Nam",
  "Phạm Anh Sơn",
  "Nguyễn Thị Ánh Viên",
  "Nghiêm Vũ Hoàng Long",
  "Phùng Thanh Độ",
  "Trần Hà Linh",
];

const requiredAffectedPeople = [
  "Nguyễn Xuân Tú",
  "Bùi Minh",
  "Nguyễn Phương Anh",
  "Lưu Kỳ Anh",
  "Đặng Cao Bồ",
  "Ngô Bá Khá",
  "Nguyễn Hữu Phương Uyên",
  "Khúc Thị Hương",
  "Kiều Lương Tâm",
];

const sourcePeople = `Phạm Mạnh Hùng
Nguyễn Ngọc Long
Nguyễn Công Minh
Nguyễn Văn Thành Nam
Phạm Anh Sơn
Nguyễn Xuân Tú
Bùi Minh
Nguyễn Phương Anh
Dương Tuấn Khôi
Huỳnh Minh Thư
Nguyễn Thị Ánh Viên
Lưu Kỳ Anh
Đỗ Bách Khoa
Nguyễn Thanh Tùng
Đồng Lệ Quyên
Nghiêm Vũ Hoàng Long
Phùng Thanh Độ
Đặng Cao Bồ
Mai Nam Hải
Nguyễn Hoàng Long
Vũ Đinh Trọng Thắng
Trần Huyền My
Trần Thiện Thanh Bảo
Đặng Tiến Hoàng
Trần Hà Linh
Đặng Thu Hà
Võ Nguyễn Hoài Linh
Trương Đình Hoàng
Phạm Khánh Sơn
Vương Cường
Phạm Lê Hồng Quang
Ngô Bá Khá
Bùi Xuân Huấn
Nguyễn Hữu Đa
Dư Phong Linh
Hoàng Văn Khoa
Nguyễn Hữu Phương Uyên
Nguyễn Anh Dũng
Khúc Thị Hương
Nguyễn Đăng Ái
Kiều Lương Tâm
Huỳnh Trấn Thành
Nguyễn Tiến Đạt
Nguyễn Hoàng Anh
Nguyễn Tuấn Hưng
Ngô Ngọc Ly
Hà Nhật Long
Chu Xuân Hưng
Phạm Đức Trung
Lê Anh Minh
Nguyễn Trung Dũng
Lưu Thị Thanh Trúc
Nguyễn Trần Thanh Vân
Lê Huy Hoàng
Bùi Văn Nguyện
Đồng Anh Linh
Phương Hữu Dưỡng
Cao Việt Hưng
Đào Hồng Trà
Võ Văn Cường Quốc`.split("\n");

function textFiles(path: string): string[] {
  return readdirSync(path).flatMap((name) => {
    const target = join(path, name);
    return statSync(target).isDirectory() ? textFiles(target) : [target];
  });
}

test("sáu tài khoản đăng nhập bằng họ tên và giữ đúng RBAC mapping", async () => {
  assert.equal(demoUsers.length, 6);
  assert.deepEqual(
    demoUsers.map((user) => [user.displayName, user.role]),
    accounts,
  );
  assert.ok(demoUsers.every((user) => user.username === user.displayName));
  for (const [name] of accounts) {
    const adapter = new LocalAuthenticationAdapter(new MemoryStorage());
    const result = await adapter.authenticate(name, "VNDMS@2026");
    assert.equal(result.user.displayName, name);
    assert.equal(result.user.username, name);
  }
});

test("ownership của tài khoản cứu hộ và kho trỏ tới canonical resource hợp lệ", () => {
  const snapshot = inMemoryOperationalRepository.load();
  const leader = demoUsers.find((user) => user.role === "rescue_leader")!;
  const member = demoUsers.find((user) => user.role === "rescue_member")!;
  const team = snapshot.teams.find((item) => item.id === leader.teamId)!;
  assert.equal(team.leader, leader.displayName);
  assert.ok(
    team.personnel.some((person) => person.name === member.displayName),
  );
  const warehouseUser = demoUsers.find(
    (user) => user.role === "warehouse_staff",
  )!;
  assert.ok(
    snapshot.warehouses.some((item) => item.id === warehouseUser.warehouseId),
  );
});

test("Rescue Team chứa đủ thành viên bắt buộc, không duplicate hoặc broken leader", () => {
  const teams = inMemoryOperationalRepository.load().teams;
  const personnel = teams.flatMap((team) => team.personnel);
  const names = personnel.map((person) => person.name);
  const ids = personnel.map((person) => person.id);
  for (const name of requiredRescueMembers)
    assert.ok(names.includes(name), name);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(names).size, names.length);
  for (const team of teams) {
    assert.equal(team.members, team.personnel.length);
    const leaderName = team.leader.replace(/^(Bác sĩ|Đại úy)\s+/, "");
    assert.ok(team.personnel.some((person) => person.name === leaderName));
  }
});

test("SOS affected people chứa đủ nạn nhân bắt buộc và không orphan/duplicate", () => {
  const requests = inMemoryOperationalRepository.load().sosRequests;
  const people = requests.flatMap((request) => request.affectedPeople);
  const names = people.map((person) => person.name);
  const ids = people.map((person) => person.id);
  for (const name of requiredAffectedPeople)
    assert.ok(names.includes(name), name);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(names).size, names.length);
  for (const request of requests)
    assert.equal(request.affectedPeople.length, request.peopleAtRisk);
});

test("task, SOS và ownership references không bị orphan sau normalization", () => {
  const snapshot = inMemoryOperationalRepository.load();
  const teams = new Map(snapshot.teams.map((team) => [team.id, team]));
  for (const task of snapshot.tasks) {
    if (!task.teamId) continue;
    const team = teams.get(task.teamId);
    assert.ok(team, `${task.id} thiếu Team`);
    assert.equal(task.teamLeader, team!.leader);
    if (task.assignee)
      assert.ok(
        team!.personnel.some((person) => person.name === task.assignee),
        `${task.id} có assignee ngoài Team`,
      );
  }
  for (const sos of snapshot.sosRequests) {
    if (sos.linkedIncidentId)
      assert.ok(
        snapshot.incidents.some((item) => item.id === sos.linkedIncidentId),
      );
    if (sos.linkedTaskId)
      assert.ok(snapshot.tasks.some((item) => item.id === sos.linkedTaskId));
    if (sos.assignedTeamId) assert.ok(teams.has(sos.assignedTeamId));
  }
});

test("toàn bộ people source nằm trong nguồn danh tính duy nhất và Chu Xuân Hưng không bị lặp", () => {
  const identityNames = new Set(
    Object.values(PERSONNEL).map((person) => person.displayName),
  );
  assert.equal(sourcePeople.length, 60);
  assert.equal(new Set(sourcePeople).size, 60);
  for (const name of sourcePeople) assert.ok(identityNames.has(name), name);
  const personnel = inMemoryOperationalRepository
    .load()
    .teams.flatMap((team) => team.personnel);
  assert.equal(
    personnel.filter((person) => person.name === "Chu Xuân Hưng").length,
    1,
  );
});

test("AI evidence dùng tên affected person canonical", () => {
  const snapshot = inMemoryOperationalRepository.load();
  const answer = groundOperationalQuestion({
    question: "Phân tích SOS-0241",
    user: demoUsers[0],
    snapshot: { ...snapshot, simulation: resetSimulationState() },
  });
  const peopleEvidence = answer.evidence.find(
    (item) => item.entityId === "SOS-0241" && item.field === "affectedPeople",
  );
  assert.ok(peopleEvidence?.value.includes("Nguyễn Xuân Tú"));
});

test("Simulation chỉ dùng authenticated/scenario identity", () => {
  const snapshot = inMemoryOperationalRepository.load();
  const simulationSource = readFileSync(
    "src/application/simulation/simulationUseCases.ts",
    "utf8",
  );
  const knownNames = [
    ...demoUsers.map((user) => user.displayName),
    ...snapshot.teams.flatMap((team) =>
      team.personnel.map((person) => person.name),
    ),
    ...snapshot.sosRequests.flatMap((request) =>
      request.affectedPeople.map((person) => person.name),
    ),
  ];
  assert.ok(knownNames.length > 0);
  assert.ok(simulationSource.includes("PERSONNEL.LOCAL_OFFICER.id"));
  assert.ok(simulationSource.includes('source: "Cán bộ địa phương"'));
});

test("branding và geographic labels đã normalize trong source/docs", () => {
  const files = [
    ...textFiles("src"),
    ...textFiles("tests"),
    ...textFiles("docs"),
    ...textFiles("public"),
    "README.md",
    "index.html",
  ];
  const content = files.map((path) => readFileSync(path, "utf8")).join("\n");
  const legacyBrand = ["VN", "-DOCP"].join("");
  const legacyPasswordBrand = ["VN", "DOCP"].join("");
  const forbiddenEnglishSea = ["South China", " Sea"].join("");
  assert.equal(content.includes(legacyBrand), false);
  assert.equal(content.includes(legacyPasswordBrand), false);
  assert.equal(content.includes(forbiddenEnglishSea), false);
});

test("GIS chỉ inject hai nhãn quần đảo yêu cầu", () => {
  const labels = VIETNAM_SEA_LABELS.features.map(
    (feature) => feature.properties.name,
  );
  assert.deepEqual(labels, ["Quần đảo Hoàng Sa", "Quần đảo Trường Sa"]);
});
