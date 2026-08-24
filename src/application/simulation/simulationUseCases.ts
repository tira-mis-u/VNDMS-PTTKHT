import { PERSONNEL, personName } from "../../data/identity/personnel";
import type { OperationalSnapshot } from "../operations/operationalSnapshot";
import type {
  SimulationEvent,
  SimulationSpeed,
  SimulationState,
} from "../../domain/simulation/types";
import {
  advanceSimulation,
  createSimulationState,
  pauseSimulation,
  playSimulation,
  setSimulationSpeed,
} from "../../domain/simulation/engine";
import {
  changeIncidentSeverity,
  changeIncidentStatus,
} from "../incidents/incidentUseCases";
import {
  assignTaskToTeam,
  createTaskEntity,
  transitionTaskEntity,
} from "../tasks/taskUseCases";
import {
  assignTeamToOperation,
  changeTeamStatus,
  recalculateTeamAssignment,
} from "../teams/teamUseCases";
import { updateShelterOccupancy } from "../shelters/shelterUseCases";
import {
  updateEvacuationProgress,
  updateRouteStatus,
} from "../evacuations/evacuationUseCases";
import {
  createSosRequest,
  linkSosIncident,
  linkSosTaskAndTeam,
  resolveSos,
  transitionSos,
  verifySos,
} from "../sos/sosUseCases";
import {
  createReliefRequest,
  transitionReliefRequest,
} from "../relief/reliefUseCases";
import { updateStepEvidence } from "../playbooks/playbookUseCases";
import {
  approveRecoveryProject,
  createRecoveryProject,
  startRecoveryProject,
} from "../recovery/recoveryUseCases";
import type { IncidentEvent } from "../../domain/incidents/types";
import type { TeamEvent } from "../../domain/teams/types";
import type { ShelterEvent } from "../../domain/shelters/types";
import type { EvacuationEvent } from "../../domain/evacuations/types";
import type { SosEvent } from "../../domain/sos/types";
import type { ReliefEvent } from "../../domain/relief/types";
import type { RecoveryEvent } from "../../domain/recovery/types";
import type { PlaybookTimelineEvent } from "../../domain/playbooks/types";

export interface SimulationStepResult {
  simulation: SimulationState;
  snapshot: OperationalSnapshot;
  event: SimulationEvent | null;
}
const clone = <T>(value: T): T => structuredClone(value);
const timeOnly = (timestamp: string) => timestamp.split(" ")[1] ?? timestamp;
function incidentEvent(
  event: SimulationEvent,
  message: string,
  type: string = "simulation",
): IncidentEvent {
  return {
    id: `${event.id}-INC`,
    incidentId: "INC-0241",
    type,
    message,
    actor: "Bộ mô phỏng",
    timestamp: timeOnly(event.simulationTime),
    source: "Dữ liệu mô phỏng",
    metadata: { simulationEventId: event.id, seed: "20240901" },
  };
}
function teamEvent(
  event: SimulationEvent,
  teamId: string,
  message: string,
): TeamEvent {
  return {
    id: `${event.id}-TEAM`,
    teamId,
    type: "simulation",
    message,
    actor: "Bộ mô phỏng",
    timestamp: timeOnly(event.simulationTime),
    source: "Dữ liệu mô phỏng",
  };
}
function shelterEvent(event: SimulationEvent, message: string): ShelterEvent {
  return {
    id: `${event.id}-SHELTER`,
    shelterId: "TH-01",
    type: "simulation",
    message,
    actor: "Bộ mô phỏng",
    timestamp: timeOnly(event.simulationTime),
    source: "Dữ liệu mô phỏng",
  };
}
function evacuationEvent(
  event: SimulationEvent,
  message: string,
): EvacuationEvent {
  return {
    id: `${event.id}-EVAC`,
    operationId: "EVAC-001",
    type: "simulation",
    message,
    actor: "Bộ mô phỏng",
    timestamp: timeOnly(event.simulationTime),
    source: "Dữ liệu mô phỏng",
  };
}
function sosEvent(event: SimulationEvent, message: string): SosEvent {
  return {
    id: `${event.id}-SOS`,
    sosId: "SOS-SIM-001",
    type: "simulation",
    message,
    actor: "Bộ mô phỏng",
    timestamp: timeOnly(event.simulationTime),
    source: "Dữ liệu mô phỏng",
  };
}
function reliefEvent(event: SimulationEvent, message: string): ReliefEvent {
  return {
    id: `${event.id}-RELIEF`,
    entityType: "request",
    entityId: "REQ-SIM-001",
    type: "simulation",
    message,
    actor: "Bộ mô phỏng",
    timestamp: timeOnly(event.simulationTime),
    source: "Dữ liệu mô phỏng",
  };
}
function recoveryEvent(event: SimulationEvent, message: string): RecoveryEvent {
  return {
    id: `${event.id}-RECOVERY`,
    entityType: "project",
    entityId: "RP-SIM-001",
    incidentId: "INC-0241",
    type: "simulation",
    message,
    actor: "Bộ mô phỏng",
    timestamp: event.simulationTime,
    source: "Dữ liệu mô phỏng",
  };
}
export function startSimulation(state: SimulationState) {
  return playSimulation(state);
}
export function stopSimulation(state: SimulationState) {
  return pauseSimulation(state);
}
export function changeSimulationSpeed(
  state: SimulationState,
  speed: SimulationSpeed,
) {
  return setSimulationSpeed(state, speed);
}
export function resetSimulationState() {
  return createSimulationState();
}
export function applyNextSimulationTick(
  state: SimulationState,
  input: OperationalSnapshot,
): SimulationStepResult {
  const advanced = advanceSimulation(state);
  if (!advanced.event)
    return { simulation: advanced.state, snapshot: input, event: null };
  if (state.appliedEventIds.includes(advanced.event.id))
    return { simulation: advanced.state, snapshot: input, event: null };
  return {
    simulation: advanced.state,
    snapshot: applyOperationalPropagation(input, advanced.event),
    event: advanced.event,
  };
}
export function applyOperationalPropagation(
  input: OperationalSnapshot,
  event: SimulationEvent,
): OperationalSnapshot {
  const snapshot = clone(input);
  const applied = [
    ...snapshot.events,
    ...snapshot.teamEvents,
    ...snapshot.shelterEvents,
    ...snapshot.evacuationEvents,
    ...snapshot.sosEvents,
    ...snapshot.reliefEvents,
    ...snapshot.playbookEvents,
    ...snapshot.recoveryEvents,
  ].some((item) => item.id.startsWith(event.id));
  if (applied) return snapshot;
  const timestamp = event.simulationTime;
  const incident = snapshot.incidents.find((item) => item.id === "INC-0241");
  switch (event.mutation) {
    case "none":
      break;
    case "incident-risk":
      if (incident) {
        const changed = changeIncidentSeverity(incident, "Khẩn cấp", timestamp);
        snapshot.incidents = snapshot.incidents.map((item) =>
          item.id === incident.id
            ? {
                ...changed,
                affectedArea: "Tứ Liên, Yên Phụ, Phúc Tân và hành lang Âu Cơ",
                affectedPopulation: Math.max(item.affectedPopulation, 48000),
                floodDepth: "0,8–1,4 m",
              }
            : item,
        );
        snapshot.events = [
          incidentEvent(
            event,
            "Mực nước mô phỏng vượt BĐ III; nâng rủi ro Tây Hồ lên Rất cao",
            "severity",
          ),
          ...snapshot.events,
        ];
      }
      break;
    case "incident-operational":
      if (incident) {
        snapshot.incidents = snapshot.incidents.map((item) =>
          item.id === incident.id
            ? changeIncidentStatus(item, "Đang xử lý", timestamp)
            : item,
        );
        snapshot.events = [
          incidentEvent(
            event,
            "Kích hoạt ứng phó diện rộng theo ngưỡng BĐ III",
            "status",
          ),
          ...snapshot.events,
        ];
        const execution = snapshot.playbookExecutions.find(
          (item) =>
            item.playbookId === "PB-FLOOD-001" &&
            item.incidentId === incident.id &&
            ["Đang hoạt động", "Tạm dừng"].includes(item.status),
        );
        if (execution) {
          const step = execution.stepExecutions.find(
            (item) => item.stepId === "PBS-06",
          );
          if (step) {
            const changed = updateStepEvidence(
              execution,
              "PBS-06",
              {
                notes: `${step.notes} Trigger mô phỏng ${event.id}: mực nước vượt BĐ III.`,
              },
              timestamp,
            );
            const timeline: PlaybookTimelineEvent = {
              id: `${event.id}-PLAYBOOK`,
              executionId: execution.id,
              playbookId: execution.playbookId,
              incidentId: execution.incidentId,
              stepId: "PBS-06",
              type: "simulation_trigger",
              message:
                "Bộ mô phỏng xác nhận ngưỡng báo động III cho phương án ứng phó lũ",
              actor: "Bộ mô phỏng",
              timestamp,
              source: "Dữ liệu mô phỏng",
            };
            snapshot.playbookExecutions = snapshot.playbookExecutions.map(
              (item) =>
                item.id === execution.id
                  ? { ...changed, timeline: [timeline, ...changed.timeline] }
                  : item,
            );
            snapshot.playbookEvents = [timeline, ...snapshot.playbookEvents];
          }
        }
      }
      break;
    case "road-restriction":
      {
        const operation = snapshot.evacuationOperations.find(
          (item) => item.id === "EVAC-001",
        );
        if (operation) {
          snapshot.evacuationOperations = snapshot.evacuationOperations.map(
            (item) =>
              item.id === operation.id
                ? {
                    ...updateRouteStatus(item, "Hạn chế", timestamp),
                    route: {
                      ...item.route,
                      status: "Hạn chế",
                      blockedSegments: [
                        ...new Set([
                          ...item.route.blockedSegments,
                          "Đoạn Âu Cơ – Nghi Tàm ngập trên 0,5 m",
                        ]),
                      ],
                      updatedAt: timestamp,
                    },
                  }
                : item,
          );
          snapshot.evacuationEvents = [
            evacuationEvent(
              event,
              "Hạn chế tuyến Âu Cơ – Nghi Tàm do ngập mô phỏng",
            ),
            ...snapshot.evacuationEvents,
          ];
          snapshot.events = [
            incidentEvent(
              event,
              "Ghi nhận hạn chế giao thông trên tuyến Âu Cơ – Nghi Tàm",
              "route",
            ),
            ...snapshot.events,
          ];
        }
      }
      break;
    case "evacuation-route":
      {
        const operation = snapshot.evacuationOperations.find(
          (item) => item.id === "EVAC-001",
        );
        if (operation) {
          snapshot.evacuationOperations = snapshot.evacuationOperations.map(
            (item) =>
              item.id === operation.id
                ? updateRouteStatus(item, "Đang dùng tuyến thay thế", timestamp)
                : item,
          );
          snapshot.evacuationEvents = [
            evacuationEvent(
              event,
              "EVAC-001 chuyển sang tuyến thay thế đã được xác định",
            ),
            ...snapshot.evacuationEvents,
          ];
        }
      }
      break;
    case "shelter-pressure":
      applyShelterPressure(snapshot, event, 450, 350);
      break;
    case "shelter-critical":
      applyShelterPressure(snapshot, event, 490, 390);
      break;
    case "sos-create":
      if (!snapshot.sosRequests.some((item) => item.id === "SOS-SIM-001")) {
        let sos = createSosRequest(
          "SOS-SIM-001",
          {
            reporter: {
              name: personName(PERSONNEL.LOCAL_OFFICER.id),
              contact: "0912 409 118",
              source: "Cán bộ địa phương",
            },
            location: {
              name: "Cụm dân cư Tứ Liên ngoài đê",
              address: "Ngõ 76 An Dương, Tứ Liên",
              administrativeArea: "Tây Hồ, Hà Nội",
              coordinates: [105.8312, 21.0705],
              accessCondition: "Bị cô lập",
              floodDepth: "0,9 m (mô phỏng)",
            },
            description:
              "Bốn người, gồm hai người cao tuổi, bị cô lập cần xuồng tiếp cận.",
            peopleAtRisk: 4,
            injuredCount: 0,
            missingCount: 0,
            childrenCount: 0,
            elderlyCount: 2,
            disabledCount: 0,
            severity: "Nghiêm trọng",
            communicationStatus: "Gián đoạn",
          },
          timestamp,
        );
        sos = linkSosIncident(sos, "INC-0241", timestamp);
        snapshot.sosRequests = [sos, ...snapshot.sosRequests];
        snapshot.sosEvents = [
          sosEvent(event, "Tạo SOS từ diễn biến mô phỏng và liên kết INC-0241"),
          ...snapshot.sosEvents,
        ];
        snapshot.events = [
          incidentEvent(event, "Tiếp nhận SOS-SIM-001 tại Tứ Liên", "sos"),
          ...snapshot.events,
        ];
      }
      break;
    case "task-create":
      if (!snapshot.tasks.some((item) => item.id === "TSK-SIM-001")) {
        const sos = snapshot.sosRequests.find(
          (item) => item.id === "SOS-SIM-001",
        );
        if (sos) {
          const verified = verifySos(sos, timestamp);
          snapshot.sosRequests = snapshot.sosRequests.map((item) =>
            item.id === sos.id ? verified : item,
          );
          const task = createTaskEntity(
            "TSK-SIM-001",
            {
              incidentId: "INC-0241",
              title: "Cứu hộ hộ dân bị cô lập tại Tứ Liên",
              type: "Cứu hộ SOS",
              priority: "Khẩn cấp",
              teamId: "",
              assignee: "",
              location: sos.location.address,
              dueAt: "21/08/2026 11:10",
              description: sos.description,
              coordinates: sos.location.coordinates,
            },
            timestamp,
            { teamLeader: "", coordinates: sos.location.coordinates },
          );
          snapshot.tasks = [task, ...snapshot.tasks];
          snapshot.sosEvents = [
            sosEvent(event, "Xác minh SOS-SIM-001 và tạo TSK-SIM-001"),
            ...snapshot.sosEvents,
          ];
          snapshot.events = [
            incidentEvent(
              event,
              "Tạo nhiệm vụ TSK-SIM-001 từ SOS-SIM-001",
              "task",
            ),
            ...snapshot.events,
          ];
        }
      }
      break;
    case "team-dispatch":
      {
        const task = snapshot.tasks.find((item) => item.id === "TSK-SIM-001");
        const team = snapshot.teams.find((item) => item.id === "CH-05");
        const sos = snapshot.sosRequests.find(
          (item) => item.id === "SOS-SIM-001",
        );
        if (task && team && sos && task.teamId !== "CH-05") {
          const ready =
            team.status === "Tạm nghỉ"
              ? changeTeamStatus(team, "Sẵn sàng", timestamp)
              : team;
          const assigned = assignTaskToTeam(
            task,
            {
              teamId: ready.id,
              teamLeader: ready.leader,
              assignee: ready.leader,
            },
            timestamp,
          );
          snapshot.tasks = snapshot.tasks.map((item) =>
            item.id === task.id ? assigned : item,
          );
          snapshot.teams = snapshot.teams.map((item) =>
            item.id === team.id
              ? assignTeamToOperation(ready, task.id, "INC-0241", timestamp)
              : item,
          );
          snapshot.sosRequests = snapshot.sosRequests.map((item) =>
            item.id === sos.id
              ? linkSosTaskAndTeam(item, task.id, team.id, timestamp)
              : item,
          );
          snapshot.teamEvents = [
            teamEvent(event, team.id, "Điều động CH-05 thực hiện TSK-SIM-001"),
            ...snapshot.teamEvents,
          ];
          snapshot.sosEvents = [
            sosEvent(event, "Giao TSK-SIM-001 cho CH-05"),
            ...snapshot.sosEvents,
          ];
          snapshot.events = [
            incidentEvent(
              event,
              "Điều động CH-05 xử lý SOS-SIM-001",
              "team_dispatch",
            ),
            ...snapshot.events,
          ];
        }
      }
      break;
    case "relief-pressure":
      if (!snapshot.reliefRequests.some((item) => item.id === "REQ-SIM-001")) {
        let request = createReliefRequest(
          "REQ-SIM-001",
          {
            requester: personName(PERSONNEL.DANG_THU_HA.id),
            requesterRole: "Phụ trách điểm sơ tán",
            origin: "Điểm sơ tán",
            incidentId: "INC-0241",
            shelterId: "TH-01",
            destination: "Trường THPT Tây Hồ — TH-01",
            destinationCoordinates: [105.8098, 21.0865],
            priority: "P1 — Khẩn cấp",
            requiredBy: "21/08/2026 11:30",
            justification:
              "Áp lực tiếp nhận mô phỏng đạt 98%, cần bổ sung nước uống.",
            items: [
              {
                itemCode: "NUOC-500",
                category: "Nước uống",
                name: "Nước uống đóng chai 500 ml",
                unit: "chai",
                quantityRequested: 500,
              },
            ],
            notes: `Tạo bởi ${event.id}.`,
          },
          timestamp,
        );
        request = transitionReliefRequest(request, "Đã gửi", timestamp, {
          reservations: snapshot.reservations,
          shipments: snapshot.shipments,
        });
        snapshot.reliefRequests = [request, ...snapshot.reliefRequests];
        snapshot.reliefEvents = [
          reliefEvent(event, "Tạo REQ-SIM-001 do áp lực sức chứa TH-01"),
          ...snapshot.reliefEvents,
        ];
        snapshot.events = [
          incidentEvent(event, "Phát sinh REQ-SIM-001 cho TH-01", "relief"),
          ...snapshot.events,
        ];
      }
      break;
    case "response-progress":
      {
        const task = snapshot.tasks.find((item) => item.id === "TSK-SIM-001");
        const sos = snapshot.sosRequests.find(
          (item) => item.id === "SOS-SIM-001",
        );
        if (task && task.status === "Đã giao") {
          const accepted = transitionTaskEntity(
            task,
            "Đã tiếp nhận",
            timestamp,
          );
          const started = transitionTaskEntity(
            accepted,
            "Đang thực hiện",
            timestamp,
          );
          snapshot.tasks = snapshot.tasks.map((item) =>
            item.id === task.id ? { ...started, progress: 45 } : item,
          );
          snapshot.teams = snapshot.teams.map((item) =>
            item.id === task.teamId
              ? recalculateTeamAssignment(
                  item,
                  snapshot.tasks.map((row) =>
                    row.id === task.id ? started : row,
                  ),
                  timestamp,
                )
              : item,
          );
          if (sos && sos.status === "Đã điều phối")
            snapshot.sosRequests = snapshot.sosRequests.map((item) =>
              item.id === sos.id
                ? transitionSos(item, "Đang cứu hộ", timestamp)
                : item,
            );
          snapshot.teamEvents = [
            teamEvent(event, task.teamId, "CH-05 bắt đầu tiếp cận khu vực SOS"),
            ...snapshot.teamEvents,
          ];
          snapshot.sosEvents = [
            sosEvent(event, "SOS-SIM-001 chuyển sang Đang cứu hộ"),
            ...snapshot.sosEvents,
          ];
          snapshot.events = [
            incidentEvent(
              event,
              "TSK-SIM-001 bắt đầu thực hiện",
              "task_status",
            ),
            ...snapshot.events,
          ];
        }
      }
      break;
    case "stabilize":
      {
        const task = snapshot.tasks.find((item) => item.id === "TSK-SIM-001");
        const sos = snapshot.sosRequests.find(
          (item) => item.id === "SOS-SIM-001",
        );
        if (task && task.status === "Đang thực hiện") {
          const completed = transitionTaskEntity(task, "Hoàn thành", timestamp);
          snapshot.tasks = snapshot.tasks.map((item) =>
            item.id === task.id ? completed : item,
          );
          snapshot.teams = snapshot.teams.map((item) =>
            item.id === task.teamId
              ? recalculateTeamAssignment(
                  item,
                  snapshot.tasks.map((row) =>
                    row.id === task.id ? completed : row,
                  ),
                  timestamp,
                )
              : item,
          );
        }
        if (sos && ["Đang cứu hộ", "Đã điều phối"].includes(sos.status))
          snapshot.sosRequests = snapshot.sosRequests.map((item) =>
            item.id === sos.id
              ? resolveSos(
                  item,
                  "Đã đưa 4 người ra khỏi khu vực cô lập an toàn.",
                  timestamp,
                )
              : item,
          );
        if (incident)
          snapshot.incidents = snapshot.incidents.map((item) =>
            item.id === incident.id
              ? {
                  ...changeIncidentStatus(item, "Đã kiểm soát", timestamp),
                  progress: 90,
                }
              : item,
          );
        snapshot.sosEvents = [
          sosEvent(event, "Hoàn thành cứu hộ 4 người an toàn"),
          ...snapshot.sosEvents,
        ];
        snapshot.events = [
          incidentEvent(
            event,
            "Mưa giảm, hoàn thành cứu hộ mô phỏng và kiểm soát sự cố",
            "status",
          ),
          ...snapshot.events,
        ];
      }
      break;
    case "recovery-transition":
      if (!snapshot.recoveryProjects.some((item) => item.id === "RP-SIM-001")) {
        const assessment = snapshot.damageAssessments.find(
          (item) => item.id === "DA-0243",
        );
        if (assessment) {
          let project = createRecoveryProject(
            "RP-SIM-001",
            {
              name: "Khôi phục sau đợt lũ mô phỏng Sông Hồng",
              incidentId: "INC-0241",
              assessmentIds: [assessment.id],
              category: "Khôi phục hạ tầng thiết yếu",
              priority: "Cao",
              owner: personName(PERSONNEL.PHAM_LE_HONG_QUANG.id),
              geographicScope: "Tây Hồ, Hà Nội",
              estimatedBudget: 12800000000,
              targetDate: "30/09/2026",
              location: assessment.location,
              affectedAreaCoordinates: assessment.affectedAreaCoordinates,
              notes: `Chuyển giai đoạn bởi ${event.id}.`,
            },
            timestamp,
          );
          project = approveRecoveryProject(
            project,
            snapshot.damageAssessments,
            12000000000,
            timestamp,
          );
          project = startRecoveryProject(project, timestamp);
          snapshot.recoveryProjects = [project, ...snapshot.recoveryProjects];
          snapshot.recoveryEvents = [
            recoveryEvent(event, "Tạo, phê duyệt và khởi động RP-SIM-001"),
            ...snapshot.recoveryEvents,
          ];
          snapshot.events = [
            incidentEvent(
              event,
              "Chuyển giai đoạn phục hồi, tạo RP-SIM-001",
              "recovery",
            ),
            ...snapshot.events,
          ];
        }
      }
      break;
  }
  return snapshot;
}
function applyShelterPressure(
  snapshot: OperationalSnapshot,
  event: SimulationEvent,
  occupancy: number,
  evacuated: number,
) {
  const shelter = snapshot.shelters.find((item) => item.id === "TH-01");
  const operation = snapshot.evacuationOperations.find(
    (item) => item.id === "EVAC-001",
  );
  if (shelter)
    snapshot.shelters = snapshot.shelters.map((item) =>
      item.id === shelter.id
        ? updateShelterOccupancy(item, occupancy, event.simulationTime)
        : item,
    );
  if (operation)
    snapshot.evacuationOperations = snapshot.evacuationOperations.map((item) =>
      item.id === operation.id
        ? updateEvacuationProgress(item, evacuated, event.simulationTime)
        : item,
    );
  snapshot.shelterEvents = [
    shelterEvent(event, `Cập nhật áp lực mô phỏng: ${occupancy}/500 người`),
    ...snapshot.shelterEvents,
  ];
  snapshot.evacuationEvents = [
    evacuationEvent(event, `EVAC-001 đã sơ tán ${evacuated}/500 người`),
    ...snapshot.evacuationEvents,
  ];
}
