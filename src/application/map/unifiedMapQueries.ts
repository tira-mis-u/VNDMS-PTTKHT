import type { OperationalSnapshot } from "../operations/operationalSnapshot";

/**
 * Unified Operational Map — truy vấn không gian địa lý thống nhất.
 *
 * Query này là hàm THUẦN đọc từ Authorized Operational View (
 * `createAuthorizedOperationalView` đã lọc theo permission, geographic scope
 * và ownership trước khi snapshot tới đây qua OperationalStateContext).
 * Không dataset GIS thứ hai được tạo ra: mọi điểm/tuyến đều tham chiếu trực
 * tiếp canonical entity (id 1-1), không copy state, không store riêng.
 */

export type UnifiedMapKind =
  | "incident"
  | "sos"
  | "task"
  | "team"
  | "shelter"
  | "evacuation"
  | "relief"
  | "warehouse"
  | "recovery";

export type UnifiedMapSeverity = "Khẩn cấp" | "Cao" | "Trung bình" | "Thấp";

export interface UnifiedMapPoint {
  kind: UnifiedMapKind;
  kindLabel: string;
  id: string;
  /** Mã ngắn hiển thị trên nhãn bản đồ/legend. */
  code: string;
  title: string;
  area: string;
  status: string;
  /** Mức ưu tiên chuẩn hóa để filter; null nếu canonical không hỗ trợ. */
  severity: UnifiedMapSeverity | null;
  tone: "red" | "amber" | "blue" | "green" | "neutral";
  coordinates: [number, number];
  /** Route canonical tới trang chi tiết. */
  detailPath: string;
}

export interface UnifiedMapRouteLine {
  id: string;
  /** Operation mẹ — click tuyến mở drawer của operation. */
  operationId: string;
  name: string;
  status: string;
  blocked: boolean;
  points: [number, number][];
}

export interface UnifiedMapDetail {
  ref: { kind: UnifiedMapKind; id: string };
  kindLabel: string;
  title: string;
  subtitle: string;
  statusBadge: { label: string; tone: UnifiedMapPoint["tone"] };
  rows: { label: string; value: string }[];
  detailPath: string;
}

export const UNIFIED_MAP_LAYER_CONFIG: {
  key: UnifiedMapKind;
  label: string;
  color: string;
}[] = [
  { key: "incident", label: "Sự cố", color: "#f79009" },
  { key: "sos", label: "SOS", color: "#d92d20" },
  { key: "task", label: "Nhiệm vụ", color: "#7f56d9" },
  { key: "team", label: "Đội cứu hộ", color: "#1570ef" },
  { key: "shelter", label: "Điểm sơ tán", color: "#079455" },
  { key: "evacuation", label: "Hoạt động sơ tán", color: "#0e7490" },
  { key: "relief", label: "Yêu cầu cứu trợ", color: "#b54708" },
  { key: "warehouse", label: "Kho vật tư", color: "#6941c6" },
  { key: "recovery", label: "Dự án phục hồi", color: "#475467" },
];

const KIND_LABEL: Record<UnifiedMapKind, string> = Object.fromEntries(
  UNIFIED_MAP_LAYER_CONFIG.map((l) => [l.key, l.label]),
) as Record<UnifiedMapKind, string>;

const CLOSED = (status: string) =>
  ["Đã đóng", "Đã kiểm soát", "Hủy", "Đã hủy", "Từ chối"].includes(status);

function sosSev(priority: string): UnifiedMapSeverity {
  if (priority.startsWith("P1")) return "Khẩn cấp";
  if (priority.startsWith("P2")) return "Cao";
  if (priority.startsWith("P3")) return "Trung bình";
  return "Thấp";
}

function severityTone(
  severity: UnifiedMapSeverity | null,
): UnifiedMapPoint["tone"] {
  if (severity === "Khẩn cấp") return "red";
  if (severity === "Cao") return "amber";
  if (severity === "Trung bình") return "blue";
  return "neutral";
}

/**
 * Thu thập toàn bộ point từ Authorized Operational View. Entity đã đóng/hủy
 * được giữ lại chỉ khi còn cần dấu vết (Shelter/Recovery luôn hiển thị —
 * lifecycle của chúng không ẩn khỏi bản đồ tác nghiệp).
 */
export function getUnifiedMapPoints(
  source: OperationalSnapshot,
): UnifiedMapPoint[] {
  const points: UnifiedMapPoint[] = [];

  for (const incident of source.incidents) {
    if (CLOSED(incident.status)) continue;
    const severity = (incident.severity as UnifiedMapSeverity) ?? null;
    points.push({
      kind: "incident",
      kindLabel: KIND_LABEL.incident,
      id: incident.id,
      code: incident.id,
      title: incident.title,
      area: `${incident.location.name}, ${incident.affectedArea}`,
      status: incident.status,
      severity,
      tone: severityTone(severity),
      coordinates: incident.location.coordinates,
      detailPath: `/incidents/${incident.id}`,
    });
  }

  for (const sos of source.sosRequests) {
    if (["Đã xử lý", "Đã đóng", "Từ chối", "Hủy"].includes(sos.status))
      continue;
    const severity = sosSev(sos.priority);
    points.push({
      kind: "sos",
      kindLabel: KIND_LABEL.sos,
      id: sos.id,
      code: sos.id,
      title: sos.location.name,
      area: sos.location.address,
      status: sos.status,
      severity,
      tone: severityTone(severity),
      coordinates: sos.location.coordinates,
      detailPath: `/sos/${sos.id}`,
    });
  }

  for (const task of source.tasks) {
    if (["Hoàn thành", "Hủy"].includes(task.status)) continue;
    const severity = (task.priority as UnifiedMapSeverity) ?? null;
    points.push({
      kind: "task",
      kindLabel: KIND_LABEL.task,
      id: task.id,
      code: task.id,
      title: task.title,
      area: task.location,
      status: task.status,
      severity,
      tone: severityTone(severity),
      coordinates: task.coordinates,
      detailPath: `/tasks/${task.id}`,
    });
  }

  for (const team of source.teams) {
    points.push({
      kind: "team",
      kindLabel: KIND_LABEL.team,
      id: team.id,
      code: team.id,
      title: team.name,
      area: team.region,
      status: team.status,
      severity: null,
      tone: team.status === "Mất liên lạc" ? "red" : "blue",
      coordinates: team.coordinates,
      detailPath: `/teams/${team.id}`,
    });
  }

  for (const shelter of source.shelters) {
    points.push({
      kind: "shelter",
      kindLabel: KIND_LABEL.shelter,
      id: shelter.id,
      code: shelter.id,
      title: shelter.name,
      area: shelter.administrativeArea,
      status: shelter.status,
      severity: null,
      tone:
        shelter.status === "Quá tải" || shelter.status === "Không thể tiếp cận"
          ? "red"
          : shelter.status === "Gần đầy"
            ? "amber"
            : "green",
      coordinates: shelter.coordinates,
      detailPath: `/shelters/${shelter.id}`,
    });
  }

  for (const operation of source.evacuationOperations) {
    if (CLOSED(operation.status) || operation.status === "Hoàn thành")
      continue;
    const severity = (operation.priority as UnifiedMapSeverity) ?? null;
    points.push({
      kind: "evacuation",
      kindLabel: KIND_LABEL.evacuation,
      id: operation.id,
      code: operation.id,
      title: `Sơ tán từ ${operation.sourceArea}`,
      area: operation.sourceArea,
      status: operation.status,
      severity,
      tone: severityTone(severity),
      coordinates: operation.sourceCoordinates,
      detailPath: `/evacuations/${operation.id}`,
    });
  }

  for (const request of source.reliefRequests) {
    if (CLOSED(request.status)) continue;
    const severity = sosSev(request.priority);
    points.push({
      kind: "relief",
      kindLabel: KIND_LABEL.relief,
      id: request.id,
      code: request.id,
      title: request.destination,
      area: request.destination,
      status: request.status,
      severity,
      tone: severityTone(severity),
      coordinates: request.destinationCoordinates,
      detailPath: `/relief/requests/${request.id}`,
    });
  }

  for (const warehouse of source.warehouses) {
    points.push({
      kind: "warehouse",
      kindLabel: KIND_LABEL.warehouse,
      id: warehouse.id,
      code: warehouse.id,
      title: warehouse.name,
      area: warehouse.administrativeArea,
      status: warehouse.status,
      severity: null,
      tone:
        warehouse.status === "Tạm đóng"
          ? "red"
          : warehouse.status === "Hạn chế"
            ? "amber"
            : "neutral",
      coordinates: warehouse.coordinates,
      detailPath: `/relief/warehouses/${warehouse.id}`,
    });
  }

  for (const project of source.recoveryProjects) {
    if (CLOSED(project.status) || project.status === "Hoàn thành") continue;
    const severity = (project.priority as UnifiedMapSeverity) ?? null;
    points.push({
      kind: "recovery",
      kindLabel: KIND_LABEL.recovery,
      id: project.id,
      code: project.id,
      title: project.name,
      area: project.location.name,
      status: project.status,
      severity,
      tone: "neutral",
      coordinates: project.location.coordinates,
      detailPath: `/recovery/projects/${project.id}`,
    });
  }

  return points;
}

/** Tuyến sơ tán canonical (EvacuationRoute) — nét đứt khi tuyến bị chặn. */
export function getUnifiedMapRoutes(
  source: OperationalSnapshot,
): UnifiedMapRouteLine[] {
  return source.evacuationOperations
    .filter(
      (operation) =>
        !CLOSED(operation.status) &&
        operation.status !== "Hoàn thành" &&
        operation.route.coordinates.length > 1,
    )
    .map((operation) => ({
      id: `route-${operation.id}`,
      operationId: operation.id,
      name: operation.route.name,
      status: operation.route.status,
      blocked:
        operation.route.status === "Bị chặn" ||
        operation.route.status === "Hạn chế",
      points: operation.route.coordinates,
    }));
}

export type UnifiedMapLayers = Record<UnifiedMapKind, boolean>;

export function defaultUnifiedMapLayers(): UnifiedMapLayers {
  return Object.fromEntries(
    UNIFIED_MAP_LAYER_CONFIG.map((l) => [l.key, true]),
  ) as UnifiedMapLayers;
}

export interface UnifiedMapFilters {
  search: string;
  severity: "" | UnifiedMapSeverity;
  layers: UnifiedMapLayers;
}

export function countByLayer(points: UnifiedMapPoint[]) {
  const counts = Object.fromEntries(
    UNIFIED_MAP_LAYER_CONFIG.map((l) => [l.key, 0]),
  ) as Record<UnifiedMapKind, number>;
  for (const point of points) counts[point.kind] += 1;
  return counts;
}

/** Lọc presentation thuần trên tập ĐÃ được phân quyền. */
export function filterUnifiedMapPoints(
  points: UnifiedMapPoint[],
  filters: UnifiedMapFilters,
): UnifiedMapPoint[] {
  const search = filters.search.trim().toLowerCase();
  return points.filter((point) => {
    if (!filters.layers[point.kind]) return false;
    if (filters.severity && point.severity !== filters.severity) return false;
    if (
      search &&
      !`${point.id} ${point.title} ${point.area}`
        .toLowerCase()
        .includes(search)
    )
      return false;
    return true;
  });
}

/** Route của một operation chỉ xuất hiện khi layer evacuation đang bật. */
export function visibleUnifiedMapRoutes(
  routes: UnifiedMapRouteLine[],
  points: UnifiedMapPoint[],
) {
  const visibleOperations = new Set(
    points.filter((p) => p.kind === "evacuation").map((p) => p.id),
  );
  return routes.filter((route) => visibleOperations.has(route.operationId));
}

const formatBudget = (value: number) =>
  value >= 1_000_000_000
    ? `${(value / 1_000_000_000).toLocaleString("vi-VN")} tỷ ₫`
    : `${value.toLocaleString("vi-VN")} ₫`;

/**
 * Dữ liệu drawer — đọc lại entity canonical trong authorized view;
 * trả về undefined nếu entity không còn trong phạm vi được phép đọc.
 */
export function findUnifiedMapDetail(
  source: OperationalSnapshot,
  ref: { kind: UnifiedMapKind; id: string },
): UnifiedMapDetail | undefined {
  const base = {
    ref,
    kindLabel: KIND_LABEL[ref.kind],
  };
  if (ref.kind === "incident") {
    const item = source.incidents.find((x) => x.id === ref.id);
    if (!item) return undefined;
    return {
      ...base,
      title: item.title,
      subtitle: `${item.location.name}, ${item.affectedArea}`,
      statusBadge: { label: item.status, tone: "amber" },
      rows: [
        { label: "Mức độ", value: item.severity },
        { label: "Loại", value: item.type },
        { label: "Cập nhật", value: item.updatedAt },
      ],
      detailPath: `/incidents/${item.id}`,
    };
  }
  if (ref.kind === "sos") {
    const item = source.sosRequests.find((x) => x.id === ref.id);
    if (!item) return undefined;
    return {
      ...base,
      title: item.location.name,
      subtitle: item.location.address,
      statusBadge: { label: item.status, tone: "red" },
      rows: [
        { label: "Ưu tiên", value: item.priority },
        { label: "Người báo", value: item.reporter.name },
        { label: "Gặp nguy hiểm", value: `${item.peopleAtRisk} người` },
      ],
      detailPath: `/sos/${item.id}`,
    };
  }
  if (ref.kind === "task") {
    const item = source.tasks.find((x) => x.id === ref.id);
    if (!item) return undefined;
    return {
      ...base,
      title: item.title,
      subtitle: item.location,
      statusBadge: { label: item.status, tone: "blue" },
      rows: [
        { label: "Ưu tiên", value: item.priority },
        { label: "Đội", value: item.teamId || "Chưa giao" },
        { label: "Tiến độ", value: `${item.progress}%` },
      ],
      detailPath: `/tasks/${item.id}`,
    };
  }
  if (ref.kind === "team") {
    const item = source.teams.find((x) => x.id === ref.id);
    if (!item) return undefined;
    return {
      ...base,
      title: item.name,
      subtitle: item.region,
      statusBadge: { label: item.status, tone: "blue" },
      rows: [
        { label: "Thành viên", value: `${item.members} người` },
        { label: "Nhiệm vụ", value: item.currentTask ?? "Không có" },
        {
          label: "Liên lạc",
          value: item.communicationStatus,
        },
      ],
      detailPath: `/teams/${item.id}`,
    };
  }
  if (ref.kind === "shelter") {
    const item = source.shelters.find((x) => x.id === ref.id);
    if (!item) return undefined;
    return {
      ...base,
      title: item.name,
      subtitle: item.address,
      statusBadge: { label: item.status, tone: "green" },
      rows: [
        {
          label: "Sức chứa",
          value: `${item.currentOccupancy}/${item.capacity} người`,
        },
        { label: "Loại", value: item.type },
        { label: "Tiếp cận", value: item.accessibility },
      ],
      detailPath: `/shelters/${item.id}`,
    };
  }
  if (ref.kind === "evacuation") {
    const item = source.evacuationOperations.find((x) => x.id === ref.id);
    if (!item) return undefined;
    return {
      ...base,
      title: `Sơ tán từ ${item.sourceArea}`,
      subtitle: `Tuyến: ${item.route.name}`,
      statusBadge: { label: item.status, tone: "blue" },
      rows: [
        { label: "Ưu tiên", value: item.priority },
        {
          label: "Đã sơ tán",
          value: `${item.evacuatedPopulation}/${item.estimatedPopulation} người`,
        },
        { label: "Tuyến", value: item.route.status },
      ],
      detailPath: `/evacuations/${item.id}`,
    };
  }
  if (ref.kind === "relief") {
    const item = source.reliefRequests.find((x) => x.id === ref.id);
    if (!item) return undefined;
    return {
      ...base,
      title: `Yêu cầu ${item.code}`,
      subtitle: `Đích: ${item.destination}`,
      statusBadge: { label: item.status, tone: "amber" },
      rows: [
        { label: "Ưu tiên", value: item.priority },
        { label: "Nguồn yêu cầu", value: item.origin },
        {
          label: "Số danh mục hàng",
          value: `${item.items.length} mặt hàng`,
        },
      ],
      detailPath: `/relief/requests/${item.id}`,
    };
  }
  if (ref.kind === "warehouse") {
    const item = source.warehouses.find((x) => x.id === ref.id);
    if (!item) return undefined;
    return {
      ...base,
      title: item.name,
      subtitle: item.address,
      statusBadge: { label: item.status, tone: "neutral" },
      rows: [
        { label: "Loại kho", value: item.type },
        {
          label: "Công suất dùng",
          value: `${item.currentUtilization}/${item.capacity}`,
        },
        { label: "Phụ trách", value: item.responsibleOfficer.name },
      ],
      detailPath: `/relief/warehouses/${item.id}`,
    };
  }
  const item = source.recoveryProjects.find((x) => x.id === ref.id);
  if (!item) return undefined;
  return {
    ...base,
    title: item.name,
    subtitle: item.location.name,
    statusBadge: { label: item.status, tone: "neutral" },
    rows: [
      { label: "Ưu tiên", value: item.priority },
      { label: "Chủ trì", value: item.owner },
      { label: "Ngân sách dự kiến", value: formatBudget(item.estimatedBudget) },
    ],
    detailPath: `/recovery/projects/${item.id}`,
  };
}

/** Nhãn cập nhật dữ liệu cho header (nguồn: canonical event mới nhất). */
export function getUnifiedMapDataStamp(source: OperationalSnapshot) {
  const stamps = [
    source.events[0]?.timestamp,
    source.sosEvents[0]?.timestamp,
    source.teamEvents[0]?.timestamp,
    source.shelterEvents[0]?.timestamp,
    source.evacuationEvents[0]?.timestamp,
    source.reliefEvents[0]?.timestamp,
  ].filter((value): value is string => Boolean(value));
  return stamps.sort().reverse()[0] ?? null;
}
