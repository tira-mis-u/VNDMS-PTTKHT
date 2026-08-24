import type { OperationalAlert } from "../../domain/alerts/types";
import type { SimulationState } from "../../domain/simulation/types";
import type { OperationalSnapshot } from "./operationalSnapshot";

export type OperationalInsightsData = OperationalSnapshot & {
  alerts: OperationalAlert[];
  simulation: SimulationState;
};

export interface ProvenanceRef {
  entityId: string;
  entityType: string;
  path: string;
  timestamp: string;
}

export interface SituationMetric {
  id: string;
  label: string;
  value: number;
  description: string;
  path: string;
  source: string;
  asOf: string;
}

export interface SituationArea {
  area: string;
  activeIncidents: number;
  urgentSos: number;
  evacuations: number;
  incidentPath: string;
}

export interface SituationEvent extends ProvenanceRef {
  message: string;
  source: string;
}

export interface OperationalSituation {
  asOf: string;
  metrics: SituationMetric[];
  areas: SituationArea[];
  events: SituationEvent[];
  simulationActive: boolean;
  simulationLabel: string | null;
}

const openSos = new Set([
  "Mới tiếp nhận",
  "Đang xác minh",
  "Đã xác minh",
  "Đã điều phối",
  "Đang cứu hộ",
  "Không liên lạc được",
]);
const activeEvacuation = new Set(["Đã phê duyệt", "Đang triển khai", "Tạm dừng"]);
const activeRelief = new Set([
  "Mới tạo",
  "Chờ phê duyệt",
  "Đã phê duyệt",
  "Đang phân bổ",
  "Đã phân bổ",
  "Đang vận chuyển",
]);
const validTime = (value: string | null | undefined) =>
  Boolean(value && Number.isFinite(parseOperationalTimestamp(value)));

export function parseOperationalTimestamp(value: string, anchor?: string) {
  const trimmed = value.trim();
  const timeOnly = trimmed.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (timeOnly && anchor) {
    const day = anchor.match(/^(\d{2}\/\d{2}\/\d{4})/);
    if (day) return parseOperationalTimestamp(`${day[1]} ${trimmed}`);
  }
  const match = trimmed.match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (!match) return Number.NaN;
  const [, day, month, year, hour = "00", minute = "00", second = "00"] = match;
  const time = new Date(+year, +month - 1, +day, +hour, +minute, +second).getTime();
  const date = new Date(time);
  return date.getFullYear() === +year && date.getMonth() === +month - 1 && date.getDate() === +day
    ? time
    : Number.NaN;
}

export function getOperationalSituation(data: OperationalInsightsData): OperationalSituation {
  const activeIncidents = data.incidents.filter((item) => item.status !== "Đã đóng");
  const urgentSos = data.sosRequests.filter(
    (item) => openSos.has(item.status) && item.priority === "P1 — Khẩn cấp",
  );
  const activeEvacuations = data.evacuationOperations.filter((item) =>
    activeEvacuation.has(item.status),
  );
  const deployedTeams = data.teams.filter((item) =>
    ["Đang điều động", "Đang thực hiện"].includes(item.status),
  );
  const overloadedShelters = data.shelters.filter((item) =>
    item.status === "Quá tải" || item.currentOccupancy > item.capacity,
  );
  const pendingRelief = data.reliefRequests.filter((item) => activeRelief.has(item.status));
  const unacknowledgedAlerts = data.alerts.filter(
    (item) => item.requiresAcknowledgement && !item.acknowledgedAt,
  );

  const metrics: SituationMetric[] = [
    metric("incidents", "Sự cố đang xử lý", activeIncidents.length, "Sự cố chưa đóng trong phạm vi được phân quyền", "/incidents", "Hồ sơ sự cố", data.metadata.asOf),
    metric("alerts", "Cảnh báo chờ xác nhận", unacknowledgedAlerts.length, "Cảnh báo yêu cầu xác nhận nhưng chưa được xác nhận", "/alerts", "Cảnh báo tác nghiệp dẫn xuất", data.metadata.asOf),
    metric("sos", "SOS khẩn cấp cần xử lý", urgentSos.length, "Yêu cầu P1 còn trong vòng đời xử lý", "/sos", "Hồ sơ SOS", data.metadata.asOf),
    metric("evacuations", "Hoạt động sơ tán", activeEvacuations.length, "Hoạt động đã phê duyệt, đang triển khai hoặc tạm dừng", "/evacuations", "Hồ sơ sơ tán", data.metadata.asOf),
    metric("teams", "Đội đang điều động", deployedTeams.length, "Đội đang điều động hoặc thực hiện nhiệm vụ", "/teams", "Hồ sơ đội cứu hộ", data.metadata.asOf),
    metric("shelters", "Điểm sơ tán quá tải", overloadedShelters.length, "Trạng thái quá tải hoặc số người vượt sức chứa", "/shelters", "Hồ sơ điểm sơ tán", data.metadata.asOf),
    metric("relief", "Yêu cầu cứu trợ cần xử lý", pendingRelief.length, "Yêu cầu chưa hoàn tất hoặc chưa bị hủy", "/relief", "Hồ sơ cứu trợ", data.metadata.asOf),
  ];

  const areaMap = new Map<string, SituationArea>();
  for (const incident of activeIncidents) {
    areaMap.set(incident.location.name, {
      area: incident.location.name,
      activeIncidents: (areaMap.get(incident.location.name)?.activeIncidents ?? 0) + 1,
      urgentSos: 0,
      evacuations: 0,
      incidentPath: `/incidents/${incident.id}`,
    });
  }
  for (const sos of urgentSos) {
    const area = sos.location.administrativeArea;
    const current = areaMap.get(area) ?? { area, activeIncidents: 0, urgentSos: 0, evacuations: 0, incidentPath: "/sos" };
    current.urgentSos += 1;
    areaMap.set(area, current);
  }
  for (const operation of activeEvacuations) {
    const area = operation.sourceArea;
    const current = areaMap.get(area) ?? { area, activeIncidents: 0, urgentSos: 0, evacuations: 0, incidentPath: `/evacuations/${operation.id}` };
    current.evacuations += 1;
    areaMap.set(area, current);
  }

  const events: SituationEvent[] = [
    ...data.events.map((event) => ({ entityId: event.incidentId, entityType: "Sự cố", path: `/incidents/${event.incidentId}`, timestamp: resolveEventTimestamp(event.timestamp, data.incidents.find((item) => item.id === event.incidentId)?.createdAt), message: event.message, source: event.source ?? "Dòng thời gian sự cố" })),
    ...data.sosEvents.map((event) => ({ entityId: event.sosId, entityType: "SOS", path: `/sos/${event.sosId}`, timestamp: event.timestamp, message: event.message, source: event.source })),
    ...data.evacuationEvents.map((event) => ({ entityId: event.operationId, entityType: "Sơ tán", path: `/evacuations/${event.operationId}`, timestamp: event.timestamp, message: event.message, source: event.source })),
  ]
    .filter((event) => validTime(event.timestamp))
    .sort((a, b) => parseOperationalTimestamp(b.timestamp) - parseOperationalTimestamp(a.timestamp))
    .slice(0, 12);

  const simulationActive = data.simulation.status !== "Sẵn sàng" || data.simulation.tick > 0;
  return {
    asOf: data.metadata.asOf,
    metrics,
    areas: [...areaMap.values()].sort((a, b) => b.activeIncidents - a.activeIncidents || a.area.localeCompare(b.area, "vi")),
    events,
    simulationActive,
    simulationLabel: simulationActive
      ? `Dữ liệu mô phỏng đang hoạt động ở bước ${data.simulation.tick}; không phải dữ liệu quan trắc thực tế.`
      : null,
  };
}

function resolveEventTimestamp(value: string, anchor?: string) {
  if (Number.isFinite(parseOperationalTimestamp(value))) return value;
  const day = anchor?.match(/^(\d{2}\/\d{2}\/\d{4})/)?.[1];
  return day && Number.isFinite(parseOperationalTimestamp(value, anchor)) ? `${day} ${value}` : value;
}

function metric(id: string, label: string, value: number, description: string, path: string, source: string, asOf: string): SituationMetric {
  return { id, label, value, description, path, source, asOf };
}

export interface OperationalHistoryFilter {
  from?: string;
  to?: string;
  type?: string;
  severity?: string;
  area?: string;
}
export interface OperationalHistoryRow {
  id: string;
  code: string;
  title: string;
  type: string;
  severity: string;
  status: string;
  area: string;
  createdAt: string;
  closedAt: string;
  source: string;
  path: string;
  events: SituationEvent[];
}
export interface OperationalHistoryResult {
  rows: OperationalHistoryRow[];
  invalidRecords: Array<{ entityId: string; field: string; value: string }>;
  asOf: string;
}

export function getOperationalHistory(
  data: OperationalSnapshot,
  filter: OperationalHistoryFilter = {},
): OperationalHistoryResult {
  const invalidRecords: OperationalHistoryResult["invalidRecords"] = [];
  const from = filter.from ? parseOperationalTimestamp(filter.from) : Number.NEGATIVE_INFINITY;
  const to = filter.to ? parseOperationalTimestamp(`${filter.to} 23:59:59`) : Number.POSITIVE_INFINITY;
  const rows = data.incidents
    .filter((incident) => incident.status === "Đã đóng")
    .flatMap((incident) => {
      const closed = parseOperationalTimestamp(incident.closedAt ?? "");
      if (!Number.isFinite(closed)) {
        invalidRecords.push({ entityId: incident.id, field: "Thời điểm đóng", value: incident.closedAt ?? "Trống" });
        return [];
      }
      if (Number.isFinite(from) && closed < from) return [];
      if (Number.isFinite(to) && closed > to) return [];
      if (filter.type && incident.type !== filter.type) return [];
      if (filter.severity && incident.severity !== filter.severity) return [];
      if (filter.area && !incident.location.name.toLocaleLowerCase("vi").includes(filter.area.toLocaleLowerCase("vi"))) return [];
      const events = data.events
        .filter((event) => event.incidentId === incident.id)
        .map((event) => ({ entityId: incident.id, entityType: "Sự cố", path: `/incidents/${incident.id}`, timestamp: resolveEventTimestamp(event.timestamp, incident.createdAt), message: event.message, source: event.source ?? "Dòng thời gian sự cố" }))
        .filter((event) => validTime(event.timestamp))
        .sort((a, b) => parseOperationalTimestamp(a.timestamp) - parseOperationalTimestamp(b.timestamp));
      return [{ id: incident.id, code: incident.code, title: incident.title, type: incident.type, severity: incident.severity, status: incident.status, area: incident.location.name, createdAt: incident.createdAt, closedAt: incident.closedAt!, source: incident.source, path: `/incidents/${incident.id}`, events }];
    })
    .sort((a, b) => parseOperationalTimestamp(b.closedAt) - parseOperationalTimestamp(a.closedAt));
  return { rows, invalidRecords, asOf: data.metadata.asOf };
}

export type TrendMetric = "incidents" | "alerts" | "sos" | "tasks" | "evacuations" | "relief" | "events";
export interface OperationalTrendPoint {
  period: string;
  value: number;
  sources: ProvenanceRef[];
}
export interface OperationalTrendResult {
  metric: TrendMetric;
  points: OperationalTrendPoint[];
  sufficient: boolean;
  invalidSources: Array<{ entityId: string; timestamp: string }>;
  asOf: string;
}

export function getOperationalTrend(
  data: OperationalInsightsData,
  metricName: TrendMetric,
): OperationalTrendResult {
  const refs: ProvenanceRef[] = metricSources(data, metricName);
  const invalidSources = refs
    .filter((item) => !validTime(item.timestamp))
    .map((item) => ({ entityId: item.entityId, timestamp: item.timestamp || "Trống" }));
  const grouped = new Map<string, ProvenanceRef[]>();
  refs.filter((item) => validTime(item.timestamp)).forEach((item) => {
    const period = item.timestamp.slice(0, 10);
    grouped.set(period, [...(grouped.get(period) ?? []), item]);
  });
  const points = [...grouped.entries()]
    .map(([period, sources]) => ({ period, value: sources.length, sources }))
    .sort((a, b) => parseOperationalTimestamp(a.period) - parseOperationalTimestamp(b.period));
  return { metric: metricName, points, sufficient: points.length >= 2, invalidSources, asOf: data.metadata.asOf };
}

function metricSources(data: OperationalInsightsData, metric: TrendMetric): ProvenanceRef[] {
  if (metric === "incidents") return data.incidents.map((item) => ({ entityId: item.id, entityType: "Sự cố", path: `/incidents/${item.id}`, timestamp: item.createdAt }));
  if (metric === "alerts") return data.alerts.map((item) => ({ entityId: item.key, entityType: "Cảnh báo", path: `/alerts/${encodeURIComponent(item.key)}`, timestamp: item.detectedAt }));
  if (metric === "sos") return data.sosRequests.map((item) => ({ entityId: item.id, entityType: "SOS", path: `/sos/${item.id}`, timestamp: item.receivedAt }));
  if (metric === "tasks") return data.tasks.map((item) => ({ entityId: item.id, entityType: "Nhiệm vụ", path: `/tasks/${item.id}`, timestamp: item.createdAt }));
  if (metric === "evacuations") return data.evacuationOperations.map((item) => ({ entityId: item.id, entityType: "Sơ tán", path: `/evacuations/${item.id}`, timestamp: item.startTime ?? item.updatedAt }));
  if (metric === "relief") return data.reliefRequests.map((item) => ({ entityId: item.id, entityType: "Cứu trợ", path: `/relief/requests/${item.id}`, timestamp: item.createdAt }));
  return [
    ...data.events.map((item) => ({ entityId: item.incidentId, entityType: "Sự cố", path: `/incidents/${item.incidentId}`, timestamp: resolveEventTimestamp(item.timestamp, data.incidents.find((incident) => incident.id === item.incidentId)?.createdAt) })),
    ...data.taskUpdates.map((item) => ({ entityId: item.taskId, entityType: "Nhiệm vụ", path: `/tasks/${item.taskId}`, timestamp: item.timestamp })),
    ...data.sosEvents.map((item) => ({ entityId: item.sosId, entityType: "SOS", path: `/sos/${item.sosId}`, timestamp: item.timestamp })),
    ...data.evacuationEvents.map((item) => ({ entityId: item.operationId, entityType: "Sơ tán", path: `/evacuations/${item.operationId}`, timestamp: item.timestamp })),
  ];
}
