import type {
  SimulationEvent,
  SimulationSpeed,
  SimulationState,
  TickDefinition,
} from "./types";
export const SIMULATION_SEED = 20240901 as const;
export const SIMULATION_START = "21/08/2026 08:30";
export const HYDROLOGICAL_THRESHOLDS = [
  { code: "BĐ I", level: 9.5, unit: "m" },
  { code: "BĐ II", level: 10.5, unit: "m" },
  { code: "BĐ III", level: 11.5, unit: "m" },
] as const;
export const TICK_DEFINITIONS: TickDefinition[] = [
  {
    tick: 1,
    minutesFromStart: 10,
    stage: "Bình thường",
    rainfall: 18,
    riverLevel: 9.1,
    riskLevel: "Thấp",
    affectedAreas: ["Hành lang Sông Hồng"],
    blockedRoads: [],
    hazards: ["Mưa lớn cục bộ"],
    event: {
      kind: "Mô phỏng",
      title: "Lượng mưa mô phỏng tăng",
      reason: "Dải hội tụ duy trì trên lưu vực thượng nguồn.",
      consequence: "Bắt đầu theo dõi diễn biến thủy văn.",
      mutation: "none",
      entityType: null,
      entityId: null,
      entityPath: null,
    },
  },
  {
    tick: 2,
    minutesFromStart: 20,
    stage: "Cảnh báo",
    rainfall: 34,
    riverLevel: 9.7,
    riskLevel: "Trung bình",
    affectedAreas: ["Hành lang Sông Hồng", "Tây Hồ"],
    blockedRoads: [],
    hazards: ["Mưa lớn", "Nước sông lên nhanh"],
    event: {
      kind: "Mô phỏng",
      title: "Mực nước vượt BĐ I",
      reason: "Mưa tích lũy làm lưu lượng về Hà Nội tăng.",
      consequence: "Kích hoạt theo dõi mức cảnh báo.",
      mutation: "none",
      entityType: "Trạm thủy văn",
      entityId: "TV-HN-01",
      entityPath: null,
    },
  },
  {
    tick: 3,
    minutesFromStart: 30,
    stage: "Cảnh báo",
    rainfall: 51,
    riverLevel: 10.7,
    riskLevel: "Cao",
    affectedAreas: ["Tây Hồ", "Hoàn Kiếm ven sông"],
    blockedRoads: [],
    hazards: ["Mưa lớn", "Ngập vùng trũng"],
    event: {
      kind: "Mô phỏng",
      title: "Mực nước vượt BĐ II",
      reason: "Tốc độ tăng mực nước vượt 1 m trong 10 phút mô phỏng.",
      consequence: "Mở rộng khu vực có nguy cơ ngập.",
      mutation: "none",
      entityType: "Trạm thủy văn",
      entityId: "TV-HN-01",
      entityPath: null,
    },
  },
  {
    tick: 4,
    minutesFromStart: 40,
    stage: "Nguy hiểm",
    rainfall: 67,
    riverLevel: 11.6,
    riskLevel: "Rất cao",
    affectedAreas: ["Tây Hồ", "Hoàn Kiếm ven sông", "Long Biên ven đê"],
    blockedRoads: [],
    hazards: ["Vượt BĐ III", "Ngập ngoài đê"],
    event: {
      kind: "Đột biến vận hành",
      title: "Mực nước vượt BĐ III, rủi ro tăng Rất cao",
      reason: "Mực nước 11,6 m vượt ngưỡng BĐ III 11,5 m.",
      consequence: "INC-0241 được nâng mức Khẩn cấp và ghi nhật ký.",
      mutation: "incident-risk",
      entityType: "Incident",
      entityId: "INC-0241",
      entityPath: "/incidents/INC-0241",
    },
  },
  {
    tick: 5,
    minutesFromStart: 50,
    stage: "Ứng phó",
    rainfall: 74,
    riverLevel: 12.0,
    riskLevel: "Rất cao",
    affectedAreas: ["Tây Hồ", "Hoàn Kiếm ven sông", "Long Biên ven đê"],
    blockedRoads: [],
    hazards: ["Vượt BĐ III", "Ngập ngoài đê", "Dòng chảy mạnh"],
    event: {
      kind: "Đột biến vận hành",
      title: "Sự cố chuyển sang ứng phó diện rộng",
      reason: "Mực nước tiếp tục tăng sau khi vượt BĐ III.",
      consequence: "INC-0241 chuyển sang Đang xử lý; phương án ứng phó lũ ghi nhận điều kiện kích hoạt.",
      mutation: "incident-operational",
      entityType: "Incident",
      entityId: "INC-0241",
      entityPath: "/incidents/INC-0241",
    },
  },
  {
    tick: 6,
    minutesFromStart: 60,
    stage: "Ứng phó",
    rainfall: 78,
    riverLevel: 12.25,
    riskLevel: "Rất cao",
    affectedAreas: ["Tây Hồ", "Hoàn Kiếm ven sông", "Long Biên ven đê"],
    blockedRoads: ["Đoạn Âu Cơ – Nghi Tàm"],
    hazards: ["Vượt BĐ III", "Ngập ngoài đê", "Hạn chế giao thông"],
    event: {
      kind: "Đột biến vận hành",
      title: "Hạn chế tuyến Âu Cơ – Nghi Tàm",
      reason: "Độ sâu ngập mô phỏng vượt 0,5 m.",
      consequence: "EVAC-001 chuyển tuyến sang trạng thái Hạn chế.",
      mutation: "road-restriction",
      entityType: "Evacuation",
      entityId: "EVAC-001",
      entityPath: "/shelters",
    },
  },
  {
    tick: 7,
    minutesFromStart: 70,
    stage: "Sơ tán",
    rainfall: 72,
    riverLevel: 12.35,
    riskLevel: "Rất cao",
    affectedAreas: ["Tây Hồ", "Hoàn Kiếm ven sông", "Long Biên ven đê"],
    blockedRoads: ["Đoạn Âu Cơ – Nghi Tàm"],
    hazards: ["Vượt BĐ III", "Tuyến sơ tán hạn chế"],
    event: {
      kind: "Đột biến vận hành",
      title: "Điều chỉnh tuyến sơ tán",
      reason: "Tuyến chính qua Nghi Tàm bị hạn chế.",
      consequence: "EVAC-001 sử dụng tuyến thay thế tới TH-01.",
      mutation: "evacuation-route",
      entityType: "Evacuation",
      entityId: "EVAC-001",
      entityPath: "/shelters",
    },
  },
  {
    tick: 8,
    minutesFromStart: 80,
    stage: "Sơ tán",
    rainfall: 65,
    riverLevel: 12.3,
    riskLevel: "Rất cao",
    affectedAreas: ["Tây Hồ", "Hoàn Kiếm ven sông", "Long Biên ven đê"],
    blockedRoads: ["Đoạn Âu Cơ – Nghi Tàm"],
    hazards: ["Áp lực sơ tán"],
    event: {
      kind: "Đột biến vận hành",
      title: "Dân số tới điểm sơ tán tăng",
      reason: "EVAC-001 đưa thêm người ra khỏi vùng ngập.",
      consequence: "TH-01 tăng lên 450/500 người.",
      mutation: "shelter-pressure",
      entityType: "Shelter",
      entityId: "TH-01",
      entityPath: "/shelters/TH-01",
    },
  },
  {
    tick: 9,
    minutesFromStart: 90,
    stage: "Sơ tán",
    rainfall: 61,
    riverLevel: 12.2,
    riskLevel: "Rất cao",
    affectedAreas: ["Tây Hồ", "Hoàn Kiếm ven sông", "Long Biên ven đê"],
    blockedRoads: ["Đoạn Âu Cơ – Nghi Tàm"],
    hazards: ["Điểm sơ tán gần đầy"],
    event: {
      kind: "Đột biến vận hành",
      title: "TH-01 gần đạt công suất",
      reason: "Lượng người sơ tán tiếp tục tăng.",
      consequence: "TH-01 đạt 98% sức chứa; phát sinh ngoại lệ nguồn lực.",
      mutation: "shelter-critical",
      entityType: "Shelter",
      entityId: "TH-01",
      entityPath: "/shelters/TH-01",
    },
  },
  {
    tick: 10,
    minutesFromStart: 100,
    stage: "Cứu hộ",
    rainfall: 58,
    riverLevel: 12.1,
    riskLevel: "Rất cao",
    affectedAreas: ["Tây Hồ", "Hoàn Kiếm ven sông", "Long Biên ven đê"],
    blockedRoads: ["Đoạn Âu Cơ – Nghi Tàm"],
    hazards: ["Người dân bị cô lập"],
    event: {
      kind: "Đột biến vận hành",
      title: "Tiếp nhận SOS tại Tứ Liên",
      reason: "Một hộ có người cao tuổi bị cô lập bởi nước dâng.",
      consequence: "Tạo SOS-SIM-001 và liên kết INC-0241.",
      mutation: "sos-create",
      entityType: "SOS",
      entityId: "SOS-SIM-001",
      entityPath: "/sos/SOS-SIM-001",
    },
  },
  {
    tick: 11,
    minutesFromStart: 110,
    stage: "Cứu hộ",
    rainfall: 52,
    riverLevel: 11.95,
    riskLevel: "Cao",
    affectedAreas: ["Tây Hồ", "Hoàn Kiếm ven sông"],
    blockedRoads: ["Đoạn Âu Cơ – Nghi Tàm"],
    hazards: ["Cứu hộ dân bị cô lập"],
    event: {
      kind: "Đột biến vận hành",
      title: "Tạo nhiệm vụ cứu hộ SOS",
      reason: "SOS-SIM-001 đã được xác minh và cần lực lượng tiếp cận.",
      consequence: "Tạo TSK-SIM-001 qua quy trình nhiệm vụ.",
      mutation: "task-create",
      entityType: "Task",
      entityId: "TSK-SIM-001",
      entityPath: "/tasks/TSK-SIM-001",
    },
  },
  {
    tick: 12,
    minutesFromStart: 120,
    stage: "Cứu hộ",
    rainfall: 46,
    riverLevel: 11.8,
    riskLevel: "Cao",
    affectedAreas: ["Tây Hồ", "Hoàn Kiếm ven sông"],
    blockedRoads: ["Đoạn Âu Cơ – Nghi Tàm"],
    hazards: ["Cứu hộ dân bị cô lập"],
    event: {
      kind: "Đột biến vận hành",
      title: "Điều động CH-05 cứu hộ",
      reason: "CH-05 kết thúc nghỉ ca và có năng lực sơ tán dân cư.",
      consequence: "TSK-SIM-001 được giao cho CH-05; đội chuyển sang Đang điều động.",
      mutation: "team-dispatch",
      entityType: "Team",
      entityId: "CH-05",
      entityPath: "/teams/CH-05",
    },
  },
  {
    tick: 13,
    minutesFromStart: 130,
    stage: "Cứu hộ",
    rainfall: 38,
    riverLevel: 11.65,
    riskLevel: "Cao",
    affectedAreas: ["Tây Hồ", "Hoàn Kiếm ven sông"],
    blockedRoads: ["Đoạn Âu Cơ – Nghi Tàm"],
    hazards: ["Thiếu vật tư điểm sơ tán"],
    event: {
      kind: "Đột biến vận hành",
      title: "Nhu cầu cứu trợ tăng",
      reason: "TH-01 gần đầy và cần bổ sung nước uống.",
      consequence: "Tạo REQ-SIM-001 chờ phê duyệt.",
      mutation: "relief-pressure",
      entityType: "Relief Request",
      entityId: "REQ-SIM-001",
      entityPath: "/relief/requests/REQ-SIM-001",
    },
  },
  {
    tick: 14,
    minutesFromStart: 140,
    stage: "Ứng phó",
    rainfall: 31,
    riverLevel: 11.45,
    riskLevel: "Cao",
    affectedAreas: ["Tây Hồ", "Hoàn Kiếm ven sông"],
    blockedRoads: ["Đoạn Âu Cơ – Nghi Tàm"],
    hazards: ["Nước rút chậm"],
    event: {
      kind: "Đột biến vận hành",
      title: "Lực lượng tiếp cận khu vực SOS",
      reason: "CH-05 xác nhận nhiệm vụ và bắt đầu triển khai.",
      consequence:
        "TSK-SIM-001 và SOS-SIM-001 chuyển sang đang thực hiện/cứu hộ.",
      mutation: "response-progress",
      entityType: "Task",
      entityId: "TSK-SIM-001",
      entityPath: "/tasks/TSK-SIM-001",
    },
  },
  {
    tick: 15,
    minutesFromStart: 150,
    stage: "Ổn định",
    rainfall: 20,
    riverLevel: 11.1,
    riskLevel: "Trung bình",
    affectedAreas: ["Tây Hồ", "Hoàn Kiếm ven sông"],
    blockedRoads: [],
    hazards: ["Theo dõi nước rút"],
    event: {
      kind: "Đột biến vận hành",
      title: "Hoàn thành cứu hộ, sự cố dần ổn định",
      reason: "Mưa giảm và mực nước xuống dưới BĐ III.",
      consequence: "Nhiệm vụ hoàn thành, SOS đã xử lý, INC-0241 được kiểm soát.",
      mutation: "stabilize",
      entityType: "Incident",
      entityId: "INC-0241",
      entityPath: "/incidents/INC-0241",
    },
  },
  {
    tick: 16,
    minutesFromStart: 160,
    stage: "Phục hồi",
    rainfall: 12,
    riverLevel: 10.7,
    riskLevel: "Trung bình",
    affectedAreas: ["Tây Hồ", "Hoàn Kiếm ven sông"],
    blockedRoads: [],
    hazards: ["Thiệt hại sau ngập"],
    event: {
      kind: "Đột biến vận hành",
      title: "Chuyển giai đoạn phục hồi",
      reason: "Ứng phó khẩn cấp ổn định và đã có đánh giá được xác minh.",
      consequence: "Tạo và khởi động RP-SIM-001 từ DA-0243.",
      mutation: "recovery-transition",
      entityType: "Dự án phục hồi",
      entityId: "RP-SIM-001",
      entityPath: "/recovery/projects/RP-SIM-001",
    },
  },
];
function formatTime(minutesFromStart: number) {
  const [date, time] = SIMULATION_START.split(" ");
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutesFromStart;
  return `${date} ${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
function warning(level: number): SimulationState["warningLevel"] {
  if (level >= 11.5) return "BĐ III";
  if (level >= 10.5) return "BĐ II";
  if (level >= 9.5) return "BĐ I";
  return "Dưới BĐ I";
}
export function createSimulationState(
  seed: number = SIMULATION_SEED,
): SimulationState {
  if (seed !== SIMULATION_SEED)
    throw new Error("Scenario chỉ hỗ trợ seed deterministic 20240901.");
  return {
    scenarioId: "red-river-flood-hanoi",
    scenarioName: "Lũ Sông Hồng — Hà Nội",
    seed: SIMULATION_SEED,
    tick: 0,
    maxTick: TICK_DEFINITIONS.length,
    simulationTime: SIMULATION_START,
    status: "Sẵn sàng",
    speed: 1,
    stage: "Bình thường",
    rainfall: 6,
    riverLevel: 8.8,
    riverLevelRate: 0,
    warningLevel: "Dưới BĐ I",
    riskLevel: "Thấp",
    affectedAreas: ["Hành lang Sông Hồng"],
    blockedRoads: [],
    activeHazards: [],
    thresholds: [...HYDROLOGICAL_THRESHOLDS],
    triggeredEvents: [],
    generatedOperationalEvents: [],
    appliedEventIds: [],
  };
}
export function setSimulationSpeed(
  state: SimulationState,
  speed: SimulationSpeed,
) {
  return { ...state, speed };
}
export function playSimulation(state: SimulationState): SimulationState {
  return state.tick >= state.maxTick
    ? state
    : { ...state, status: "Đang chạy" };
}
export function pauseSimulation(state: SimulationState): SimulationState {
  return state.status === "Đang chạy"
    ? { ...state, status: "Tạm dừng" }
    : state;
}
export function advanceSimulation(state: SimulationState): {
  state: SimulationState;
  event: SimulationEvent | null;
} {
  if (state.tick >= state.maxTick)
    return { state: { ...state, status: "Hoàn thành" }, event: null };
  const definition = TICK_DEFINITIONS[state.tick];
  const previousLevel = state.riverLevel;
  const id = `SIM-${state.seed}-T${String(definition.tick).padStart(2, "0")}`;
  if (state.appliedEventIds.includes(id)) return { state, event: null };
  const event: SimulationEvent = {
    ...definition.event,
    id,
    tick: definition.tick,
    simulationTime: formatTime(definition.minutesFromStart),
    status: "Đã áp dụng",
  };
  const next: SimulationState = {
    ...state,
    tick: definition.tick,
    simulationTime: event.simulationTime,
    status:
      definition.tick === state.maxTick
        ? "Hoàn thành"
        : state.status === "Sẵn sàng"
          ? "Tạm dừng"
          : state.status,
    stage: definition.stage,
    rainfall: definition.rainfall,
    riverLevel: definition.riverLevel,
    riverLevelRate:
      Math.round((definition.riverLevel - previousLevel) * 100) / 100,
    warningLevel: warning(definition.riverLevel),
    riskLevel: definition.riskLevel,
    affectedAreas: definition.affectedAreas,
    blockedRoads: definition.blockedRoads,
    activeHazards: definition.hazards,
    triggeredEvents: [event, ...state.triggeredEvents],
    generatedOperationalEvents:
      event.mutation === "none"
        ? state.generatedOperationalEvents
        : [event.id, ...state.generatedOperationalEvents],
    appliedEventIds: [...state.appliedEventIds, id],
  };
  return { state: next, event };
}
