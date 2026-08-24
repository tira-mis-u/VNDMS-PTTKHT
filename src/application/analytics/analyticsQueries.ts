import type { Incident, IncidentEvent } from "@/domain/incidents/types";
import type { IncidentTask, TaskUpdate } from "@/domain/tasks/types";
import type { RescueTeam } from "@/domain/teams/types";
import type { Shelter } from "@/domain/shelters/types";
import type { EvacuationOperation } from "@/domain/evacuations/types";
import type { SosRequest } from "@/domain/sos/types";
import type {
  DistributionShipment,
  InventoryItem,
  ReliefRequest,
  StockReservation,
  Warehouse,
} from "@/domain/relief/types";
import type { PlaybookExecution } from "@/domain/playbooks/types";
import type {
  DamageAssessment,
  RecoveryProject,
} from "@/domain/recovery/types";
import type {
  AnalyticsPeriod,
  DistributionRow,
  EvacuationAnalytics,
  IncidentAnalytics,
  IncidentTiming,
  OperationalException,
  OperationalReport,
  OperationalReportType,
  OperationalSummary,
  RecoveryAnalytics,
  ReliefAnalytics,
  ShelterAnalytics,
  SosAnalytics,
  TaskAnalytics,
  TeamAnalytics,
} from "@/domain/analytics/types";

export interface AnalyticsData {
  metadata: { asOf: string; source: string };
  incidents: Incident[];
  events: IncidentEvent[];
  tasks: IncidentTask[];
  taskUpdates: TaskUpdate[];
  teams: RescueTeam[];
  shelters: Shelter[];
  evacuationOperations: EvacuationOperation[];
  sosRequests: SosRequest[];
  warehouses: Warehouse[];
  inventory: InventoryItem[];
  reliefRequests: ReliefRequest[];
  reservations: StockReservation[];
  shipments: DistributionShipment[];
  playbookExecutions: PlaybookExecution[];
  damageAssessments: DamageAssessment[];
  recoveryProjects: RecoveryProject[];
}
export interface ReportActor {
  id: string;
  displayName: string;
}
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export function parseOperationalDate(
  value: string,
  anchor?: string,
  endOfDay = false,
) {
  const text = value.trim();
  let match = text.match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (match) {
    const [, d, m, y, hh, mm, ss] = match;
    return new Date(
      +y,
      +m - 1,
      +d,
      hh ? +hh : endOfDay ? 23 : 0,
      mm ? +mm : endOfDay ? 59 : 0,
      ss ? +ss : endOfDay ? 59 : 0,
    ).getTime();
  }
  match = text.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (match && anchor) {
    const day = anchor.match(/^(\d{2}\/\d{2}\/\d{4})/);
    if (day) return parseOperationalDate(`${day[1]} ${text}`);
  }
  return Number.NaN;
}
const reference = (data: AnalyticsData, filter: AnalyticsPeriod = {}) =>
  parseOperationalDate(filter.referenceTime ?? data.metadata.asOf);
const minutes = (from: number, to: number) =>
  Number.isFinite(from) && Number.isFinite(to) && to >= from
    ? Math.round((to - from) / 60000)
    : null;
const average = (values: Array<number | null>) => {
  const valid = values.filter(
    (item): item is number => item !== null && Number.isFinite(item),
  );
  return valid.length
    ? Math.round(valid.reduce((sum, item) => sum + item, 0) / valid.length)
    : null;
};
const distribution = (values: string[]): DistributionRow[] => {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts]
    .map(([label, value]) => ({
      label,
      value,
      percentage: values.length ? Math.round((value / values.length) * 100) : 0,
    }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "vi"));
};
const inPeriod = (date: string, filter: AnalyticsPeriod = {}) => {
  const value = parseOperationalDate(date);
  // Dấu thời gian không hợp lệ không được âm thầm đưa vào kỳ báo cáo.
  if (!Number.isFinite(value)) return false;
  const from = filter.from
    ? parseOperationalDate(filter.from)
    : Number.NEGATIVE_INFINITY;
  const to = filter.to
    ? parseOperationalDate(filter.to, undefined, true)
    : Number.POSITIVE_INFINITY;
  return value >= from && value <= to;
};
const inScope = (value: string, scope?: string) =>
  !scope ||
  scope === "Toàn bộ Hà Nội" ||
  normalize(value).includes(normalize(scope.replace(", Hà Nội", "")));
function filteredIncidents(data: AnalyticsData, filter: AnalyticsPeriod = {}) {
  return data.incidents.filter(
    (item) =>
      (!filter.incidentId || item.id === filter.incidentId) &&
      inScope(
        `${item.location.name} ${item.affectedArea}`,
        filter.geographicScope,
      ) &&
      inPeriod(item.createdAt, filter),
  );
}
const incidentIds = (data: AnalyticsData, filter: AnalyticsPeriod = {}) =>
  new Set(filteredIncidents(data, filter).map((item) => item.id));
const isOpenTask = (task: IncidentTask) =>
  !["Hoàn thành", "Đã hủy"].includes(task.status);
const isOpenIncident = (incident: Incident) =>
  !["Đã đóng", "Đã kiểm soát"].includes(incident.status);
const isOpenSos = (status: string) =>
  !["Đã xử lý", "Đã đóng", "Từ chối", "Hủy"].includes(status);
const isOpenRelief = (status: string) =>
  !["Đã giao", "Đã xác nhận", "Đã đóng", "Từ chối", "Hủy"].includes(status);
const isActiveProject = (status: string) =>
  ["Đã phê duyệt", "Đang thực hiện", "Tạm dừng"].includes(status);
const eventEpoch = (event: IncidentEvent, incident: Incident) =>
  parseOperationalDate(event.timestamp, incident.createdAt);
function incidentEventTime(
  events: IncidentEvent[],
  incident: Incident,
  types: string[],
) {
  const values = events
    .filter(
      (event) => event.incidentId === incident.id && types.includes(event.type),
    )
    .map((event) => eventEpoch(event, incident))
    .filter(Number.isFinite);
  return values.length ? Math.min(...values) : Number.NaN;
}
function getIncidentTimings(
  data: AnalyticsData,
  filter: AnalyticsPeriod = {},
): IncidentTiming[] {
  const now = reference(data, filter);
  return filteredIncidents(data, filter)
    .map((incident) => {
      const created = parseOperationalDate(incident.createdAt);
      const acknowledged = incidentEventTime(data.events, incident, [
        "severity",
        "acknowledged",
        "assessment",
      ]);
      const dispatched = incidentEventTime(data.events, incident, [
        "assignment",
        "dispatch",
      ]);
      const resolved = incident.closedAt
        ? parseOperationalDate(incident.closedAt)
        : incident.status === "Đã kiểm soát"
          ? parseOperationalDate(incident.updatedAt)
          : Number.NaN;
      return {
        id: incident.id,
        code: incident.code,
        title: incident.title,
        area: incident.location.name,
        responseMinutes: minutes(
          created,
          Number.isFinite(resolved) ? resolved : now,
        ),
        acknowledgementMinutes: minutes(created, acknowledged),
        dispatchMinutes: minutes(
          Number.isFinite(acknowledged) ? acknowledged : created,
          dispatched,
        ),
        resolutionMinutes: minutes(
          Number.isFinite(dispatched) ? dispatched : created,
          resolved,
        ),
        basis: "Dẫn xuất" as const,
        overdue: isOpenIncident(incident) && (minutes(created, now) ?? 0) > 120,
      };
    })
    .sort(
      (a, b) =>
        Number(b.overdue) - Number(a.overdue) ||
        (b.responseMinutes ?? 0) - (a.responseMinutes ?? 0),
    );
}

export function getIncidentAnalytics(
  data: AnalyticsData,
  filter: AnalyticsPeriod = {},
): IncidentAnalytics {
  const incidents = filteredIncidents(data, filter);
  const ids = new Set(incidents.map((item) => item.id));
  const evacuations = data.evacuationOperations.filter((item) =>
    ids.has(item.incidentId),
  );
  const timings = getIncidentTimings(data, filter);
  const affectedPopulation = incidents.reduce(
    (sum, item) => sum + item.affectedPopulation,
    0,
  );
  const evacuatedPopulation = evacuations.reduce(
    (sum, item) => sum + item.evacuatedPopulation,
    0,
  );
  return {
    bySeverity: distribution(incidents.map((item) => item.severity)),
    byStatus: distribution(incidents.map((item) => item.status)),
    byArea: distribution(
      incidents.map(
        (item) =>
          item.location.name.split(",").slice(-3, -1).join(",").trim() ||
          item.location.name,
      ),
    ),
    timings,
    averageAcknowledgementMinutes: average(
      timings.map((item) => item.acknowledgementMinutes),
    ),
    averageDispatchMinutes: average(
      timings.map((item) => item.dispatchMinutes),
    ),
    averageResolutionMinutes: average(
      timings.map((item) => item.resolutionMinutes),
    ),
    overdueCount: timings.filter((item) => item.overdue).length,
    affectedPopulation,
    evacuatedPopulation,
    remainingPopulation: Math.max(0, affectedPopulation - evacuatedPopulation),
  };
}

export function getTaskAnalytics(
  data: AnalyticsData,
  filter: AnalyticsPeriod = {},
): TaskAnalytics {
  const ids = incidentIds(data, filter);
  const now = reference(data, filter);
  const tasks = data.tasks.filter(
    (item) => ids.has(item.incidentId) && inPeriod(item.createdAt, filter),
  );
  const completed = tasks.filter((item) => item.status === "Hoàn thành");
  const overdue = tasks.filter(
    (item) => isOpenTask(item) && parseOperationalDate(item.dueAt) < now,
  );
  const incidentMap = new Map(data.incidents.map((item) => [item.id, item]));
  const byIncident = [...new Set(tasks.map((item) => item.incidentId))]
    .map((id) => {
      const rows = tasks.filter((item) => item.incidentId === id);
      const incident = incidentMap.get(id);
      return {
        incidentId: id,
        code: incident?.code ?? id,
        title: incident?.title ?? "Không xác định",
        total: rows.length,
        open: rows.filter(isOpenTask).length,
        overdue: rows.filter((item) => overdue.includes(item)).length,
      };
    })
    .sort((a, b) => b.open - a.open);
  const completionTimes = completed.map((item) =>
    minutes(
      parseOperationalDate(item.createdAt),
      parseOperationalDate(item.completedAt ?? ""),
    ),
  );
  const startDelays = tasks.map((task) => {
    const update = data.taskUpdates
      .filter((item) => item.taskId === task.id)
      .sort(
        (a, b) =>
          parseOperationalDate(a.timestamp, task.createdAt) -
          parseOperationalDate(b.timestamp, task.createdAt),
      )[0];
    return update
      ? minutes(
          parseOperationalDate(task.createdAt),
          parseOperationalDate(update.timestamp, task.createdAt),
        )
      : null;
  });
  return {
    byStatus: distribution(tasks.map((item) => item.status)),
    byPriority: distribution(tasks.map((item) => item.priority)),
    overdueCount: overdue.length,
    completionRate: tasks.length
      ? Math.round((completed.length / tasks.length) * 100)
      : 0,
    averageCompletionMinutes: average(completionTimes),
    unassignedCount: tasks.filter((item) => isOpenTask(item) && !item.teamId)
      .length,
    progressBands: distribution(
      tasks.map((item) =>
        item.progress === 100
          ? "100%"
          : item.progress >= 75
            ? "75–99%"
            : item.progress >= 50
              ? "50–74%"
              : item.progress > 0
                ? "1–49%"
                : "0%",
      ),
    ),
    byIncident,
    dispatchToStartMinutes: average(startDelays),
  };
}

export function getTeamAnalytics(
  data: AnalyticsData,
  filter: AnalyticsPeriod = {},
): TeamAnalytics {
  const ids = incidentIds(data, filter);
  const tasks = data.tasks.filter(
    (item) => ids.has(item.incidentId) && isOpenTask(item),
  );
  const activeEvacs = data.evacuationOperations.filter(
    (item) =>
      ids.has(item.incidentId) &&
      ["Đang triển khai", "Tạm dừng"].includes(item.status),
  );
  const reliefTeamIds = new Set(
    data.shipments
      .filter((item) =>
        ["Chuẩn bị", "Đã xuất kho", "Đang vận chuyển", "Có sự cố"].includes(
          item.status,
        ),
      )
      .map((item) => item.assignedTeamId)
      .filter(Boolean),
  );
  const deployed = data.teams.filter((team) =>
    Boolean(
      team.currentTask ||
      team.currentIncident ||
      team.currentEvacuationOperation ||
      team.currentReliefShipment ||
      reliefTeamIds.has(team.id),
    ),
  );
  const available = data.teams.filter(
    (team) =>
      team.availability === "Có thể điều phối" || team.status === "Sẵn sàng",
  );
  const unavailable = data.teams.filter(
    (team) =>
      ["Không sẵn sàng"].includes(team.availability) ||
      ["Mất liên lạc", "Không khả dụng"].includes(team.status),
  );
  const capabilities = [
    ...new Set(data.teams.flatMap((team) => team.capabilities)),
  ]
    .map((capability) => ({
      capability,
      available: data.teams.filter(
        (team) =>
          team.capabilities.includes(capability) &&
          (team.availability === "Có thể điều phối" ||
            team.status === "Sẵn sàng"),
      ).length,
      deployed: data.teams.filter(
        (team) =>
          team.capabilities.includes(capability) && deployed.includes(team),
      ).length,
      demand:
        tasks.filter((task) =>
          normalize(`${task.type} ${task.description}`).includes(
            normalize(capability.split(" ")[0]),
          ),
        ).length +
        activeEvacs.filter(
          (operation) =>
            capability.includes("Sơ tán") && operation.assignedTeamId === null,
        ).length,
    }))
    .filter((item) => item.available + item.deployed + item.demand > 0)
    .sort(
      (a, b) =>
        b.demand - a.demand || a.capability.localeCompare(b.capability, "vi"),
    );
  return {
    total: data.teams.length,
    available: available.length,
    deployed: deployed.length,
    unavailable: unavailable.length,
    utilizationRate: data.teams.length
      ? Math.round((deployed.length / data.teams.length) * 100)
      : 0,
    workload: data.teams
      .map((team) => ({
        teamId: team.id,
        code: team.code,
        name: team.name,
        activeTasks: tasks.filter((task) => task.teamId === team.id).length,
        incidentId: team.currentIncident,
        assignment:
          team.currentTask ??
          team.currentEvacuationOperation ??
          team.currentReliefShipment ??
          "Chưa phân công",
      }))
      .sort((a, b) => b.activeTasks - a.activeTasks),
    capability: capabilities,
  };
}

export function getShelterAnalytics(
  data: AnalyticsData,
  filter: AnalyticsPeriod = {},
): ShelterAnalytics {
  const shelters = data.shelters.filter(
    (item) =>
      inScope(item.administrativeArea, filter.geographicScope) &&
      (!filter.incidentId ||
        item.linkedIncidentIds.includes(filter.incidentId)),
  );
  const occupancy = shelters.reduce(
    (sum, item) => sum + item.currentOccupancy,
    0,
  );
  const capacity = shelters.reduce((sum, item) => sum + item.capacity, 0);
  return {
    total: shelters.length,
    occupancy,
    capacity,
    utilizationRate: capacity ? Math.round((occupancy / capacity) * 100) : 0,
    overloaded: shelters.filter(
      (item) =>
        item.currentOccupancy > item.capacity || item.status === "Quá tải",
    ).length,
    rows: shelters
      .map((item) => ({
        id: item.id,
        code: item.code,
        name: item.name,
        area: item.administrativeArea,
        occupancy: item.currentOccupancy,
        capacity: item.capacity,
        reserved: item.reservedCapacity,
        utilization: item.capacity
          ? Math.round((item.currentOccupancy / item.capacity) * 100)
          : 0,
        status: item.status,
      }))
      .sort((a, b) => b.utilization - a.utilization),
  };
}

export function getEvacuationAnalytics(
  data: AnalyticsData,
  filter: AnalyticsPeriod = {},
): EvacuationAnalytics {
  const ids = incidentIds(data, filter);
  const rows = data.evacuationOperations.filter((item) =>
    ids.has(item.incidentId),
  );
  const evacuated = rows.reduce(
    (sum, item) => sum + item.evacuatedPopulation,
    0,
  );
  const population = rows.reduce(
    (sum, item) => sum + item.estimatedPopulation,
    0,
  );
  const completed = rows.filter((item) => item.status === "Hoàn thành").length;
  return {
    total: rows.length,
    active: rows.filter((item) =>
      ["Đang triển khai", "Tạm dừng"].includes(item.status),
    ).length,
    evacuated,
    remaining: Math.max(0, population - evacuated),
    completionRate: rows.length
      ? Math.round((completed / rows.length) * 100)
      : 0,
    averageProgress: rows.length
      ? Math.round(
          rows.reduce((sum, item) => sum + item.progress, 0) / rows.length,
        )
      : 0,
    blockedRoutes: rows.filter((item) =>
      ["Bị chặn", "Hạn chế"].includes(item.route.status),
    ).length,
    rows: rows
      .map((item) => ({
        id: item.id,
        code: item.code,
        incidentId: item.incidentId,
        shelterId: item.destinationShelterId,
        status: item.status,
        progress: item.progress,
        evacuated: item.evacuatedPopulation,
        remaining: Math.max(
          0,
          item.estimatedPopulation - item.evacuatedPopulation,
        ),
        routeStatus: item.route.status,
      }))
      .sort(
        (a, b) =>
          Number(b.routeStatus === "Bị chặn") -
            Number(a.routeStatus === "Bị chặn") || a.progress - b.progress,
      ),
  };
}

export function getSosAnalytics(
  data: AnalyticsData,
  filter: AnalyticsPeriod = {},
): SosAnalytics {
  const now = reference(data, filter);
  const ids = incidentIds(data, filter);
  const rows = data.sosRequests.filter(
    (item) =>
      (!filter.incidentId || item.linkedIncidentId === filter.incidentId) &&
      inScope(item.location.administrativeArea, filter.geographicScope) &&
      inPeriod(item.receivedAt, filter),
  );
  const waiting = rows.map(
    (item) =>
      minutes(
        parseOperationalDate(item.receivedAt),
        parseOperationalDate(item.closedAt ?? item.lastUpdatedAt),
      ) ?? 0,
  );
  const resolved = rows
    .filter((item) => item.closedAt)
    .map((item) =>
      minutes(
        parseOperationalDate(item.receivedAt),
        parseOperationalDate(item.closedAt ?? ""),
      ),
    );
  const taskMap = new Map(data.tasks.map((item) => [item.id, item]));
  return {
    byPriority: distribution(rows.map((item) => item.priority)),
    byStatus: distribution(rows.map((item) => item.status)),
    byVerification: distribution(rows.map((item) => item.verificationStatus)),
    byArea: distribution(rows.map((item) => item.location.administrativeArea)),
    averageWaitingMinutes: average(waiting),
    averageResolutionMinutes: average(resolved),
    unassigned: rows.filter(
      (item) => isOpenSos(item.status) && !item.assignedTeamId,
    ).length,
    vulnerableCases: rows.filter(
      (item) => item.childrenCount + item.elderlyCount + item.disabledCount > 0,
    ).length,
    incidentConversionRate: rows.length
      ? Math.round(
          (rows.filter(
            (item) => item.linkedIncidentId && ids.has(item.linkedIncidentId),
          ).length /
            rows.length) *
            100,
        )
      : 0,
    rescueChainCompleted: rows.filter(
      (item) =>
        item.linkedIncidentId &&
        item.linkedTaskId &&
        taskMap.get(item.linkedTaskId)?.status === "Hoàn thành",
    ).length,
    rows: rows
      .map((item, index) => {
        let bottleneck: string | null = null;
        if (isOpenSos(item.status) && !item.assignedTeamId)
          bottleneck = "Chưa phân công đội";
        else if (
          item.verificationStatus !== "Đã xác minh" &&
          (minutes(parseOperationalDate(item.receivedAt), now) ?? 0) > 30
        )
          bottleneck = "Chờ xác minh quá 30 phút";
        else if (
          item.linkedTaskId &&
          taskMap.get(item.linkedTaskId)?.status === "Chờ giao"
        )
          bottleneck = "Nhiệm vụ chưa được giao";
        return {
          id: item.id,
          code: item.code,
          priority: item.priority,
          status: item.status,
          area: item.location.administrativeArea,
          waitingMinutes: waiting[index],
          linkedIncidentId: item.linkedIncidentId,
          linkedTaskId: item.linkedTaskId,
          assignedTeamId: item.assignedTeamId,
          bottleneck,
        };
      })
      .sort(
        (a, b) =>
          Number(Boolean(b.bottleneck)) - Number(Boolean(a.bottleneck)) ||
          b.waitingMinutes - a.waitingMinutes,
      ),
  };
}

function shortageForRequest(
  request: ReliefRequest,
  reservations: StockReservation[],
) {
  return request.items.reduce((total, item) => {
    const allocated = reservations
      .filter(
        (res) =>
          res.reliefRequestId === request.id && res.status !== "Đã giải phóng",
      )
      .flatMap((res) => res.items)
      .filter((line) => line.itemCode === item.itemCode)
      .reduce((sum, line) => sum + line.quantity, 0);
    return total + Math.max(0, item.quantityApproved - allocated);
  }, 0);
}
export function getReliefAnalytics(
  data: AnalyticsData,
  filter: AnalyticsPeriod = {},
): ReliefAnalytics {
  const ids = incidentIds(data, filter);
  const now = reference(data, filter);
  const requests = data.reliefRequests.filter(
    (item) =>
      (!filter.incidentId || item.incidentId === filter.incidentId) &&
      (!item.incidentId || ids.has(item.incidentId)) &&
      inScope(item.destination, filter.geographicScope) &&
      inPeriod(item.createdAt, filter),
  );
  const rows = requests.map((item) => ({
    id: item.id,
    code: item.code,
    status: item.status,
    priority: item.priority,
    shortage: shortageForRequest(item, data.reservations),
    overdue:
      isOpenRelief(item.status) && parseOperationalDate(item.requiredBy) < now,
  }));
  const inventory = data.inventory.filter((item) =>
    data.warehouses.some(
      (warehouse) =>
        warehouse.id === item.warehouseId &&
        inScope(warehouse.administrativeArea, filter.geographicScope),
    ),
  );
  const availableStock = inventory.reduce(
    (sum, item) =>
      sum + Math.max(0, item.quantityOnHand - item.quantityReserved),
    0,
  );
  const reservedStock = inventory.reduce(
    (sum, item) => sum + item.quantityReserved,
    0,
  );
  const relevantShipments = data.shipments.filter((item) =>
    requests.some((request) => request.id === item.reliefRequestId),
  );
  const delivered = relevantShipments.filter((item) =>
    ["Đã giao", "Hoàn tất"].includes(item.status),
  ).length;
  return {
    byStatus: distribution(requests.map((item) => item.status)),
    byPriority: distribution(requests.map((item) => item.priority)),
    pendingApprovals: requests.filter((item) =>
      ["Đã gửi", "Đang thẩm định"].includes(item.status),
    ).length,
    shortStockRequests: rows.filter((item) => item.shortage > 0).length,
    overdueDeliveries: rows.filter((item) => item.overdue).length,
    warehouseAvailability: data.warehouses.filter(
      (item) =>
        item.status === "Hoạt động" &&
        inScope(item.administrativeArea, filter.geographicScope),
    ).length,
    reservedStock,
    availableStock,
    distributionProgress: relevantShipments.length
      ? Math.round((delivered / relevantShipments.length) * 100)
      : 0,
    failedShipments: relevantShipments.filter(
      (item) => item.status === "Có sự cố",
    ).length,
    lowStockItems: inventory.filter(
      (item) =>
        item.quantityOnHand - item.quantityReserved <= item.reorderLevel,
    ).length,
    requestRows: rows.sort(
      (a, b) =>
        Number(b.overdue) - Number(a.overdue) || b.shortage - a.shortage,
    ),
    warehouseRows: data.warehouses
      .filter((item) =>
        inScope(item.administrativeArea, filter.geographicScope),
      )
      .map((item) => ({
        id: item.id,
        code: item.code,
        name: item.name,
        status: item.status,
        utilization: item.currentUtilization,
        lowStock: inventory.filter(
          (stock) =>
            stock.warehouseId === item.id &&
            stock.quantityOnHand - stock.quantityReserved <= stock.reorderLevel,
        ).length,
      }))
      .sort((a, b) => b.lowStock - a.lowStock || b.utilization - a.utilization),
  };
}

export function getRecoveryAnalytics(
  data: AnalyticsData,
  filter: AnalyticsPeriod = {},
): RecoveryAnalytics {
  const ids = incidentIds(data, filter);
  const now = reference(data, filter);
  const assessments = data.damageAssessments.filter(
    (item) =>
      ids.has(item.incidentId) &&
      inScope(item.geographicScope, filter.geographicScope) &&
      inPeriod(item.createdAt, filter),
  );
  const projects = data.recoveryProjects.filter(
    (item) =>
      ids.has(item.incidentId) &&
      inScope(item.geographicScope, filter.geographicScope) &&
      inPeriod(item.createdAt, filter),
  );
  const damageByCategory = [
    ...new Set(
      assessments.flatMap((item) => item.items.map((row) => row.category)),
    ),
  ]
    .map((category) => ({
      category,
      value: assessments
        .flatMap((item) => item.items)
        .filter((item) => item.category === category)
        .reduce((sum, item) => sum + item.estimatedCost, 0),
    }))
    .sort((a, b) => b.value - a.value);
  const projectRows = projects.map((project) => {
    const delayedMilestones = project.milestones.filter(
      (item) =>
        !["Hoàn thành", "Bỏ qua"].includes(item.status) &&
        parseOperationalDate(item.dueDate, undefined, true) < now,
    ).length;
    return {
      id: project.id,
      code: project.code,
      name: project.name,
      status: project.status,
      progress: project.progress,
      budgetUtilization: project.approvedBudget
        ? Math.round((project.spentBudget / project.approvedBudget) * 100)
        : 0,
      delayedMilestones,
    };
  });
  const totalBudget = projects.reduce(
    (sum, item) => sum + item.approvedBudget,
    0,
  );
  const spent = projects.reduce((sum, item) => sum + item.spentBudget, 0);
  return {
    assessmentByStatus: distribution(assessments.map((item) => item.status)),
    damageByCategory,
    estimatedDamage: assessments.reduce(
      (sum, item) => sum + item.estimatedLoss,
      0,
    ),
    verifiedDamage: assessments
      .filter((item) => item.status === "Đã xác minh")
      .reduce((sum, item) => sum + item.estimatedLoss, 0),
    unverifiedDamage: assessments
      .filter((item) => item.status !== "Đã xác minh")
      .reduce((sum, item) => sum + item.estimatedLoss, 0),
    projectByStatus: distribution(projects.map((item) => item.status)),
    averageProjectProgress: projects.length
      ? Math.round(
          projects.reduce((sum, item) => sum + item.progress, 0) /
            projects.length,
        )
      : 0,
    budgetUtilization: totalBudget
      ? Math.round((spent / totalBudget) * 100)
      : 0,
    delayedMilestones: projectRows.reduce(
      (sum, item) => sum + item.delayedMilestones,
      0,
    ),
    projectsRequiringAttention: projectRows.filter(
      (item) =>
        item.delayedMilestones > 0 ||
        item.budgetUtilization >= 85 ||
        item.status === "Tạm dừng",
    ).length,
    projectRows: projectRows.sort(
      (a, b) =>
        b.delayedMilestones - a.delayedMilestones ||
        b.budgetUtilization - a.budgetUtilization,
    ),
  };
}

export function getOperationalExceptions(
  data: AnalyticsData,
  filter: AnalyticsPeriod = {},
): OperationalException[] {
  const incidents = getIncidentAnalytics(data, filter);
  const tasks = getTaskAnalytics(data, filter);
  const shelters = getShelterAnalytics(data, filter);
  const sos = getSosAnalytics(data, filter);
  const relief = getReliefAnalytics(data, filter);
  const recovery = getRecoveryAnalytics(data, filter);
  const result: OperationalException[] = [];
  incidents.timings
    .filter((item) => item.overdue)
    .forEach((item) =>
      result.push({
        severity: "Cao",
        module: "Sự cố",
        entityId: item.id,
        entityCode: item.code,
        title: item.title,
        reason: `Đang xử lý ${item.responseMinutes} phút, vượt ngưỡng 120 phút`,
        path: `/incidents/${item.id}`,
      }),
    );
  data.tasks
    .filter(
      (task) =>
        tasks.byIncident.some((row) => row.incidentId === task.incidentId) &&
        isOpenTask(task) &&
        parseOperationalDate(task.dueAt) < reference(data, filter),
    )
    .forEach((item) =>
      result.push({
        severity: item.priority === "Khẩn cấp" ? "Khẩn cấp" : "Cao",
        module: "Nhiệm vụ",
        entityId: item.id,
        entityCode: item.id,
        title: item.title,
        reason: `Quá hạn lúc ${item.dueAt}`,
        path: `/tasks/${item.id}`,
      }),
    );
  shelters.rows
    .filter((item) => item.utilization > 100)
    .forEach((item) =>
      result.push({
        severity: "Khẩn cấp",
        module: "Điểm sơ tán",
        entityId: item.id,
        entityCode: item.code,
        title: item.name,
        reason: `Vượt sức chứa ${item.occupancy - item.capacity} người`,
        path: `/shelters/${item.id}`,
      }),
    );
  sos.rows
    .filter((item) => item.bottleneck)
    .forEach((item) =>
      result.push({
        severity: item.priority.startsWith("P1") ? "Khẩn cấp" : "Cao",
        module: "SOS",
        entityId: item.id,
        entityCode: item.code,
        title: item.area,
        reason: item.bottleneck ?? "",
        path: `/sos/${item.id}`,
      }),
    );
  relief.requestRows
    .filter((item) => item.shortage > 0 || item.overdue)
    .forEach((item) =>
      result.push({
        severity: item.priority.startsWith("P1") ? "Khẩn cấp" : "Cao",
        module: "Cứu trợ",
        entityId: item.id,
        entityCode: item.code,
        title: `Yêu cầu ${item.code}`,
        reason: [
          item.shortage ? `Thiếu ${item.shortage} đơn vị` : null,
          item.overdue ? "Quá hạn giao" : null,
        ]
          .filter(Boolean)
          .join(" · "),
        path: `/relief/requests/${item.id}`,
      }),
    );
  recovery.projectRows
    .filter((item) => item.delayedMilestones || item.budgetUtilization >= 85)
    .forEach((item) =>
      result.push({
        severity: item.delayedMilestones ? "Cao" : "Trung bình",
        module: "Phục hồi",
        entityId: item.id,
        entityCode: item.code,
        title: item.name,
        reason: item.delayedMilestones
          ? `${item.delayedMilestones} mốc quá hạn`
          : `Đã sử dụng ${item.budgetUtilization}% ngân sách`,
        path: `/recovery/projects/${item.id}`,
      }),
    );
  return result
    .sort(
      (a, b) =>
        ["Khẩn cấp", "Cao", "Trung bình"].indexOf(a.severity) -
        ["Khẩn cấp", "Cao", "Trung bình"].indexOf(b.severity),
    )
    .slice(0, 20);
}

export function getOperationalSummary(
  data: AnalyticsData,
  filter: AnalyticsPeriod = {},
): OperationalSummary {
  const ids = incidentIds(data, filter);
  const now = reference(data, filter);
  const tasks = data.tasks.filter((item) => ids.has(item.incidentId));
  const sos = data.sosRequests.filter(
    (item) =>
      (!item.linkedIncidentId || ids.has(item.linkedIncidentId)) &&
      inScope(item.location.administrativeArea, filter.geographicScope),
  );
  const shelters = getShelterAnalytics(data, filter);
  const relief = getReliefAnalytics(data, filter);
  return {
    metrics: [
      {
        label: "Sự cố đang hoạt động",
        value: filteredIncidents(data, filter).filter(isOpenIncident).length,
        basis: "Ghi nhận",
        description: "Chưa kiểm soát hoặc đóng",
      },
      {
        label: "Sự cố khẩn cấp",
        value: filteredIncidents(data, filter).filter(
          (item) => item.severity === "Khẩn cấp" && isOpenIncident(item),
        ).length,
        basis: "Ghi nhận",
        description: "Mức Khẩn cấp đang mở",
      },
      {
        label: "Nhiệm vụ mở / quá hạn",
        value: tasks.filter(isOpenTask).length,
        basis: "Dẫn xuất",
        description: `${tasks.filter((item) => isOpenTask(item) && parseOperationalDate(item.dueAt) < now).length} quá hạn`,
      },
      {
        label: "SOS đang hoạt động",
        value: sos.filter((item) => isOpenSos(item.status)).length,
        basis: "Ghi nhận",
        description: `${sos.filter((item) => isOpenSos(item.status) && !item.assignedTeamId).length} chưa phân công`,
      },
      {
        label: "Đội sẵn sàng / triển khai",
        value: getTeamAnalytics(data, filter).available,
        basis: "Dẫn xuất",
        description: `${getTeamAnalytics(data, filter).deployed} đội đang triển khai`,
      },
      {
        label: "Sức chứa điểm sơ tán",
        value: shelters.utilizationRate,
        basis: "Dẫn xuất",
        description: `${shelters.overloaded} điểm quá tải`,
      },
      {
        label: "Yêu cầu cứu trợ áp lực",
        value: relief.shortStockRequests + relief.overdueDeliveries,
        basis: "Dẫn xuất",
        description: `${relief.shortStockRequests} thiếu hàng · ${relief.overdueDeliveries} quá hạn`,
      },
      {
        label: "Kế hoạch ứng phó đang thực hiện",
        value: data.playbookExecutions.filter(
          (item) =>
            ids.has(item.incidentId) && item.status === "Đang hoạt động",
        ).length,
        basis: "Ghi nhận",
        description: "Đợt thực hiện đang hoạt động",
      },
      {
        label: "Dự án phục hồi",
        value: data.recoveryProjects.filter(
          (item) => ids.has(item.incidentId) && isActiveProject(item.status),
        ).length,
        basis: "Ghi nhận",
        description: "Đã duyệt, đang làm hoặc tạm dừng",
      },
    ],
    exceptions: getOperationalExceptions(data, filter),
  };
}

export function collectInvalidReportTimestamps(data: AnalyticsData) {
  const candidates: Array<{ entityId: string; field: string; value: string }> = [
    ...data.incidents.map((item) => ({ entityId: item.id, field: "Thời điểm tạo sự cố", value: item.createdAt })),
    ...data.tasks.map((item) => ({ entityId: item.id, field: "Thời điểm tạo nhiệm vụ", value: item.createdAt })),
    ...data.sosRequests.map((item) => ({ entityId: item.id, field: "Thời điểm tiếp nhận SOS", value: item.receivedAt })),
    ...data.evacuationOperations.map((item) => ({ entityId: item.id, field: "Thời điểm cập nhật sơ tán", value: item.updatedAt })),
    ...data.reliefRequests.map((item) => ({ entityId: item.id, field: "Thời điểm tạo yêu cầu cứu trợ", value: item.createdAt })),
    ...data.events.map((item) => ({ entityId: item.incidentId, field: "Dấu thời gian diễn biến sự cố", value: item.timestamp })),
  ];
  return candidates.filter((item) => {
    const anchor = item.field === "Dấu thời gian diễn biến sự cố"
      ? data.incidents.find((incident) => incident.id === item.entityId)?.createdAt
      : undefined;
    return !Number.isFinite(parseOperationalDate(item.value, anchor));
  });
}

export function buildOperationalReport(
  data: AnalyticsData,
  type: OperationalReportType,
  filter: AnalyticsPeriod,
  actor: ReportActor,
): OperationalReport {
  const incidents = filteredIncidents(data, filter);
  const incident = getIncidentAnalytics(data, filter);
  const task = getTaskAnalytics(data, filter);
  const team = getTeamAnalytics(data, filter);
  const shelter = getShelterAnalytics(data, filter);
  const evacuation = getEvacuationAnalytics(data, filter);
  const sos = getSosAnalytics(data, filter);
  const relief = getReliefAnalytics(data, filter);
  const recovery = getRecoveryAnalytics(data, filter);
  const exceptions = getOperationalExceptions(data, filter);
  const completedTasks = data.tasks.filter(
    (item) =>
      item.status === "Hoàn thành" &&
      incidentIds(data, filter).has(item.incidentId),
  );
  const outstandingTasks = data.tasks.filter(
    (item) =>
      isOpenTask(item) && incidentIds(data, filter).has(item.incidentId),
  );
  const asOf = filter.referenceTime ?? data.metadata.asOf;
  const period =
    filter.from || filter.to
      ? `${filter.from ?? "đầu kỳ"} – ${filter.to ?? asOf}`
      : `Đến ${asOf}`;
  const invalidTimestamps = collectInvalidReportTimestamps(data);
  return {
    type,
    title: `${type} — VNDMS`,
    period,
    scope: filter.geographicScope ?? "Toàn bộ Hà Nội",
    incidentScope: filter.incidentId ?? "Tất cả sự cố trong phạm vi",
    situationSummary: `${incidents.length} sự cố trong phạm vi báo cáo, ${incident.affectedPopulation.toLocaleString("vi-VN")} người bị ảnh hưởng. ${task.overdueCount} nhiệm vụ quá hạn và ${exceptions.length} ngoại lệ cần theo dõi.`,
    findings: [
      `${incident.overdueCount} sự cố vượt ngưỡng xử lý 120 phút.`,
      `${sos.unassigned} SOS đang mở chưa được phân công.`,
      `${shelter.overloaded} điểm sơ tán vượt sức chứa.`,
      `${relief.shortStockRequests} yêu cầu cứu trợ còn thiếu hàng.`,
      `${recovery.projectsRequiringAttention} dự án phục hồi cần chú ý.`,
    ],
    responseStatistics: [
      {
        label: "Sự cố trong phạm vi",
        value: String(incidents.length),
        basis: "Ghi nhận",
      },
      {
        label: "Thời gian xác nhận trung bình",
        value:
          incident.averageAcknowledgementMinutes === null
            ? "Chưa đủ dữ liệu"
            : `${incident.averageAcknowledgementMinutes} phút`,
        basis: "Dẫn xuất",
      },
      {
        label: "Tỷ lệ hoàn thành nhiệm vụ",
        value: `${task.completionRate}%`,
        basis: "Dẫn xuất",
      },
      {
        label: "Dân số đã sơ tán",
        value: evacuation.evacuated.toLocaleString("vi-VN"),
        basis: "Ghi nhận",
      },
      {
        label: "Tiến độ sơ tán trung bình",
        value: `${evacuation.averageProgress}%`,
        basis: "Dẫn xuất",
      },
    ],
    resourceUtilization: [
      `${team.deployed}/${team.total} đội đang triển khai (${team.utilizationRate}%).`,
      `${shelter.occupancy.toLocaleString("vi-VN")}/${shelter.capacity.toLocaleString("vi-VN")} chỗ đang sử dụng.`,
      `${relief.availableStock.toLocaleString("vi-VN")} đơn vị tồn khả dụng; ${relief.reservedStock.toLocaleString("vi-VN")} đơn vị đang giữ.`,
    ],
    majorExceptions: exceptions,
    completedActions: completedTasks
      .map((item) => `${item.id} — ${item.title}`)
      .slice(0, 12),
    outstandingActions: outstandingTasks
      .map((item) => `${item.id} — ${item.title} (${item.status})`)
      .slice(0, 12),
    recoveryStatus: [
      `${recovery.verifiedDamage.toLocaleString("vi-VN")} ₫ thiệt hại đã xác minh.`,
      `${recovery.projectRows.length} dự án; tiến độ trung bình ${recovery.averageProjectProgress}%.`,
      `Mức sử dụng ngân sách đã duyệt ${recovery.budgetUtilization}%.`,
    ],
    audit: {
      generatedAt: asOf,
      generatedById: actor.id,
      generatedBy: actor.displayName,
      source: `${data.metadata.source}; lát cắt dữ liệu vận hành đã phân quyền`,
      dataPolicy:
        "Giá trị ghi nhận được tách biệt với chỉ số tính toán; bản ghi có dấu thời gian không hợp lệ bị loại và được công khai trong báo cáo.",
      invalidTimestamps,
    },
  };
}
