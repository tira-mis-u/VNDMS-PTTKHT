export type SimulationStatus =
  "Sẵn sàng" | "Đang chạy" | "Tạm dừng" | "Hoàn thành";
export type SimulationSpeed = 0.5 | 1 | 2 | 4;
export type SimulationStage =
  | "Bình thường"
  | "Cảnh báo"
  | "Nguy hiểm"
  | "Ứng phó"
  | "Sơ tán"
  | "Cứu hộ"
  | "Ổn định"
  | "Phục hồi";
export type SimulationRisk = "Thấp" | "Trung bình" | "Cao" | "Rất cao";
export type SimulationEventKind = "Mô phỏng" | "Đột biến vận hành";
export type SimulationMutation =
  | "none"
  | "incident-risk"
  | "incident-operational"
  | "road-restriction"
  | "evacuation-route"
  | "shelter-pressure"
  | "shelter-critical"
  | "sos-create"
  | "task-create"
  | "team-dispatch"
  | "relief-pressure"
  | "response-progress"
  | "stabilize"
  | "recovery-transition";
export interface HydrologicalThreshold {
  code: "BĐ I" | "BĐ II" | "BĐ III";
  level: number;
  unit: "m";
}
export interface SimulationEvent {
  id: string;
  tick: number;
  simulationTime: string;
  kind: SimulationEventKind;
  title: string;
  reason: string;
  consequence: string;
  mutation: SimulationMutation;
  entityType: string | null;
  entityId: string | null;
  entityPath: string | null;
  status: "Đã áp dụng" | "Chờ áp dụng";
}
export interface SimulationState {
  scenarioId: "red-river-flood-hanoi";
  scenarioName: "Lũ Sông Hồng — Hà Nội";
  seed: 20240901;
  tick: number;
  maxTick: number;
  simulationTime: string;
  status: SimulationStatus;
  speed: SimulationSpeed;
  stage: SimulationStage;
  rainfall: number;
  riverLevel: number;
  riverLevelRate: number;
  warningLevel: "Dưới BĐ I" | "BĐ I" | "BĐ II" | "BĐ III";
  riskLevel: SimulationRisk;
  affectedAreas: string[];
  blockedRoads: string[];
  activeHazards: string[];
  thresholds: HydrologicalThreshold[];
  triggeredEvents: SimulationEvent[];
  generatedOperationalEvents: string[];
  appliedEventIds: string[];
}
export interface TickDefinition {
  tick: number;
  minutesFromStart: number;
  stage: SimulationStage;
  rainfall: number;
  riverLevel: number;
  riskLevel: SimulationRisk;
  affectedAreas: string[];
  blockedRoads: string[];
  hazards: string[];
  event: Omit<SimulationEvent, "id" | "tick" | "simulationTime" | "status">;
}
