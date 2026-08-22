import type {
  AiEvidence,
  AiGroundingRequest,
  AiIntent,
  AiResponse,
  AiStatement,
  AiStatementClass,
} from "../../domain/ai/types";
import { classifyOperationalIntent } from "../../domain/ai/rules";
import { calculateShelterCapacity } from "../../domain/shelters/rules";
import { calculateExecutionProgress } from "../../domain/playbooks/rules";
import { authorize } from "../../lib/security/authorization";
import {
  authorizedOperationalSnapshot,
  availableTeams,
  blockedPlaybookSteps,
  lowStockInventory,
  overdueTasks,
  pressuredShelters,
  reliefShortages,
  urgentUnassignedSos,
} from "./aiQueries";
import { buildDeterministicActions } from "./aiRecommendations";
const text = (value: unknown) =>
  typeof value === "number"
    ? value.toLocaleString("vi-VN")
    : String(value ?? "Chưa có dữ liệu trong hệ thống.");
export function groundOperationalQuestion(
  request: AiGroundingRequest,
): AiResponse {
  const now = request.now ?? new Date();
  const classification = classifyOperationalIntent(
    request.question,
    request.context,
  );
  const access = authorize(request.user, "ai_assistant_use");
  const evidence: AiEvidence[] = [];
  const statements: AiStatement[] = [];
  let sequence = 0;
  const addEvidence = (
    entityType: AiEvidence["entityType"],
    entityId: string,
    field: string,
    value: unknown,
    timestamp: string | undefined,
    valueKind: AiEvidence["valueKind"] = "recorded",
  ) => {
    const item: AiEvidence = {
      id: `EV-${++sequence}`,
      source: "Trạng thái tác nghiệp chuẩn VNDMS",
      entityType,
      entityId,
      field,
      value: text(value),
      timestamp,
      valueKind,
    };
    evidence.push(item);
    return item.id;
  };
  const say = (kind: AiStatementClass, message: string, refs: string[] = []) =>
    statements.push({
      id: `ST-${statements.length + 1}`,
      classification: kind,
      text: message,
      evidenceIds: refs,
    });
  const base = (
    intent: AiIntent,
    conclusion: string,
    actions: AiResponse["actions"] = [],
  ): AiResponse => {
    for (const action of actions) {
      if (
        statements.some(
          (item) =>
            item.classification === "RECOMMENDATION" &&
            item.text.includes(action.targetId),
        )
      )
        continue;
      const ref = addEvidence(
        action.targetType,
        action.targetId,
        "actionBasis",
        action.currentState.join("; "),
        undefined,
        "derived",
      );
      say(
        "RECOMMENDATION",
        `${action.label}. Lý do: ${action.reason} Mức khuyến nghị: trung bình; giới hạn: phải đọc lại trạng thái và xác nhận quyền trước khi thực thi.`,
        [ref],
      );
    }
    const simulationAware =
      request.snapshot.simulation.status !== "Sẵn sàng" ||
      request.snapshot.simulation.tick > 0 ||
      request.snapshot.simulation.appliedEventIds.length > 0;
    if (simulationAware) {
      const ref = addEvidence(
        "Simulation",
        request.snapshot.simulation.scenarioId,
        "status / tick",
        `${request.snapshot.simulation.status} / ${request.snapshot.simulation.tick}`,
        request.snapshot.simulation.simulationTime,
      );
      say(
        "FACT",
        `Dữ liệu hiện tại có trạng thái mô phỏng: ${request.snapshot.simulation.status}, bước ${request.snapshot.simulation.tick}.`,
        [ref],
      );
    }
    return {
      id: `AIR-${now.getTime()}`,
      question: request.question,
      intent,
      conclusion,
      statements,
      evidence,
      actions,
      simulationAware,
      simulationNotice: simulationAware
        ? "Dữ liệu hiện tại có trạng thái mô phỏng. Đây không phải dữ liệu cảm biến thực tế."
        : undefined,
      clarification: classification.clarification,
      generatedAt: now.toISOString(),
    };
  };
  if (!access.allowed) {
    say(
      "UNKNOWN",
      "Bạn không có quyền truy cập dữ liệu tác nghiệp qua Trợ lý AI.",
    );
    return {
      id: `AIR-${now.getTime()}`,
      question: request.question,
      intent: classification.intent,
      conclusion: "Không thể thực hiện truy vấn trong phạm vi quyền hiện tại.",
      statements,
      evidence: [],
      actions: [],
      simulationAware: false,
      clarification: classification.clarification,
      generatedAt: now.toISOString(),
    };
  }
  if (classification.intent === "unknown") {
    say("UNKNOWN", "Chưa đủ thông tin để xác định truy vấn tác nghiệp.");
    return base("unknown", "Cần làm rõ câu hỏi trước khi truy vấn dữ liệu.");
  }
  const data = authorizedOperationalSnapshot(request.snapshot, request.user);
  const entityId = classification.entityId ?? request.context?.entityId;
  if (classification.intent === "alert_overview") {
    const sourceTypeMap: Record<string, AiEvidence["entityType"]> = {
      Incident: "Incident",
      SOS: "SOS",
      Task: "Task",
      Team: "Team",
      Shelter: "Shelter",
      Evacuation: "Evacuation",
      ReliefRequest: "ReliefRequest",
      Inventory: "Inventory",
      Shipment: "Shipment",
      PlaybookExecution: "PlaybookExecution",
      DamageAssessment: "DamageAssessment",
      RecoveryProject: "Recovery",
    };
    const entityFilter = entityId?.toUpperCase();
    const all = (request.alerts ?? []).filter((alert) =>
      entityFilter
        ? alert.key.toUpperCase().includes(entityFilter) ||
          alert.source.code.toUpperCase().includes(entityFilter)
        : true,
    );
    const severityVi = (value: string) =>
      value === "critical"
        ? "Khẩn cấp"
        : value === "high"
          ? "Cao"
          : value === "medium"
            ? "Trung bình"
            : "Thấp";
    if (!all.length)
      say(
        "UNKNOWN",
        entityFilter
          ? `Không có cảnh báo tác nghiệp nào liên quan ${entityFilter} trong phạm vi phân quyền hiện tại.`
          : "Không có cảnh báo tác nghiệp nào đang hiệu lực trong phạm vi phân quyền hiện tại.",
      );
    all.slice(0, 8).forEach((alert) => {
      const refs = [
        addEvidence(
          "OperationalAlert",
          alert.key,
          "severity / status",
          `${severityVi(alert.severity)} / ${alert.status}`,
          alert.detectedAt,
          "derived",
        ),
        addEvidence(
          sourceTypeMap[alert.source.type] ?? "OperationalAlert",
          alert.source.id,
          "reference",
          `${alert.source.label} ${alert.source.code}`,
          alert.detectedAt,
          "recorded",
        ),
      ];
      say(
        "FACT",
        `[${severityVi(alert.severity)}] ${alert.title} Nguồn: ${alert.source.label} ${alert.source.code}; trạng thái ${alert.status}.`,
        refs,
      );
    });
    const pendingAck = all.filter(
      (alert) => alert.requiresAcknowledgement && !alert.acknowledgedAt,
    ).length;
    const critical = all.filter(
      (alert) => alert.severity === "critical",
    ).length;
    return base(
      "alert_overview",
      all.length
        ? `Có ${all.length} cảnh báo đang hiệu lực (${critical} khẩn cấp, ${pendingAck} chờ xác nhận) được suy ra từ canonical state trong phạm vi được phân quyền.`
        : "Không có cảnh báo tác nghiệp nào trong phạm vi được phân quyền.",
      [],
    );
  }
  const factsForIncident = (id?: string) => {
    const values = id
      ? data.incidents.filter((item) => item.id === id || item.code === id)
      : data.incidents
          .filter((item) => item.status !== "Đã đóng")
          .sort(
            (a, b) =>
              ["Khẩn cấp", "Cao", "Trung bình", "Thấp"].indexOf(a.severity) -
              ["Khẩn cấp", "Cao", "Trung bình", "Thấp"].indexOf(b.severity),
          );
    if (!values.length) {
      say("UNKNOWN", "Chưa có dữ liệu trong hệ thống.");
      return;
    }
    values.slice(0, 5).forEach((item) => {
      const refs = [
        addEvidence(
          "Incident",
          item.id,
          "severity",
          item.severity,
          item.updatedAt,
        ),
        addEvidence("Incident", item.id, "status", item.status, item.updatedAt),
        addEvidence(
          "Incident",
          item.id,
          "location.name",
          item.location.name,
          item.updatedAt,
        ),
      ];
      say(
        "FACT",
        `${item.id} — ${item.title}: mức ${item.severity}, trạng thái “${item.status}”, khu vực ${item.location.name}.`,
        refs,
      );
      if (item.progress < 50 && ["Khẩn cấp", "Cao"].includes(item.severity))
        say(
          "INFERENCE",
          `${item.id} cần được theo dõi ưu tiên do mức độ ${item.severity} và tiến độ hiện tại ${item.progress}%.`,
          [
            refs[0],
            addEvidence(
              "Incident",
              item.id,
              "progress",
              item.progress,
              item.updatedAt,
            ),
          ],
        );
    });
  };
  if (
    classification.intent === "current_situation" ||
    classification.intent === "incident_analysis"
  ) {
    factsForIncident(entityId);
    const open = data.incidents.filter(
      (item) => item.status !== "Đã đóng",
    ).length;
    if (open)
      say(
        "FACT",
        `Có ${open} sự cố đang mở trong phạm vi được phân quyền.`,
        data.incidents
          .filter((item) => item.status !== "Đã đóng")
          .map((item) =>
            addEvidence(
              "Incident",
              item.id,
              "status",
              item.status,
              item.updatedAt,
            ),
          )
          .slice(0, 8),
      );
    return base(
      classification.intent,
      open
        ? `Đã tổng hợp ${open} sự cố đang mở từ trạng thái chuẩn.`
        : "Chưa có sự cố đang mở trong phạm vi được phân quyền.",
      buildDeterministicActions(data, entityId, now),
    );
  }
  if (classification.intent === "task_analysis") {
    const values = entityId
      ? data.tasks.filter((item) => item.id === entityId)
      : overdueTasks(data, now);
    if (!values.length)
      say(
        "UNKNOWN",
        entityId
          ? "Chưa có dữ liệu trong hệ thống."
          : "Không ghi nhận nhiệm vụ quá hạn trong phạm vi hiện tại.",
      );
    values.slice(0, 8).forEach((item) => {
      const refs = [
        addEvidence("Task", item.id, "status", item.status, item.updatedAt),
        addEvidence("Task", item.id, "dueAt", item.dueAt, item.updatedAt),
        addEvidence(
          "Task",
          item.id,
          "teamId",
          item.teamId || "Chưa giao",
          item.updatedAt,
        ),
      ];
      say(
        "FACT",
        `${item.id} — ${item.title}: ${item.status}, hạn ${item.dueAt}, đội ${item.teamId || "chưa giao"}.`,
        refs,
      );
    });
    return base(
      classification.intent,
      entityId
        ? `Phân tích nhiệm vụ ${entityId}.`
        : `Có ${values.length} nhiệm vụ quá hạn.`,
      buildDeterministicActions(data, entityId, now),
    );
  }
  if (classification.intent === "team_availability") {
    let values = entityId
      ? data.teams.filter(
          (item) => item.id === entityId || item.code === entityId,
        )
      : availableTeams(data);
    const area = request.question.match(/(?:khu vực|tai|ở)\s+([^?]+)/i)?.[1];
    if (area) {
      const normalized = area.toLowerCase();
      values = [...values].sort(
        (a, b) =>
          Number(!a.region.toLowerCase().includes(normalized)) -
          Number(!b.region.toLowerCase().includes(normalized)),
      );
    }
    if (!values.length)
      say(
        "UNKNOWN",
        "Không có đội nào được ghi nhận “Sẵn sàng” và “Có thể điều phối” trong phạm vi hiện tại.",
      );
    values.slice(0, 8).forEach((item) => {
      const refs = [
        addEvidence("Team", item.id, "status", item.status, item.updatedAt),
        addEvidence(
          "Team",
          item.id,
          "availability",
          item.availability,
          item.updatedAt,
        ),
        addEvidence("Team", item.id, "region", item.region, item.updatedAt),
      ];
      say(
        "FACT",
        `${item.id} — ${item.name}: ${item.status}, ${item.availability}, khu vực ${item.region}.`,
        refs,
      );
    });
    say(
      "UNKNOWN",
      "Không thể xác nhận thời gian di chuyển thực tế từ dữ liệu hiện có.",
    );
    return base(
      classification.intent,
      `Có ${values.length} đội có thể điều phối trong phạm vi truy vấn.`,
    );
  }
  if (classification.intent === "shelter_capacity") {
    const values = entityId
      ? data.shelters.filter(
          (item) => item.id === entityId || item.code === entityId,
        )
      : data.shelters;
    if (!values.length) say("UNKNOWN", "Chưa có dữ liệu trong hệ thống.");
    values.slice(0, 8).forEach((item) => {
      const capacity = calculateShelterCapacity(item);
      const refs = [
        addEvidence(
          "Shelter",
          item.id,
          "capacity",
          item.capacity,
          item.updatedAt,
        ),
        addEvidence(
          "Shelter",
          item.id,
          "currentOccupancy",
          item.currentOccupancy,
          item.updatedAt,
        ),
        addEvidence(
          "Shelter",
          item.id,
          "reservedCapacity",
          item.reservedCapacity,
          item.updatedAt,
        ),
        addEvidence(
          "Analytics",
          item.id,
          "availableCapacity",
          capacity.availableCapacity,
          item.updatedAt,
          "derived",
        ),
      ];
      say(
        "FACT",
        `${item.id} đang tiếp nhận ${item.currentOccupancy}/${item.capacity} người, đã giữ ${item.reservedCapacity} chỗ và còn ${capacity.availableCapacity} chỗ khả dụng.`,
        refs,
      );
      if (capacity.isNearCapacity || capacity.isOverloaded)
        say(
          "INFERENCE",
          `${item.id} đang chịu áp lực sức chứa${capacity.isOverloaded ? " và đã đạt ngưỡng quá tải" : ""}.`,
          refs,
        );
    });
    return base(
      classification.intent,
      entityId
        ? `Sức chứa hiện tại của ${entityId} được tính từ capacity, occupancy và reserved capacity.`
        : `Đã kiểm tra ${values.length} điểm sơ tán.`,
    );
  }
  if (classification.intent === "sos_prioritization") {
    const values = entityId
      ? data.sosRequests.filter(
          (item) => item.id === entityId || item.code === entityId,
        )
      : urgentUnassignedSos(data);
    if (!values.length)
      say(
        "UNKNOWN",
        entityId
          ? "Chưa có dữ liệu trong hệ thống."
          : "Không có SOS P1 đã xác minh và chưa được điều phối trong phạm vi hiện tại.",
      );
    values.slice(0, 8).forEach((item) => {
      const refs = [
        addEvidence(
          "SOS",
          item.id,
          "priority",
          item.priority,
          item.lastUpdatedAt,
        ),
        addEvidence(
          "SOS",
          item.id,
          "verificationStatus",
          item.verificationStatus,
          item.lastUpdatedAt,
        ),
        addEvidence(
          "SOS",
          item.id,
          "assignedTeamId",
          item.assignedTeamId ?? "Chưa giao",
          item.lastUpdatedAt,
        ),
        addEvidence(
          "SOS",
          item.id,
          "peopleAtRisk",
          item.peopleAtRisk,
          item.lastUpdatedAt,
        ),
      ];
      const affectedNames = item.affectedPeople.map((person) => person.name);
      if (affectedNames.length)
        refs.push(
          addEvidence(
            "SOS",
            item.id,
            "affectedPeople",
            affectedNames.join(", "),
            item.lastUpdatedAt,
          ),
        );
      say(
        "FACT",
        `${item.id}: ${item.priority}, ${item.verificationStatus}, ${item.assignedTeamId ? "đã giao " + item.assignedTeamId : "chưa giao đội"}, ${item.peopleAtRisk} người gặp nguy hiểm${affectedNames.length ? ` (${affectedNames.join(", ")})` : ""}.`,
        refs,
      );
      if (
        item.priority.startsWith("P1") &&
        item.verificationStatus === "Đã xác minh" &&
        !item.assignedTeamId
      )
        say(
          "RECOMMENDATION",
          `Ưu tiên điều phối một đội cứu hộ đủ năng lực cho ${item.id}. Cơ sở: P1, đã xác minh và chưa có đội. Mức khuyến nghị: mạnh; giới hạn: chưa xác nhận thời gian di chuyển thực tế.`,
          refs,
        );
    });
    return base(
      classification.intent,
      `Có ${values.length} SOS phù hợp tiêu chí truy vấn.`,
      buildDeterministicActions(data, entityId, now),
    );
  }
  if (classification.intent === "evacuation_status") {
    const values = entityId
      ? data.evacuationOperations.filter((item) => item.id === entityId)
      : data.evacuationOperations.filter(
          (item) => !["Hoàn thành", "Đã hủy"].includes(item.status),
        );
    if (!values.length) say("UNKNOWN", "Chưa có dữ liệu trong hệ thống.");
    values.slice(0, 8).forEach((item) => {
      const refs = [
        addEvidence(
          "Evacuation",
          item.id,
          "status",
          item.status,
          item.updatedAt,
        ),
        addEvidence(
          "Evacuation",
          item.id,
          "evacuatedPopulation",
          item.evacuatedPopulation,
          item.updatedAt,
        ),
        addEvidence(
          "Evacuation",
          item.id,
          "estimatedPopulation",
          item.estimatedPopulation,
          item.updatedAt,
        ),
        addEvidence(
          "Evacuation",
          item.id,
          "route.status",
          item.route.status,
          item.route.updatedAt,
        ),
      ];
      say(
        "FACT",
        `${item.id}: đã sơ tán ${item.evacuatedPopulation}/${item.estimatedPopulation} người, trạng thái ${item.status}, tuyến ${item.route.status}.`,
        refs,
      );
      if (item.route.status === "Bị chặn")
        say(
          "INFERENCE",
          `${item.id} có nút thắt tuyến đường và cần đánh giá chuyển hướng.`,
          refs,
        );
    });
    say(
      "UNKNOWN",
      "Không thể xác nhận thời gian di chuyển thực tế từ dữ liệu hiện có.",
    );
    return base(
      classification.intent,
      `Đã kiểm tra ${values.length} hoạt động sơ tán.`,
      buildDeterministicActions(data, entityId, now),
    );
  }
  if (classification.intent === "relief_shortage") {
    const shortages = reliefShortages(data);
    const low = lowStockInventory(data);
    if (!shortages.length && !low.length)
      say(
        "UNKNOWN",
        "Không ghi nhận thiếu hụt cứu trợ hoặc tồn kho dưới ngưỡng trong phạm vi hiện tại.",
      );
    shortages.slice(0, 6).forEach(({ request, line }) => {
      const refs = [
        addEvidence(
          "ReliefRequest",
          request.id,
          `items.${line.itemCode}.quantityApproved`,
          line.requested,
          request.lastUpdatedAt,
        ),
        addEvidence(
          "Analytics",
          request.id,
          `fulfillment.${line.itemCode}.allocated`,
          line.allocated,
          request.lastUpdatedAt,
          "derived",
        ),
      ];
      say(
        "FACT",
        `${request.id} thiếu ${line.shortage} ${line.unit} ${line.name} so với lượng đã duyệt.`,
        refs,
      );
    });
    low.slice(0, 6).forEach((item) => {
      const refs = [
        addEvidence(
          "Inventory",
          item.id,
          "quantityOnHand",
          item.quantityOnHand,
          item.lastUpdatedAt,
        ),
        addEvidence(
          "Inventory",
          item.id,
          "quantityReserved",
          item.quantityReserved,
          item.lastUpdatedAt,
        ),
        addEvidence(
          "Inventory",
          item.id,
          "reorderLevel",
          item.reorderLevel,
          item.lastUpdatedAt,
        ),
      ];
      say(
        "FACT",
        `${item.warehouseId} — ${item.name}: khả dụng ${Math.max(0, item.quantityOnHand - item.quantityReserved)} ${item.unit}, dưới hoặc bằng ngưỡng đặt lại ${item.reorderLevel}.`,
        refs,
      );
    });
    return base(
      classification.intent,
      `Ghi nhận ${shortages.length} dòng thiếu phân bổ và ${low.length} mặt hàng tồn thấp.`,
    );
  }
  if (classification.intent === "playbook_status") {
    const executions = entityId
      ? data.playbookExecutions.filter(
          (item) => item.id === entityId || item.playbookId === entityId,
        )
      : data.playbookExecutions.filter((item) =>
          ["Đang hoạt động", "Tạm dừng"].includes(item.status),
        );
    if (!executions.length)
      say("UNKNOWN", "Chưa có playbook execution phù hợp trong hệ thống.");
    executions.forEach((item) => {
      const playbook = data.playbooks.find(
        (value) => value.id === item.playbookId,
      );
      const current = item.stepExecutions.find(
        (step) => step.stepId === item.currentStep,
      );
      const refs = [
        addEvidence(
          "PlaybookExecution",
          item.id,
          "status",
          item.status,
          item.updatedAt,
        ),
        addEvidence(
          "PlaybookExecution",
          item.id,
          "currentStep",
          item.currentStep ?? "Chưa xác định",
          item.updatedAt,
        ),
        addEvidence(
          "Analytics",
          item.id,
          "progress",
          calculateExecutionProgress(item),
          item.updatedAt,
          "derived",
        ),
      ];
      say(
        "FACT",
        `${item.id}${playbook ? ` — ${playbook.code}` : ""}: ${item.status}, bước hiện tại ${current?.stepId ?? item.currentStep ?? "chưa xác định"}, tiến độ ${calculateExecutionProgress(item)}%.`,
        refs,
      );
      item.stepExecutions
        .filter((step) => step.status === "Bị chặn")
        .forEach((step) =>
          say(
            "INFERENCE",
            `Bước ${step.stepId} đang bị chặn: ${step.blockedReason ?? "chưa ghi nhận lý do"}.`,
            [
              addEvidence(
                "PlaybookExecution",
                item.id,
                `step.${step.stepId}.status`,
                step.status,
                item.updatedAt,
              ),
              addEvidence(
                "PlaybookExecution",
                item.id,
                `step.${step.stepId}.blockedReason`,
                step.blockedReason ?? "Chưa có dữ liệu trong hệ thống.",
                item.updatedAt,
              ),
            ],
          ),
        );
    });
    return base(
      classification.intent,
      `Đã kiểm tra ${executions.length} playbook execution.`,
    );
  }
  if (classification.intent === "recovery_status") {
    const projects = entityId
      ? data.recoveryProjects.filter(
          (item) => item.id === entityId || item.code === entityId,
        )
      : data.recoveryProjects.filter(
          (item) => !["Hoàn thành", "Từ chối", "Đã hủy"].includes(item.status),
        );
    if (!projects.length) say("UNKNOWN", "Chưa có dữ liệu trong hệ thống.");
    projects.slice(0, 8).forEach((item) => {
      const refs = [
        addEvidence("Recovery", item.id, "status", item.status, item.updatedAt),
        addEvidence(
          "Recovery",
          item.id,
          "progress",
          item.progress,
          item.updatedAt,
        ),
        addEvidence(
          "Recovery",
          item.id,
          "spentBudget",
          item.spentBudget,
          item.updatedAt,
        ),
        addEvidence(
          "Recovery",
          item.id,
          "approvedBudget",
          item.approvedBudget,
          item.updatedAt,
        ),
      ];
      say(
        "FACT",
        `${item.id} — ${item.name}: ${item.status}, tiến độ ${item.progress}%, đã chi ${item.spentBudget.toLocaleString("vi-VN")}/${item.approvedBudget.toLocaleString("vi-VN")} ₫.`,
        refs,
      );
    });
    return base(
      classification.intent,
      `Đã kiểm tra ${projects.length} dự án phục hồi.`,
    );
  }
  if (classification.intent === "entity_lookup") {
    const before = statements.length;
    factsForIncident(entityId);
    if (statements.length === before) {
      const collections: [AiIntent, boolean][] = [
        ["task_analysis", data.tasks.some((item) => item.id === entityId)],
        ["team_availability", data.teams.some((item) => item.id === entityId)],
        [
          "shelter_capacity",
          data.shelters.some((item) => item.id === entityId),
        ],
        [
          "sos_prioritization",
          data.sosRequests.some((item) => item.id === entityId),
        ],
        [
          "evacuation_status",
          data.evacuationOperations.some((item) => item.id === entityId),
        ],
        [
          "playbook_status",
          data.playbookExecutions.some((item) => item.id === entityId) ||
            data.playbooks.some((item) => item.id === entityId),
        ],
        [
          "recovery_status",
          data.recoveryProjects.some((item) => item.id === entityId),
        ],
      ];
      const match = collections.find(([, exists]) => exists);
      if (match)
        return groundOperationalQuestion({
          ...request,
          question: `Phân tích ${entityId}`,
          context: undefined,
        });
    }
    return base(
      "entity_lookup",
      entityId
        ? `Tra cứu ${entityId} từ trạng thái chuẩn.`
        : "Chưa xác định được mã thực thể.",
      buildDeterministicActions(data, entityId, now),
    );
  }
  const urgent = urgentUnassignedSos(data),
    late = overdueTasks(data, now),
    pressure = pressuredShelters(data),
    blocked = blockedPlaybookSteps(data),
    shortages = reliefShortages(data);
  [
    [urgent.length, "SOS P1 đã xác minh chưa có đội", "SOS" as const],
    [late.length, "nhiệm vụ quá hạn", "Task" as const],
    [pressure.length, "điểm sơ tán chịu áp lực sức chứa", "Shelter" as const],
    [blocked.length, "bước playbook bị chặn", "PlaybookExecution" as const],
    [shortages.length, "dòng vật tư thiếu phân bổ", "ReliefRequest" as const],
  ].forEach(([count, label, type]) => {
    if (Number(count) > 0)
      say("FACT", `Có ${count} ${label} trong phạm vi hiện tại.`, [
        addEvidence(
          type as AiEvidence["entityType"],
          "TỔNG-HỢP",
          "count",
          count,
          now.toISOString(),
          "derived",
        ),
      ]);
  });
  if (!statements.length)
    say("UNKNOWN", "Không ghi nhận ngoại lệ từ các quy tắc hiện có.");
  if (urgent[0])
    say(
      "RECOMMENDATION",
      `Xử lý ${urgent[0].id} trước do là P1, đã xác minh và chưa có đội. Mức khuyến nghị: mạnh.`,
      [
        addEvidence(
          "SOS",
          urgent[0].id,
          "priority / assignment",
          `${urgent[0].priority} / Chưa giao`,
          urgent[0].lastUpdatedAt,
        ),
      ],
    );
  else if (late[0])
    say(
      "RECOMMENDATION",
      `Rà soát ${late[0].id} trước vì đã quá hạn. Mức khuyến nghị: trung bình; cần đối chiếu tình hình hiện trường.`,
      [
        addEvidence(
          "Task",
          late[0].id,
          "dueAt",
          late[0].dueAt,
          late[0].updatedAt,
        ),
      ],
    );
  return base(
    classification.intent,
    "Đã tổng hợp ngoại lệ tác nghiệp bằng các quy tắc xác định.",
    buildDeterministicActions(data, entityId, now),
  );
}
