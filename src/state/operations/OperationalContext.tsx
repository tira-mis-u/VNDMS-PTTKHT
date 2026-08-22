import { useEffect, type ReactNode } from "react";
import type {
  IncidentSeverity,
  IncidentStatus,
} from "../../domain/incidents/types";
import type {
  IncidentTask,
  TaskPriority,
  TaskStatus,
  TaskUpdate,
} from "../../domain/tasks/types";
import type { TeamLocation, TeamStatus } from "../../domain/teams/types";
import { calculateIncidentProgress } from "../../domain/tasks/rules";
import {
  assertIncidentCanClose,
  createIncidentEntity,
  changeIncidentSeverity,
  changeIncidentStatus,
  type CreateIncidentInput,
} from "../../application/incidents/incidentUseCases";
import {
  assignTaskToTeam,
  createTaskEntity,
  releaseTaskAssignment,
  transitionTaskEntity,
  type NewTaskInput,
} from "../../application/tasks/taskUseCases";
import {
  applyTeamLocation,
  assertTeamDispatchable,
  assignTeamToEvacuation,
  assignTeamToOperation,
  assignTeamToReliefShipment,
  changeTeamStatus,
  recalculateTeamAssignment,
  releaseTeamFromEvacuation,
  releaseTeamFromReliefShipment,
  updateTeamCapabilities as applyTeamCapabilities,
  updateTeamProfile as applyTeamProfile,
  type TeamProfileInput,
} from "../../application/teams/teamUseCases";
import {
  closeShelter,
  openShelter,
  updateShelterCapacity as applyShelterCapacity,
  updateShelterOccupancy as applyShelterOccupancy,
  updateShelterResources as applyShelterResources,
  type ShelterResourceInput,
} from "../../application/shelters/shelterUseCases";
import {
  assignEvacuationTeam as applyEvacuationTeam,
  createEvacuationOperation,
  redirectEvacuation as applyEvacuationRedirect,
  transitionEvacuation as applyEvacuationTransition,
  updateEvacuationProgress as applyEvacuationProgress,
  updateRouteStatus as applyRouteStatus,
  type NewEvacuationInput,
} from "../../application/evacuations/evacuationUseCases";
import type {
  EvacuationStatus,
  RouteStatus,
} from "../../domain/evacuations/types";
import { assertShelterCanReceive } from "../../domain/shelters/rules";
import {
  assertSosScope,
  evacuationInputFromSos,
  incidentInputFromSos,
  linkSosIncident as applySosIncident,
  linkSosTaskAndTeam,
  resolveSos as applySosResolution,
  retriageSos,
  taskInputFromSos,
  transitionSos,
  updateSosLocation as applySosLocation,
  verifySos as applySosVerification,
} from "../../application/sos/sosUseCases";
import type { SosLocation, SosPriority } from "../../domain/sos/types";
import {
  assertReliefScope,
  adjustInventory as applyInventoryAdjustment,
  approveReliefRequest as applyReliefApproval,
  confirmShipmentReceipt as applyShipmentReceipt,
  createReliefRequest as createReliefEntity,
  dispatchReservation as applyReservationDispatch,
  releaseReservation,
  reserveStock,
  transitionReliefRequest as applyReliefTransition,
  transitionShipment as applyShipmentTransition,
  type NewReliefRequestInput,
} from "../../application/relief/reliefUseCases";
import type {
  ReliefRequestStatus,
  ShipmentStatus,
  WarehouseStatus,
} from "../../domain/relief/types";
import {
  addDamageItem as applyDamageItemAdd,
  addMilestone as applyRecoveryMilestoneAdd,
  approveRecoveryProject as applyRecoveryApproval,
  assertRecoveryScope,
  attachEvidence as applyDamageEvidence,
  cancelRecoveryProject as applyRecoveryCancellation,
  completeMilestone as applyRecoveryMilestoneCompletion,
  completeRecoveryProject as applyRecoveryCompletion,
  createDamageAssessment as createDamageAssessmentEntity,
  createRecoveryProject as createRecoveryProjectEntity,
  createRevision as applyDamageRevision,
  pauseRecoveryProject as applyRecoveryPause,
  recordCompletionVerification as applyRecoveryCompletionVerification,
  rejectDamageAssessment as applyDamageRejection,
  rejectRecoveryProject as applyRecoveryProjectRejection,
  resumeRecoveryProject as applyRecoveryResume,
  reviewDamageAssessment as applyDamageReview,
  skipMilestone as applyRecoveryMilestoneSkip,
  startMilestone as applyRecoveryMilestoneStart,
  startRecoveryProject as applyRecoveryStart,
  submitDamageAssessment as applyDamageSubmission,
  syncRecoveryProgress,
  updateDamageAssessment as applyDamageUpdate,
  updateRecoveryBudget as applyRecoveryBudget,
  updateRecoveryProject as applyRecoveryUpdate,
  verifyDamageAssessment as applyDamageVerification,
  type NewDamageAssessmentInput,
  type NewRecoveryProjectInput,
} from "../../application/recovery/recoveryUseCases";
import type {
  DamageAssessment,
  DamageItem,
  RecoveryEvidence,
  RecoveryMilestone,
  RecoveryProject,
} from "../../domain/recovery/types";
import {
  activatePlaybook as applyPlaybookActivation,
  addStep as applyPlaybookStepAdd,
  archivePlaybook as applyPlaybookArchive,
  assignStepOwner as applyPlaybookStepOwner,
  cancelPlaybook as applyPlaybookCancel,
  completePlaybook as applyPlaybookCompletion,
  completePlaybookStep as applyPlaybookStepCompletion,
  createPlaybook as createPlaybookEntity,
  pausePlaybook as applyPlaybookPause,
  publishPlaybook as applyPlaybookPublish,
  reorderSteps as applyPlaybookStepReorder,
  resumePlaybook as applyPlaybookResume,
  skipPlaybookStep as applyPlaybookStepSkip,
  startPlaybookStep as applyPlaybookStepStart,
  updatePlaybook as applyPlaybookUpdate,
  updateStepEvidence as applyPlaybookEvidence,
  type NewPlaybookInput,
} from "../../application/playbooks/playbookUseCases";
import type {
  Playbook,
  PlaybookStep,
  PlaybookStepExecution,
  PlaybookTimelineEvent,
} from "../../domain/playbooks/types";
import type { Permission } from "../../lib/permissions/permissions";
import { hasPermission } from "../../lib/permissions/permissions";
import { authorizeResources } from "../../lib/security/authorization";
import {
  acknowledgeOperationalAlert,
  markAlertReadReceipt,
} from "../../application/alerts/alertUseCases";
import {
  alertAuthorizationResource,
  deriveAuthorizedAlerts,
} from "../../application/alerts/alertQueries";
import {
  deriveOperationalAlerts,
  markAlertUnread as removeAlertReadReceipt,
  resolveAlertState,
} from "../../domain/alerts/rules";
import type { DerivedAlert } from "../../domain/alerts/types";
import { createAuthorizedOperationalView } from "../../application/authorization/authorizedOperationalView";
import { createOperationalResourceContext } from "../../application/authorization/operationalResourceContext";
import { createOperationalTimeline } from "../../application/operations/operationalTimeline";
import { inMemoryOperationalRepository } from "../../infrastructure/persistence/inMemoryOperationalRepository";
import {
  applyNextSimulationTick,
  changeSimulationSpeed,
  resetSimulationState,
  startSimulation,
  stopSimulation,
} from "../../application/simulation/simulationUseCases";
import type { SimulationSpeed } from "../../domain/simulation/types";

import { OperationalStateContext } from "./OperationalStateContext";
import { useAtomicOperationalState } from "./useAtomicOperationalState";
import { useOperationalSecurity } from "./useOperationalSecurity";

function now() {
  return "21/08/2026 10:45";
}
function timeOnly() {
  return "10:45";
}

export function OperationalProvider({ children }: { children: ReactNode }) {
  const {
    session,
    currentUser,
    users,
    securityAuditEvents,
    role,
    actorName,
    currentScopeName,
    can,
    enforcePermission,
    login,
    logout,
    updateUserActive,
    updateUserRole,
    updateUserScope,
  } = useOperationalSecurity();
  const {
    incidents,
    tasks,
    teams,
    shelters,
    evacuationOperations,
    sosRequests,
    warehouses,
    inventory,
    reliefRequests,
    reservations,
    shipments,
    playbooks,
    playbookExecutions,
    damageAssessments,
    recoveryProjects,
    simulation,
    setIncidents,
    setEvents,
    setTasks,
    setTaskUpdates,
    setTeams,
    setTeamEvents,
    setShelters,
    setShelterEvents,
    setEvacuationOperations,
    setEvacuationEvents,
    setSosRequests,
    setSosEvents,
    setWarehouses,
    setInventory,
    setReliefRequests,
    setReservations,
    setShipments,
    setReliefEvents,
    setPlaybooks,
    setPlaybookExecutions,
    setPlaybookEvents,
    setDamageAssessments,
    setRecoveryProjects,
    setRecoveryEvents,
    setAlertInteractions,
    setAlertEvents,
    setSimulation,
    currentOperationalSnapshot,
    currentSimulationState,
    applyOperationalSnapshot,
    executeAtomic,
  } = useAtomicOperationalState(
    inMemoryOperationalRepository.load(),
    resetSimulationState(),
  );
  const {
    system: systemResource,
    incident: incidentResource,
    team: teamResource,
    task: taskResources,
    shelter: shelterResource,
    evacuation: evacuationResources,
    sos: sosResource,
    warehouse: warehouseResource,
    reliefRequest: reliefRequestResource,
    reservation: reservationResources,
    shipment: shipmentResources,
    assessment: assessmentResource,
    recoveryProject: recoveryProjectResource,
    playbook: playbookResource,
    playbookExecution: playbookExecutionResources,
  } = createOperationalResourceContext(currentOperationalSnapshot);
  const {
    pushEvent,
    pushTeamEvent,
    pushShelterEvent,
    pushEvacuationEvent,
    pushSosEvent,
    pushReliefEvent,
    pushRecoveryEvent,
    pushTemplatePlaybookEvent,
    pushPlaybookEvent,
  } = createOperationalTimeline({
    read: currentOperationalSnapshot,
    actorName,
    now,
    timeOnly,
    setEvents,
    setTeamEvents,
    setShelterEvents,
    setEvacuationEvents,
    setSosEvents,
    setReliefEvents,
    setRecoveryEvents,
    setPlaybookEvents,
    setPlaybookExecutions,
  });
  const syncRecoveryProjects = (nextTasks: IncidentTask[]) =>
    setRecoveryProjects((current) =>
      current.map((project) =>
        syncRecoveryProgress(
          project,
          { tasks: nextTasks, assessments: damageAssessments },
          now(),
        ),
      ),
    );
  const syncIncidentProgress = (
    incidentId: string,
    nextTasks: IncidentTask[],
  ) => {
    const progress = calculateIncidentProgress(
      nextTasks.filter((task) => task.incidentId === incidentId),
    );
    if (progress === null) return;
    setIncidents((current) =>
      current.map((item) =>
        item.id === incidentId ? { ...item, progress, updatedAt: now() } : item,
      ),
    );
  };

  const createIncident = (data: CreateIncidentInput) => {
    enforcePermission("create", [
      { type: "Incident", id: "new", geographicScope: data.location.name },
    ]);
    const number =
      Math.max(...incidents.map((item) => Number(item.id.split("-")[1]))) + 1;
    const id = `INC-${String(number).padStart(4, "0")}`;
    const incident = createIncidentEntity(id, data, actorName, now());
    setIncidents((current) => [incident, ...current]);
    pushEvent(id, `Tạo sự cố ${id}: ${data.title}`, "created");
    return id;
  };
  const updateStatus = (id: string, status: IncidentStatus) => {
    enforcePermission("update", [incidentResource(id)]);
    setIncidents((current) =>
      current.map((item) =>
        item.id === id ? changeIncidentStatus(item, status, now()) : item,
      ),
    );
    pushEvent(
      id,
      `Chuyển trạng thái sự cố sang ${status.toUpperCase()}`,
      "status",
    );
  };
  const updateSeverity = (id: string, severity: IncidentSeverity) => {
    enforcePermission("severity", [incidentResource(id)]);
    setIncidents((current) =>
      current.map((item) =>
        item.id === id ? changeIncidentSeverity(item, severity, now()) : item,
      ),
    );
    pushEvent(
      id,
      `Cập nhật mức độ sự cố thành ${severity.toUpperCase()}`,
      "severity",
    );
  };
  const dispatchTeam = (incidentId: string, teamId: string) => {
    enforcePermission(
      "dispatch",
      [incidentResource(incidentId), teamResource(teamId)],
      "điều phối đội tới sự cố",
    );
    setIncidents((current) =>
      current.map((item) =>
        item.id === incidentId
          ? {
              ...item,
              assignedTeamId: teamId,
              status: "Đang điều phối",
              updatedAt: now(),
            }
          : item,
      ),
    );
    setTeams((current) =>
      current.map((team) =>
        team.id === teamId
          ? {
              ...team,
              status: "Đang điều động",
              currentIncident: incidentId,
              availability: "Đang bận",
              updatedAt: now(),
            }
          : team,
      ),
    );
    pushEvent(
      incidentId,
      `Đã điều phối ${teamId} phụ trách sự cố`,
      "assignment",
    );
    pushTeamEvent(
      teamId,
      `Điều phối ${teamId} tới sự cố ${incidentId}`,
      "dispatch",
    );
  };

  const createTask = (data: NewTaskInput) => {
    enforcePermission("task_create", [
      incidentResource(data.incidentId),
      ...(data.teamId ? [teamResource(data.teamId)] : []),
    ]);
    const max = Math.max(
      240,
      ...tasks.map((task) => Number(task.id.replace(/\D/g, "")) || 0),
    );
    const id = `TSK-${String(max + 1).padStart(4, "0")}`;
    const incident = incidents.find((item) => item.id === data.incidentId);
    const team = teams.find((item) => item.id === data.teamId);
    if (team) assertTeamDispatchable(team);
    const task = createTaskEntity(id, data, now(), {
      teamLeader: team?.leader ?? "",
      coordinates: incident?.location.coordinates ?? [105.85, 21.05],
    });
    const next = [task, ...tasks];
    setTasks(next);
    syncRecoveryProjects(next);
    if (data.teamId) {
      setTeams((current) =>
        current.map((item) =>
          item.id === data.teamId
            ? assignTeamToOperation(item, id, data.incidentId, now())
            : item,
        ),
      );
      pushTeamEvent(data.teamId, `Nhận phân công nhiệm vụ ${id}`, "assignment");
    }
    syncIncidentProgress(data.incidentId, next);
    pushEvent(
      data.incidentId,
      `Tạo nhiệm vụ ${id}: ${data.title}${data.teamId ? ` và giao cho ${data.teamId}` : ""}`,
      "task",
    );
    return id;
  };
  const assignTaskTeam = (taskId: string, teamId: string) => {
    enforcePermission(
      "task_assign",
      [...taskResources(taskId), teamResource(teamId)],
      "gán nhiệm vụ cho đội",
    );
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    const team = teams.find((item) => item.id === teamId);
    if (!team) return;
    assertTeamDispatchable(team, taskId);
    const assigned = assignTaskToTeam(
      task,
      { teamId, teamLeader: team.leader },
      now(),
    );
    const next = tasks.map((item) => (item.id === taskId ? assigned : item));
    setTasks(next);
    setTeams((current) =>
      current.map((item) => {
        if (item.id === teamId)
          return assignTeamToOperation(item, taskId, task.incidentId, now());
        if (task.teamId && task.teamId !== teamId && item.id === task.teamId)
          return recalculateTeamAssignment(item, next, now());
        return item;
      }),
    );
    pushTeamEvent(
      teamId,
      `Được điều phối cho nhiệm vụ ${taskId}`,
      "assignment",
    );
    setIncidents((current) =>
      current.map((item) =>
        item.id === task.incidentId && !item.assignedTeamId
          ? { ...item, assignedTeamId: teamId, updatedAt: now() }
          : item,
      ),
    );
    pushEvent(
      task.incidentId,
      `Đã điều phối ${teamId} cho nhiệm vụ ${taskId}`,
      "task_assignment",
    );
  };

  const transitionTask = (taskId: string, status: TaskStatus) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    const permission: Permission =
      status === "Đã tiếp nhận"
        ? "task_accept"
        : status === "Đang thực hiện"
          ? "task_start"
          : status === "Hoàn thành"
            ? "task_complete"
            : status === "Đã hủy"
              ? "task_cancel"
              : "task_assign";
    enforcePermission(permission, taskResources(taskId));
    const transitioned = transitionTaskEntity(task, status, now());
    const next = tasks.map((item) =>
      item.id === taskId ? transitioned : item,
    );
    setTasks(next);
    syncRecoveryProjects(next);
    syncIncidentProgress(task.incidentId, next);
    if (task.teamId) {
      setTeams((current) =>
        current.map((team) => {
          if (team.id !== task.teamId) return team;
          if (status === "Đã tiếp nhận" || status === "Đang thực hiện")
            return recalculateTeamAssignment(team, next, now());
          if (status === "Hoàn thành" || status === "Đã hủy")
            return recalculateTeamAssignment(team, next, now());
          return team;
        }),
      );
      pushTeamEvent(
        task.teamId,
        `${taskId} chuyển sang ${status.toUpperCase()}`,
        "task_status",
        task.teamId,
      );
    }
    pushEvent(
      task.incidentId,
      `${taskId} chuyển sang ${status.toUpperCase()}`,
      "task_status",
      task.teamId || actorName,
    );
    const linkedSos = sosRequests.find((item) => item.linkedTaskId === taskId);
    if (linkedSos) {
      if (status === "Đang thực hiện") {
        setSosRequests((current) =>
          current.map((item) =>
            item.id === linkedSos.id && item.status === "Đã điều phối"
              ? transitionSos(item, "Đang cứu hộ", now())
              : item,
          ),
        );
        pushSosEvent(
          linkedSos.id,
          `Đội ${task.teamId} bắt đầu cứu hộ theo ${taskId}`,
          "rescue",
          task.teamId || actorName,
        );
      } else if (status === "Hoàn thành") {
        setSosRequests((current) =>
          current.map((item) =>
            item.id === linkedSos.id &&
            ["Đang cứu hộ", "Đã điều phối"].includes(item.status)
              ? applySosResolution(
                  item,
                  `Nhiệm vụ ${taskId} hoàn thành, người yêu cầu đã được hỗ trợ.`,
                  now(),
                )
              : item,
          ),
        );
        pushSosEvent(
          linkedSos.id,
          `Nhiệm vụ ${taskId} hoàn thành, chuyển SOS sang đã xử lý`,
          "resolved",
        );
      } else if (status === "Đã hủy") {
        setSosRequests((current) =>
          current.map((item) =>
            item.id === linkedSos.id
              ? {
                  ...item,
                  status: "Đã xác minh",
                  linkedTaskId: null,
                  assignedTeamId: null,
                  lastUpdatedAt: now(),
                }
              : item,
          ),
        );
        pushSosEvent(
          linkedSos.id,
          `Nhiệm vụ ${taskId} bị hủy, yêu cầu chờ điều phối lại`,
          "task_cancel",
        );
      }
    }
  };
  const updateTaskProgress = (taskId: string, progress: number) => {
    enforcePermission("task_update", taskResources(taskId));
    const task = tasks.find((item) => item.id === taskId);
    if (!task || ["Hoàn thành", "Đã hủy"].includes(task.status)) return;
    const value = Math.max(0, Math.min(100, progress));
    const entersExecution = value > 0 && task.status === "Đã tiếp nhận";
    const next = tasks.map((item) =>
      item.id === taskId
        ? {
            ...item,
            progress: value,
            status: (entersExecution
              ? "Đang thực hiện"
              : item.status) as TaskStatus,
            updatedAt: now(),
          }
        : item,
    );
    setTasks(next);
    syncRecoveryProjects(next);
    if (entersExecution && task.teamId) {
      setTeams((current) =>
        current.map((team) =>
          team.id === task.teamId
            ? recalculateTeamAssignment(team, next, now())
            : team,
        ),
      );
      pushTeamEvent(
        task.teamId,
        `${taskId} bắt đầu thực hiện qua cập nhật tiến độ`,
        "task_status",
        task.teamId,
      );
      const linkedSos = sosRequests.find(
        (item) => item.linkedTaskId === taskId,
      );
      if (linkedSos) {
        setSosRequests((current) =>
          current.map((item) =>
            item.id === linkedSos.id && item.status === "Đã điều phối"
              ? transitionSos(item, "Đang cứu hộ", now())
              : item,
          ),
        );
        pushSosEvent(
          linkedSos.id,
          `Bắt đầu cứu hộ theo tiến độ ${taskId}`,
          "rescue",
          task.teamId,
        );
      }
    }
    syncIncidentProgress(task.incidentId, next);
    pushEvent(
      task.incidentId,
      `Cập nhật tiến độ ${taskId} lên ${value}%`,
      "task_progress",
      task.teamId || actorName,
    );
  };

  const addTaskUpdate = (
    taskId: string,
    message: string,
    location?: string,
    networkStatus: TaskUpdate["networkStatus"] = "Đã đồng bộ",
  ) => {
    enforcePermission("task_update", taskResources(taskId));
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    const update: TaskUpdate = {
      // Executed only inside an event-handler mutation command, never during render.
      // oxlint-disable-next-line react/purity
      id: `TU-${Date.now()}`,
      taskId,
      incidentId: task.incidentId,
      timestamp: timeOnly(),
      actor: task.assignee || actorName,
      teamId: task.teamId,
      message,
      location,
      source: "Ứng dụng hiện trường",
      networkStatus,
    };
    setTaskUpdates((current) => [update, ...current]);
    setTasks((current) =>
      current.map((item) =>
        item.id === taskId ? { ...item, updatedAt: now() } : item,
      ),
    );
    if (task.teamId)
      pushTeamEvent(
        task.teamId,
        `${taskId}: ${message}`,
        "field_update",
        task.teamId,
        "Ứng dụng hiện trường",
      );
    pushEvent(
      task.incidentId,
      `${taskId}: ${message}`,
      "field_update",
      task.teamId || actorName,
    );
  };
  const dispatchTeamToTask = (
    teamId: string,
    taskId: string,
    incidentId: string,
    priority: TaskPriority,
    destination: string,
    note: string,
  ) => {
    enforcePermission(
      "team_assign",
      [
        ...taskResources(taskId),
        teamResource(teamId),
        incidentResource(incidentId),
      ],
      "điều phối đa tài nguyên",
    );
    const team = teams.find((item) => item.id === teamId);
    const task = tasks.find((item) => item.id === taskId);
    const incident = incidents.find((item) => item.id === incidentId);
    if (!team || !task || !incident)
      throw new Error("Dữ liệu điều phối không hợp lệ.");
    assertTeamDispatchable(team, taskId);
    const assigned = assignTaskToTeam(
      task,
      {
        teamId,
        teamLeader: team.leader,
        assignee: team.leader,
        incidentId,
        priority,
        location: destination,
      },
      now(),
    );
    const next = tasks.map((item) => (item.id === taskId ? assigned : item));
    setTasks(next);
    setTeams((current) =>
      current.map((item) => {
        if (item.id === teamId)
          return assignTeamToOperation(item, taskId, incidentId, now());
        if (task.teamId && task.teamId !== teamId && item.id === task.teamId)
          return recalculateTeamAssignment(item, next, now());
        return item;
      }),
    );
    setIncidents((current) =>
      current.map((item) =>
        item.id === incidentId
          ? {
              ...item,
              assignedTeamId: item.assignedTeamId ?? teamId,
              updatedAt: now(),
            }
          : item,
      ),
    );
    syncIncidentProgress(incidentId, next);
    const message = `Điều phối ${teamId} thực hiện ${taskId} tới ${destination}${note ? `: ${note}` : ""}`;
    pushTeamEvent(teamId, message, "dispatch");
    pushEvent(incidentId, message, "team_dispatch");
  };
  const updateTeamStatus = (teamId: string, status: TeamStatus) => {
    enforcePermission("team_update_status", [teamResource(teamId)]);
    const team = teams.find((item) => item.id === teamId);
    if (!team) return;
    const changed = changeTeamStatus(team, status, now());
    setTeams((current) =>
      current.map((item) => (item.id === teamId ? changed : item)),
    );
    pushTeamEvent(
      teamId,
      `Chuyển trạng thái đội sang ${status.toUpperCase()}`,
      "status",
    );
  };
  const updateTeamLocation = (teamId: string, location: TeamLocation) => {
    enforcePermission("team_update_location", [teamResource(teamId)]);
    setTeams((current) =>
      current.map((item) =>
        item.id === teamId ? applyTeamLocation(item, location, now()) : item,
      ),
    );
    pushTeamEvent(
      teamId,
      `Cập nhật vị trí đội với độ chính xác ±${location.accuracy} m`,
      "location",
      teamId,
      location.source,
    );
  };
  const updateTeamProfile = (teamId: string, input: TeamProfileInput) => {
    enforcePermission("team_edit", [teamResource(teamId)]);
    const team = teams.find((item) => item.id === teamId);
    if (!team) return;
    const changed = applyTeamProfile(team, input, now());
    setTeams((current) =>
      current.map((item) => (item.id === teamId ? changed : item)),
    );
    if (input.leader !== team.leader)
      setTasks((current) =>
        current.map((task) =>
          task.teamId === teamId &&
          !["Hoàn thành", "Đã hủy"].includes(task.status)
            ? {
                ...task,
                teamLeader: input.leader,
                assignee:
                  task.assignee === team.leader ? input.leader : task.assignee,
                updatedAt: now(),
              }
            : task,
        ),
      );
    pushTeamEvent(
      teamId,
      "Cập nhật hồ sơ và phạm vi hoạt động của đội",
      "profile",
    );
  };
  const updateTeamCapabilities = (teamId: string, capabilities: string[]) => {
    enforcePermission("team_edit", [teamResource(teamId)]);
    const team = teams.find((item) => item.id === teamId);
    if (!team) return;
    const changed = applyTeamCapabilities(team, capabilities, now());
    setTeams((current) =>
      current.map((item) => (item.id === teamId ? changed : item)),
    );
    pushTeamEvent(
      teamId,
      `Cập nhật ${capabilities.length} năng lực tác chiến`,
      "capability",
    );
  };
  const releaseTeamFromTask = (teamId: string) => {
    const team = teams.find((item) => item.id === teamId);
    const task = tasks.find((item) => item.id === team?.currentTask);
    if (!team || !task)
      throw new Error("Đội không có nhiệm vụ để gỡ phân công.");
    enforcePermission(
      "team_assign",
      [...taskResources(task.id), teamResource(teamId)],
      "gỡ phân công đội khỏi nhiệm vụ",
    );
    const released = releaseTaskAssignment(task, now());
    const next = tasks.map((item) => (item.id === task.id ? released : item));
    setTasks(next);
    const changed = recalculateTeamAssignment(team, next, now());
    setTeams((current) =>
      current.map((item) => (item.id === teamId ? changed : item)),
    );
    const replacementTeam =
      next.find(
        (item) =>
          item.incidentId === task.incidentId &&
          item.teamId &&
          item.teamId !== teamId &&
          !["Hoàn thành", "Đã hủy"].includes(item.status),
      )?.teamId ?? null;
    setIncidents((current) =>
      current.map((item) =>
        item.id === task.incidentId && item.assignedTeamId === teamId
          ? { ...item, assignedTeamId: replacementTeam, updatedAt: now() }
          : item,
      ),
    );
    pushTeamEvent(
      teamId,
      `Kết thúc điều phối và gỡ khỏi nhiệm vụ ${task.id}`,
      "release",
    );
    pushEvent(
      task.incidentId,
      `Gỡ ${teamId} khỏi nhiệm vụ ${task.id}`,
      "team_release",
    );
    syncIncidentProgress(task.incidentId, next);
  };
  const updateShelterCapacity = (
    shelterId: string,
    capacity: number,
    reservedCapacity: number,
  ) => {
    enforcePermission("shelter_manage_capacity", [shelterResource(shelterId)]);
    const shelter = shelters.find((item) => item.id === shelterId);
    if (!shelter) return;
    const changed = applyShelterCapacity(
      shelter,
      capacity,
      reservedCapacity,
      now(),
    );
    setShelters((current) =>
      current.map((item) => (item.id === shelterId ? changed : item)),
    );
    pushShelterEvent(
      shelterId,
      `Cập nhật sức chứa ${capacity} chỗ, dự phòng ${reservedCapacity} chỗ`,
      "capacity",
    );
  };
  const updateShelterOccupancy = (shelterId: string, occupancy: number) => {
    enforcePermission("shelter_update", [shelterResource(shelterId)]);
    const shelter = shelters.find((item) => item.id === shelterId);
    if (!shelter) return;
    const changed = applyShelterOccupancy(shelter, occupancy, now());
    setShelters((current) =>
      current.map((item) => (item.id === shelterId ? changed : item)),
    );
    pushShelterEvent(
      shelterId,
      `Cập nhật số người đang tiếp nhận: ${occupancy}`,
      "occupancy",
    );
  };
  const setShelterOpen = (shelterId: string, open: boolean) => {
    enforcePermission(open ? "shelter_open" : "shelter_close", [
      shelterResource(shelterId),
    ]);
    const shelter = shelters.find((item) => item.id === shelterId);
    if (!shelter) return;
    const changed = open
      ? openShelter(shelter, now())
      : closeShelter(shelter, now());
    setShelters((current) =>
      current.map((item) => (item.id === shelterId ? changed : item)),
    );
    pushShelterEvent(
      shelterId,
      open ? "Mở điểm sơ tán để tiếp nhận" : "Tạm đóng điểm sơ tán",
      open ? "open" : "close",
    );
  };
  const updateShelterResources = (
    shelterId: string,
    input: ShelterResourceInput,
  ) => {
    enforcePermission("shelter_update", [shelterResource(shelterId)]);
    const shelter = shelters.find((item) => item.id === shelterId);
    if (!shelter) return;
    const changed = applyShelterResources(shelter, input, now());
    setShelters((current) =>
      current.map((item) => (item.id === shelterId ? changed : item)),
    );
    pushShelterEvent(
      shelterId,
      "Cập nhật điều kiện vận hành và nguồn lực",
      "resources",
    );
  };
  const createEvacuation = (input: NewEvacuationInput) => {
    enforcePermission("evacuation_create", [
      incidentResource(input.incidentId),
      shelterResource(input.destinationShelterId),
      { type: "Evacuation", id: "new", geographicScope: input.sourceArea },
    ]);
    const shelter = shelters.find(
      (item) => item.id === input.destinationShelterId,
    );
    const incident = incidents.find((item) => item.id === input.incidentId);
    if (!shelter || !incident)
      throw new Error("Sự cố hoặc điểm sơ tán không hợp lệ.");
    assertShelterCanReceive(shelter, input.estimatedPopulation);
    const number =
      Math.max(
        0,
        ...evacuationOperations.map(
          (item) => Number(item.id.replace(/\D/g, "")) || 0,
        ),
      ) + 1;
    const id = `EVAC-${String(number).padStart(3, "0")}`;
    const midpoint: [number, number] = [
      (input.sourceCoordinates[0] + shelter.coordinates[0]) / 2,
      (input.sourceCoordinates[1] + shelter.coordinates[1]) / 2,
    ];
    const route = {
      id: `RT-${String(number).padStart(3, "0")}`,
      name: `${input.sourceArea} – ${shelter.name}`,
      status: "Thông suốt" as const,
      distanceKm:
        Math.round(
          Math.hypot(
            input.sourceCoordinates[0] - shelter.coordinates[0],
            input.sourceCoordinates[1] - shelter.coordinates[1],
          ) *
            90 *
            10,
        ) / 10,
      estimatedMinutes: 30,
      coordinates: [input.sourceCoordinates, midpoint, shelter.coordinates],
      blockedSegments: [],
      alternativeCoordinates: [
        input.sourceCoordinates,
        [midpoint[0] + 0.008, midpoint[1] + 0.006],
        shelter.coordinates,
      ] as [number, number][],
      updatedAt: now(),
    };
    const operation = createEvacuationOperation(id, input, route, now());
    setEvacuationOperations((current) => [operation, ...current]);
    const changed = applyShelterCapacity(
      {
        ...shelter,
        reservedCapacity: shelter.reservedCapacity + input.estimatedPopulation,
      },
      shelter.capacity,
      shelter.reservedCapacity + input.estimatedPopulation,
      now(),
    );
    setShelters((current) =>
      current.map((item) =>
        item.id === shelter.id
          ? {
              ...changed,
              linkedIncidentIds: [
                ...new Set([...changed.linkedIncidentIds, input.incidentId]),
              ],
              activeEvacuationOperationIds: [
                ...changed.activeEvacuationOperationIds,
                id,
              ],
            }
          : item,
      ),
    );
    pushShelterEvent(
      shelter.id,
      `Dự kiến tiếp nhận ${input.estimatedPopulation} người từ ${input.sourceArea}`,
      "reservation",
    );
    pushEvacuationEvent(
      id,
      `Tạo phương án sơ tán tới ${shelter.id}`,
      "created",
    );
    pushEvent(
      input.incidentId,
      `Tạo hoạt động ${id}, dự kiến sơ tán ${input.estimatedPopulation} người tới ${shelter.id}`,
      "evacuation",
    );
    return id;
  };
  const transitionEvacuation = (
    operationId: string,
    status: EvacuationStatus,
  ) => {
    const permission: Permission =
      status === "Đã phê duyệt"
        ? "evacuation_approve"
        : status === "Hoàn thành"
          ? "evacuation_complete"
          : status === "Đã hủy"
            ? "evacuation_cancel"
            : "evacuation_update";
    enforcePermission(permission, evacuationResources(operationId));
    const operation = evacuationOperations.find(
      (item) => item.id === operationId,
    );
    if (!operation) return;
    const changed = applyEvacuationTransition(operation, status, now());
    setEvacuationOperations((current) =>
      current.map((item) => (item.id === operationId ? changed : item)),
    );
    if (status === "Đang triển khai" && operation.assignedTeamId)
      setTeams((current) =>
        current.map((team) =>
          team.id === operation.assignedTeamId
            ? changeTeamStatus(team, "Đang thực hiện", now())
            : team,
        ),
      );
    if (status === "Hoàn thành" || status === "Đã hủy") {
      const remaining =
        operation.estimatedPopulation - operation.evacuatedPopulation;
      setShelters((current) =>
        current.map((shelter) => {
          if (shelter.id !== operation.destinationShelterId) return shelter;
          const occupancy =
            status === "Hoàn thành"
              ? shelter.currentOccupancy + remaining
              : shelter.currentOccupancy;
          const next = applyShelterOccupancy(
            {
              ...shelter,
              reservedCapacity: Math.max(
                0,
                shelter.reservedCapacity - remaining,
              ),
            },
            occupancy,
            now(),
          );
          return {
            ...next,
            activeEvacuationOperationIds:
              next.activeEvacuationOperationIds.filter(
                (id) => id !== operationId,
              ),
          };
        }),
      );
      if (operation.assignedTeamId)
        setTeams((current) =>
          current.map((team) =>
            team.id === operation.assignedTeamId
              ? releaseTeamFromEvacuation(team, now())
              : team,
          ),
        );
    }
    pushEvacuationEvent(
      operationId,
      `Chuyển trạng thái hoạt động sang ${status.toUpperCase()}`,
      "status",
    );
    pushEvent(
      operation.incidentId,
      `${operationId} chuyển sang ${status.toUpperCase()}`,
      "evacuation_status",
    );
  };
  const assignEvacuationTeam = (operationId: string, teamId: string) => {
    enforcePermission(
      "evacuation_assign",
      [...evacuationResources(operationId), teamResource(teamId)],
      "gán đội cho sơ tán",
    );
    const operation = evacuationOperations.find(
      (item) => item.id === operationId,
    );
    const team = teams.find((item) => item.id === teamId);
    if (!operation || !team)
      throw new Error("Hoạt động hoặc đội cứu hộ không hợp lệ.");
    if (operation.assignedTeamId === teamId) return;
    const assigned = applyEvacuationTeam(operation, teamId, now());
    const changedTeam = assignTeamToEvacuation(
      team,
      operationId,
      operation.incidentId,
      now(),
    );
    setEvacuationOperations((current) =>
      current.map((item) => (item.id === operationId ? assigned : item)),
    );
    setTeams((current) =>
      current.map((item) =>
        item.id === teamId
          ? changedTeam
          : item.id === operation.assignedTeamId
            ? releaseTeamFromEvacuation(item, now())
            : item,
      ),
    );
    pushEvacuationEvent(
      operationId,
      `Gán ${teamId} phụ trách hoạt động`,
      "assignment",
    );
    pushTeamEvent(
      teamId,
      `Được phân công hoạt động sơ tán ${operationId}`,
      "evacuation",
    );
  };
  const updateEvacuationProgress = (operationId: string, evacuated: number) => {
    enforcePermission("evacuation_update", evacuationResources(operationId));
    const operation = evacuationOperations.find(
      (item) => item.id === operationId,
    );
    if (!operation) return;
    const changed = applyEvacuationProgress(operation, evacuated, now());
    const delta = evacuated - operation.evacuatedPopulation;
    setEvacuationOperations((current) =>
      current.map((item) => (item.id === operationId ? changed : item)),
    );
    if (delta !== 0)
      setShelters((current) =>
        current.map((shelter) =>
          shelter.id === operation.destinationShelterId
            ? applyShelterOccupancy(
                {
                  ...shelter,
                  reservedCapacity: Math.max(
                    0,
                    shelter.reservedCapacity - delta,
                  ),
                },
                shelter.currentOccupancy + delta,
                now(),
              )
            : shelter,
        ),
      );
    pushEvacuationEvent(
      operationId,
      `Cập nhật đã sơ tán ${evacuated}/${operation.estimatedPopulation} người`,
      "progress",
      operation.assignedTeamId ?? actorName,
    );
  };
  const updateEvacuationRoute = (operationId: string, status: RouteStatus) => {
    enforcePermission("evacuation_update", evacuationResources(operationId));
    const operation = evacuationOperations.find(
      (item) => item.id === operationId,
    );
    if (!operation) return;
    const changed = applyRouteStatus(operation, status, now());
    setEvacuationOperations((current) =>
      current.map((item) => (item.id === operationId ? changed : item)),
    );
    pushEvacuationEvent(
      operationId,
      status === "Bị chặn"
        ? "Tuyến đang sử dụng bị chặn, tạm dừng hoạt động"
        : `Cập nhật trạng thái tuyến: ${status}`,
      "route",
    );
    if (status === "Bị chặn")
      pushEvent(
        operation.incidentId,
        `${operationId} tạm dừng do tuyến sơ tán bị chặn`,
        "route_blocked",
      );
  };
  const redirectEvacuation = (operationId: string, shelterId: string) => {
    enforcePermission(
      "evacuation_update",
      [...evacuationResources(operationId), shelterResource(shelterId)],
      "chuyển hướng sơ tán",
    );
    const operation = evacuationOperations.find(
      (item) => item.id === operationId,
    );
    const oldShelter = shelters.find(
      (item) => item.id === operation?.destinationShelterId,
    );
    const shelter = shelters.find((item) => item.id === shelterId);
    if (!operation || !oldShelter || !shelter)
      throw new Error("Hoạt động hoặc điểm sơ tán không hợp lệ.");
    const remaining =
      operation.estimatedPopulation - operation.evacuatedPopulation;
    assertShelterCanReceive(shelter, remaining);
    const route = {
      ...operation.route,
      id: `${operation.route.id}-ALT`,
      name: `${operation.sourceArea} – ${shelter.name}`,
      status: "Đang dùng tuyến thay thế" as const,
      coordinates: operation.route.alternativeCoordinates.length
        ? operation.route.alternativeCoordinates
        : [operation.sourceCoordinates, shelter.coordinates],
      alternativeCoordinates: operation.route.coordinates,
      blockedSegments: operation.route.blockedSegments,
      updatedAt: now(),
    };
    const changed = applyEvacuationRedirect(operation, shelterId, route, now());
    setEvacuationOperations((current) =>
      current.map((item) => (item.id === operationId ? changed : item)),
    );
    setShelters((current) =>
      current.map((item) => {
        if (item.id === oldShelter.id)
          return {
            ...applyShelterCapacity(
              {
                ...item,
                reservedCapacity: Math.max(
                  0,
                  item.reservedCapacity - remaining,
                ),
              },
              item.capacity,
              Math.max(0, item.reservedCapacity - remaining),
              now(),
            ),
            activeEvacuationOperationIds:
              item.activeEvacuationOperationIds.filter(
                (id) => id !== operationId,
              ),
          };
        if (item.id === shelterId)
          return {
            ...applyShelterCapacity(
              { ...item, reservedCapacity: item.reservedCapacity + remaining },
              item.capacity,
              item.reservedCapacity + remaining,
              now(),
            ),
            linkedIncidentIds: [
              ...new Set([...item.linkedIncidentIds, operation.incidentId]),
            ],
            activeEvacuationOperationIds: [
              ...new Set([...item.activeEvacuationOperationIds, operationId]),
            ],
          };
        return item;
      }),
    );
    pushEvacuationEvent(
      operationId,
      `Chuyển hướng từ ${oldShelter.id} tới ${shelterId}`,
      "redirect",
    );
    pushShelterEvent(
      shelterId,
      `Tiếp nhận chuyển hướng ${remaining} người từ ${oldShelter.id}`,
      "redirect",
    );
  };
  const verifySos = (sosId: string) => {
    enforcePermission("sos_verify", [sosResource(sosId)]);
    const sos = sosRequests.find((item) => item.id === sosId);
    if (!sos) return;
    assertSosScope(role, sos.location.administrativeArea, currentScopeName);
    const changed = applySosVerification(sos, now());
    setSosRequests((current) =>
      current.map((item) => (item.id === sosId ? changed : item)),
    );
    pushSosEvent(sosId, "Hoàn tất xác minh thông tin SOS", "verified");
  };
  const rejectSos = (sosId: string) => {
    enforcePermission("sos_verify", [sosResource(sosId)]);
    const sos = sosRequests.find((item) => item.id === sosId);
    if (!sos) return;
    const changed = transitionSos(sos, "Từ chối", now());
    setSosRequests((current) =>
      current.map((item) => (item.id === sosId ? changed : item)),
    );
    pushSosEvent(sosId, "Từ chối SOS sau xác minh", "rejected");
  };
  const linkSosToIncident = (sosId: string, incidentId: string) => {
    enforcePermission("sos_assign_incident", [
      sosResource(sosId),
      incidentResource(incidentId),
    ]);
    const sos = sosRequests.find((item) => item.id === sosId);
    const incident = incidents.find((item) => item.id === incidentId);
    if (!sos || !incident) throw new Error("SOS hoặc sự cố không hợp lệ.");
    const changed = applySosIncident(sos, incidentId, now());
    setSosRequests((current) =>
      current.map((item) => (item.id === sosId ? changed : item)),
    );
    pushSosEvent(sosId, `Liên kết với sự cố ${incidentId}`, "incident");
    pushEvent(
      incidentId,
      `Liên kết yêu cầu ${sosId}: ${sos.description}`,
      "sos",
    );
  };
  const createIncidentFromSos = (sosId: string) => {
    enforcePermission("sos_assign_incident", [sosResource(sosId)]);
    const sos = sosRequests.find((item) => item.id === sosId);
    if (!sos) throw new Error("Không tìm thấy SOS.");
    if (sos.linkedIncidentId) throw new Error("SOS đã liên kết với một sự cố.");
    const mapped = incidentInputFromSos(sos);
    const id = createIncident(mapped.input);
    setIncidents((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              affectedPopulation: mapped.affectedPopulation,
              affectedArea: sos.location.administrativeArea,
              source: mapped.source,
            }
          : item,
      ),
    );
    setSosRequests((current) =>
      current.map((item) =>
        item.id === sosId ? applySosIncident(item, id, now()) : item,
      ),
    );
    pushSosEvent(sosId, `Tạo và liên kết sự cố ${id}`, "incident_created");
    pushEvent(
      id,
      `Sự cố được tạo từ ${sosId}, ${sos.peopleAtRisk} người gặp nguy hiểm`,
      "sos",
    );
    return id;
  };
  const createRescueTaskFromSos = (sosId: string, teamId: string) => {
    const sos = sosRequests.find((item) => item.id === sosId);
    enforcePermission("sos_create_task", [
      sosResource(sosId),
      teamResource(teamId),
    ]);
    enforcePermission(
      "sos_dispatch",
      [
        sosResource(sosId),
        teamResource(teamId),
        ...(sos?.linkedIncidentId
          ? [incidentResource(sos.linkedIncidentId)]
          : []),
      ],
      "điều phối SOS cho đội",
    );
    if (!sos || !sos.linkedIncidentId)
      throw new Error("Phải liên kết SOS với sự cố trước khi tạo nhiệm vụ.");
    if (sos.verificationStatus !== "Đã xác minh")
      throw new Error("Phải xác minh SOS trước khi điều phối.");
    const id = createTask(taskInputFromSos(sos, teamId));
    setSosRequests((current) =>
      current.map((item) =>
        item.id === sosId ? linkSosTaskAndTeam(item, id, teamId, now()) : item,
      ),
    );
    pushSosEvent(sosId, `Tạo nhiệm vụ ${id} và giao cho ${teamId}`, "dispatch");
    return id;
  };
  const updateSosPriority = (sosId: string, priority: SosPriority) => {
    enforcePermission("sos_triage", [sosResource(sosId)]);
    const sos = sosRequests.find((item) => item.id === sosId);
    if (!sos) return;
    const changed = retriageSos(sos, now(), priority);
    setSosRequests((current) =>
      current.map((item) => (item.id === sosId ? changed : item)),
    );
    pushSosEvent(sosId, `Điều chỉnh ưu tiên thành ${priority}`, "triage");
  };
  const updateSosLocation = (sosId: string, location: SosLocation) => {
    enforcePermission("sos_update_field", [sosResource(sosId)]);
    const sos = sosRequests.find((item) => item.id === sosId);
    if (!sos) return;
    assertSosScope(role, location.administrativeArea, currentScopeName);
    const changed = applySosLocation(sos, location, now());
    setSosRequests((current) =>
      current.map((item) => (item.id === sosId ? changed : item)),
    );
    pushSosEvent(sosId, `Cập nhật vị trí: ${location.address}`, "location");
  };
  const addSosUpdate = (sosId: string, message: string) => {
    enforcePermission("sos_update_field", [sosResource(sosId)]);
    if (!message.trim())
      throw new Error("Nội dung diễn biến không được để trống.");
    setSosRequests((current) =>
      current.map((item) =>
        item.id === sosId ? { ...item, lastUpdatedAt: now() } : item,
      ),
    );
    pushSosEvent(sosId, message, "field");
  };
  const markSosNoContact = (sosId: string) => {
    enforcePermission("sos_update", [sosResource(sosId)]);
    const sos = sosRequests.find((item) => item.id === sosId);
    if (!sos) return;
    const changed = transitionSos(sos, "Không liên lạc được", now());
    setSosRequests((current) =>
      current.map((item) => (item.id === sosId ? changed : item)),
    );
    pushSosEvent(
      sosId,
      "Không thể liên lạc với người báo tin",
      "communication",
    );
  };
  const routeSosToShelter = (sosId: string, shelterId: string) => {
    const sos = sosRequests.find((item) => item.id === sosId);
    if (!sos || !sos.linkedIncidentId)
      throw new Error(
        "Phải liên kết SOS với sự cố trước khi tạo hoạt động sơ tán.",
      );
    enforcePermission("evacuation_create", [
      sosResource(sosId),
      incidentResource(sos.linkedIncidentId),
      shelterResource(shelterId),
    ]);
    const id = createEvacuation(evacuationInputFromSos(sos, shelterId));
    setSosRequests((current) =>
      current.map((item) =>
        item.id === sosId
          ? {
              ...item,
              shelterDestinationId: shelterId,
              linkedEvacuationOperationId: id,
              lastUpdatedAt: now(),
            }
          : item,
      ),
    );
    pushSosEvent(
      sosId,
      `Chuyển ${sos.peopleAtRisk} người vào hoạt động ${id} tới ${shelterId}`,
      "evacuation",
    );
    return id;
  };
  const resolveSos = (sosId: string, summary: string) => {
    const sos = sosRequests.find((item) => item.id === sosId);
    enforcePermission("sos_resolve", [
      sosResource(sosId),
      ...(sos?.linkedTaskId ? taskResources(sos.linkedTaskId) : []),
    ]);
    if (!sos) return;
    const linkedTask = tasks.find((item) => item.id === sos.linkedTaskId);
    if (linkedTask?.status === "Đã hủy")
      throw new Error(
        "Nhiệm vụ cứu hộ đã bị hủy; cần điều phối lại trước khi xử lý SOS.",
      );
    if (linkedTask && linkedTask.status !== "Hoàn thành")
      transitionTask(linkedTask.id, "Hoàn thành");
    const changed = applySosResolution(sos, summary, now());
    setSosRequests((current) =>
      current.map((item) => (item.id === sosId ? changed : item)),
    );
    pushSosEvent(sosId, `Đánh dấu đã xử lý: ${summary}`, "resolved");
  };
  const cancelSos = (sosId: string) => {
    enforcePermission("sos_cancel", [sosResource(sosId)]);
    const sos = sosRequests.find((item) => item.id === sosId);
    if (!sos) return;
    const changed = transitionSos(sos, "Hủy", now());
    setSosRequests((current) =>
      current.map((item) => (item.id === sosId ? changed : item)),
    );
    pushSosEvent(
      sosId,
      "Hủy yêu cầu SOS theo quyết định điều hành",
      "cancelled",
    );
  };
  const closeSos = (sosId: string) => {
    enforcePermission("sos_close", [sosResource(sosId)]);
    const sos = sosRequests.find((item) => item.id === sosId);
    if (!sos) return;
    const changed = transitionSos(sos, "Đã đóng", now());
    setSosRequests((current) =>
      current.map((item) => (item.id === sosId ? changed : item)),
    );
    pushSosEvent(sosId, "Xác nhận kết quả và đóng SOS", "closed");
  };
  const createReliefRequest = (input: NewReliefRequestInput) => {
    enforcePermission("relief_create", [
      { type: "ReliefRequest", id: "new", geographicScope: input.destination },
      ...(input.incidentId ? [incidentResource(input.incidentId)] : []),
      ...(input.shelterId ? [shelterResource(input.shelterId)] : []),
      ...(input.evacuationOperationId
        ? evacuationResources(input.evacuationOperationId)
        : []),
      ...(input.teamId ? [teamResource(input.teamId)] : []),
    ]);
    assertReliefScope(role, input.destination, currentScopeName);
    const number =
      Math.max(
        240,
        ...reliefRequests.map(
          (item) => Number(item.id.replace(/\D/g, "")) || 0,
        ),
      ) + 1;
    const id = `REQ-${String(number).padStart(4, "0")}`;
    const request = createReliefEntity(id, input, now());
    setReliefRequests((current) => [request, ...current]);
    pushReliefEvent(
      "request",
      id,
      `Tạo yêu cầu cứu trợ cho ${input.destination}`,
      "created",
    );
    if (input.incidentId)
      pushEvent(
        input.incidentId,
        `Tạo yêu cầu cứu trợ ${id}: ${input.justification}`,
        "relief",
      );
    return id;
  };
  const transitionReliefRequest = (
    requestId: string,
    status: ReliefRequestStatus,
  ) => {
    const permission: Permission =
      status === "Từ chối"
        ? "relief_approve"
        : status === "Hủy"
          ? "relief_cancel"
          : status === "Đã đóng"
            ? "relief_receive"
            : status === "Đã gửi"
              ? "relief_create"
              : "relief_approve";
    enforcePermission(permission, [reliefRequestResource(requestId)]);
    const request = reliefRequests.find((item) => item.id === requestId);
    if (!request) return;
    const changed = applyReliefTransition(request, status, now(), {
      reservations,
      shipments,
    });
    setReliefRequests((current) =>
      current.map((item) => (item.id === requestId ? changed : item)),
    );
    if (status === "Hủy") {
      const active = reservations.filter(
        (item) =>
          item.reliefRequestId === requestId && item.status === "Đang giữ",
      );
      let nextInventory = inventory;
      const releasedIds = new Set<string>();
      active.forEach((reservation) => {
        const result = releaseReservation(reservation, nextInventory, now());
        nextInventory = result.inventory;
        releasedIds.add(reservation.id);
      });
      setInventory(nextInventory);
      setReservations((current) =>
        current.map((item) =>
          releasedIds.has(item.id)
            ? { ...item, status: "Đã giải phóng", releasedAt: now() }
            : item,
        ),
      );
    }
    pushReliefEvent(
      "request",
      requestId,
      `Chuyển trạng thái yêu cầu sang ${status.toUpperCase()}`,
      "status",
    );
  };
  const approveReliefRequest = (
    requestId: string,
    approved: Record<string, number>,
  ) => {
    enforcePermission("relief_approve", [reliefRequestResource(requestId)]);
    const request = reliefRequests.find((item) => item.id === requestId);
    if (!request) return;
    const changed = applyReliefApproval(request, approved, actorName, now());
    setReliefRequests((current) =>
      current.map((item) => (item.id === requestId ? changed : item)),
    );
    pushReliefEvent(
      "request",
      requestId,
      "Phê duyệt phân bổ vật tư",
      "approved",
    );
  };
  const reserveReliefStock = (
    requestId: string,
    warehouseId: string,
    allocations: Array<{ itemCode: string; quantity: number }>,
  ) => {
    enforcePermission(
      "relief_reserve",
      [reliefRequestResource(requestId), warehouseResource(warehouseId)],
      "giữ hàng tại kho",
    );
    const request = reliefRequests.find((item) => item.id === requestId);
    const warehouse = warehouses.find((item) => item.id === warehouseId);
    if (!request || !warehouse)
      throw new Error("Yêu cầu hoặc kho không hợp lệ.");
    assertReliefScope(role, warehouse.administrativeArea, currentScopeName);
    const id = `RES-${requestId.replace("REQ-", "")}-${String(reservations.filter((item) => item.reliefRequestId === requestId).length + 1).padStart(2, "0")}`;
    const result = reserveStock(
      id,
      request,
      warehouse,
      inventory,
      allocations,
      now(),
    );
    setInventory(result.inventory);
    setReservations((current) => [result.reservation, ...current]);
    setReliefRequests((current) =>
      current.map((item) =>
        item.id === requestId
          ? {
              ...item,
              status: "Đã giữ hàng",
              assignedWarehouseIds: [
                ...new Set([...item.assignedWarehouseIds, warehouseId]),
              ],
              lastUpdatedAt: now(),
            }
          : item,
      ),
    );
    pushReliefEvent(
      "request",
      requestId,
      `Giữ hàng tại ${warehouseId}: ${result.reservation.items.map((item) => `${item.quantity} ${item.unit} ${item.name}`).join(", ")}`,
      "reservation",
    );
    pushReliefEvent(
      "warehouse",
      warehouseId,
      `Giữ hàng cho ${requestId}`,
      "reservation",
    );
    return id;
  };
  const dispatchReliefReservation = (
    reservationId: string,
    teamId: string | null = null,
  ) => {
    enforcePermission(
      "relief_dispatch",
      [
        ...reservationResources(reservationId),
        ...(teamId ? [teamResource(teamId)] : []),
      ],
      "xuất kho và điều phối vận chuyển",
    );
    const reservation = reservations.find((item) => item.id === reservationId);
    const request = reliefRequests.find(
      (item) => item.id === reservation?.reliefRequestId,
    );
    const warehouse = warehouses.find(
      (item) => item.id === reservation?.warehouseId,
    );
    if (!reservation || !request || !warehouse)
      throw new Error("Phiếu giữ hàng không hợp lệ.");
    assertReliefScope(role, warehouse.administrativeArea, currentScopeName);
    const team = teamId ? teams.find((item) => item.id === teamId) : undefined;
    if (team) assertTeamDispatchable(team);
    const number =
      Math.max(
        240,
        ...shipments.map((item) => Number(item.id.replace(/\D/g, "")) || 0),
      ) + 1;
    const id = `SHP-${String(number).padStart(4, "0")}`;
    const midpoint: [number, number] = [
      (warehouse.coordinates[0] + request.destinationCoordinates[0]) / 2,
      (warehouse.coordinates[1] + request.destinationCoordinates[1]) / 2,
    ];
    const result = applyReservationDispatch(
      id,
      reservation,
      request,
      warehouse,
      inventory,
      {
        assignedTeamId: teamId,
        method: team ? "Phương tiện của đội cứu hộ" : "Xe vận tải kho",
        driver: team?.leader ?? warehouse.responsibleOfficer.name,
        contact: team?.contact ?? warehouse.contact,
        estimatedArrival: "21/08/2026 12:30",
        routeCoordinates: [
          warehouse.coordinates,
          midpoint,
          request.destinationCoordinates,
        ],
      },
      now(),
    );
    setInventory(result.inventory);
    setReservations((current) =>
      current.map((item) =>
        item.id === reservationId ? result.reservation : item,
      ),
    );
    setShipments((current) => [result.shipment, ...current]);
    setReliefRequests((current) =>
      current.map((item) =>
        item.id === request.id
          ? {
              ...item,
              status: "Đã xuất kho",
              shipmentIds: [...item.shipmentIds, id],
              lastUpdatedAt: now(),
            }
          : item,
      ),
    );
    if (team)
      setTeams((current) =>
        current.map((item) =>
          item.id === team.id
            ? assignTeamToReliefShipment(item, id, request.incidentId, now())
            : item,
        ),
      );
    pushReliefEvent(
      "shipment",
      id,
      `Xuất hàng từ ${warehouse.id} tới ${request.destination}`,
      "dispatch",
    );
    pushReliefEvent(
      "request",
      request.id,
      `Tạo chuyến hàng ${id} từ ${warehouse.id}`,
      "dispatch",
    );
    return id;
  };
  const updateShipmentStatus = (
    shipmentId: string,
    status: ShipmentStatus,
    note?: string,
  ) => {
    enforcePermission("shipment_update", shipmentResources(shipmentId));
    const shipment = shipments.find((item) => item.id === shipmentId);
    if (!shipment) return;
    const changed = applyShipmentTransition(shipment, status, now(), note);
    const next = shipments.map((item) =>
      item.id === shipmentId ? changed : item,
    );
    setShipments(next);
    const request = reliefRequests.find(
      (item) => item.id === shipment.reliefRequestId,
    );
    if (request) {
      let requestStatus = request.status;
      if (status === "Đang vận chuyển") requestStatus = "Đang vận chuyển";
      if (
        (status === "Đã giao" || status === "Hoàn tất") &&
        next
          .filter((item) => item.reliefRequestId === request.id)
          .every((item) => ["Đã giao", "Hoàn tất"].includes(item.status))
      )
        requestStatus = "Đã giao";
      setReliefRequests((current) =>
        current.map((item) =>
          item.id === request.id
            ? { ...item, status: requestStatus, lastUpdatedAt: now() }
            : item,
        ),
      );
    }
    if (status === "Đang vận chuyển" && shipment.assignedTeamId)
      setTeams((current) =>
        current.map((team) =>
          team.id === shipment.assignedTeamId &&
          team.status === "Đang điều động"
            ? changeTeamStatus(team, "Đang thực hiện", now())
            : team,
        ),
      );
    if (status === "Hoàn tất" && shipment.assignedTeamId)
      setTeams((current) =>
        current.map((team) =>
          team.id === shipment.assignedTeamId
            ? releaseTeamFromReliefShipment(team, now())
            : team,
        ),
      );
    pushReliefEvent(
      "shipment",
      shipmentId,
      `Cập nhật chuyến hàng: ${status}${note ? ` — ${note}` : ""}`,
      "status",
    );
  };
  const confirmShipmentReceipt = (
    shipmentId: string,
    receiver: string,
    receiverRole: string,
    note: string,
  ) => {
    enforcePermission("relief_receive", shipmentResources(shipmentId));
    const shipment = shipments.find((item) => item.id === shipmentId);
    if (!shipment) return;
    const changed = applyShipmentReceipt(
      shipment,
      receiver,
      receiverRole,
      note,
      now(),
    );
    const next = shipments.map((item) =>
      item.id === shipmentId ? changed : item,
    );
    setShipments(next);
    const request = reliefRequests.find(
      (item) => item.id === shipment.reliefRequestId,
    );
    if (
      request &&
      next
        .filter((item) => item.reliefRequestId === request.id)
        .every((item) => Boolean(item.receipt))
    )
      setReliefRequests((current) =>
        current.map((item) =>
          item.id === request.id
            ? {
                ...item,
                status: "Đã xác nhận",
                receivedAt: now(),
                lastUpdatedAt: now(),
              }
            : item,
        ),
      );
    if (shipment.assignedTeamId)
      setTeams((current) =>
        current.map((team) =>
          team.id === shipment.assignedTeamId
            ? releaseTeamFromReliefShipment(team, now())
            : team,
        ),
      );
    pushReliefEvent(
      "shipment",
      shipmentId,
      `Xác nhận giao nhận bởi ${receiver}`,
      "receipt",
    );
  };
  const adjustWarehouseInventory = (itemId: string, quantityOnHand: number) => {
    enforcePermission("warehouse_adjust_stock", [
      warehouseResource(
        inventory.find((value) => value.id === itemId)?.warehouseId ??
          "missing",
      ),
    ]);
    const item = inventory.find((value) => value.id === itemId);
    if (!item) return;
    const itemWarehouse = warehouses.find(
      (value) => value.id === item.warehouseId,
    );
    if (itemWarehouse)
      assertReliefScope(
        role,
        itemWarehouse.administrativeArea,
        currentScopeName,
      );
    const changed = applyInventoryAdjustment(item, quantityOnHand, now());
    setInventory((current) =>
      current.map((value) => (value.id === itemId ? changed : value)),
    );
    pushReliefEvent(
      "warehouse",
      item.warehouseId,
      `Điều chỉnh tồn ${item.name}: ${quantityOnHand} ${item.unit}`,
      "stock",
    );
  };
  const setWarehouseStatus = (warehouseId: string, status: WarehouseStatus) => {
    enforcePermission(
      status === "Tạm đóng" ? "warehouse_close" : "warehouse_update",
      [warehouseResource(warehouseId)],
    );
    const warehouse = warehouses.find((item) => item.id === warehouseId);
    if (!warehouse) return;
    assertReliefScope(role, warehouse.administrativeArea, currentScopeName);
    if (
      status === "Tạm đóng" &&
      (reservations.some(
        (item) =>
          item.warehouseId === warehouseId && item.status === "Đang giữ",
      ) ||
        shipments.some(
          (item) =>
            item.warehouseId === warehouseId &&
            !["Hoàn tất"].includes(item.status),
        ))
    )
      throw new Error(
        "Không thể đóng kho khi còn hàng giữ hoặc chuyến hàng đang mở.",
      );
    setWarehouses((current) =>
      current.map((item) =>
        item.id === warehouseId
          ? { ...item, status, lastUpdatedAt: now() }
          : item,
      ),
    );
    pushReliefEvent(
      "warehouse",
      warehouseId,
      `Chuyển trạng thái kho sang ${status}`,
      "status",
    );
  };
  const createDamageAssessment = (input: NewDamageAssessmentInput) => {
    enforcePermission("damage_assessment_create", [
      {
        type: "DamageAssessment",
        id: "new",
        geographicScope: input.geographicScope,
      },
      incidentResource(input.incidentId),
    ]);
    assertRecoveryScope(role, input.geographicScope, currentScopeName);
    if (!incidents.some((item) => item.id === input.incidentId))
      throw new Error("Incident không hợp lệ.");
    const id = `DA-${String(Math.max(240, ...damageAssessments.map((item) => Number(item.id.replace(/\D/g, "")) || 0)) + 1).padStart(4, "0")}`;
    const value = createDamageAssessmentEntity(id, input, now());
    setDamageAssessments((current) => [value, ...current]);
    pushRecoveryEvent(
      "assessment",
      id,
      input.incidentId,
      `Tạo đánh giá thiệt hại ${id}`,
      "assessment_created",
    );
    return id;
  };
  const updateDamageAssessment = (
    id: string,
    changes: Partial<
      Omit<
        DamageAssessment,
        | "id"
        | "code"
        | "incidentId"
        | "status"
        | "verification"
        | "verifiedAt"
        | "createdAt"
        | "updatedAt"
      >
    >,
  ) => {
    enforcePermission("damage_assessment_edit", [
      assessmentResource(id),
      ...(changes.geographicScope
        ? [
            {
              type: "DamageAssessment",
              id,
              geographicScope: changes.geographicScope,
            },
          ]
        : []),
    ]);
    const value = damageAssessments.find((item) => item.id === id);
    if (!value) return;
    assertRecoveryScope(role, value.geographicScope, currentScopeName);
    setDamageAssessments((current) =>
      current.map((item) =>
        item.id === id ? applyDamageUpdate(item, changes, now()) : item,
      ),
    );
  };
  const submitDamageAssessment = (id: string) => {
    enforcePermission("damage_assessment_submit", [assessmentResource(id)]);
    const value = damageAssessments.find((item) => item.id === id);
    if (!value) return;
    assertRecoveryScope(role, value.geographicScope, currentScopeName);
    setDamageAssessments((current) =>
      current.map((item) =>
        item.id === id ? applyDamageSubmission(item, now()) : item,
      ),
    );
    pushRecoveryEvent(
      "assessment",
      id,
      value.incidentId,
      `Gửi ${id} để thẩm định`,
      "assessment_submitted",
    );
  };
  const reviewDamageAssessment = (id: string) => {
    enforcePermission("damage_assessment_verify", [assessmentResource(id)]);
    const value = damageAssessments.find((item) => item.id === id);
    if (!value) return;
    assertRecoveryScope(role, value.geographicScope, currentScopeName);
    setDamageAssessments((current) =>
      current.map((item) =>
        item.id === id ? applyDamageReview(item, now()) : item,
      ),
    );
    pushRecoveryEvent(
      "assessment",
      id,
      value.incidentId,
      `Bắt đầu thẩm định ${id}`,
      "assessment_reviewed",
    );
  };
  const verifyDamageAssessment = (
    id: string,
    evidenceIds: string[],
    note: string,
  ) => {
    enforcePermission("damage_assessment_verify", [assessmentResource(id)]);
    const value = damageAssessments.find((item) => item.id === id);
    if (!value) return;
    assertRecoveryScope(role, value.geographicScope, currentScopeName);
    setDamageAssessments((current) =>
      current.map((item) =>
        item.id === id
          ? applyDamageVerification(item, actorName, evidenceIds, note, now())
          : item,
      ),
    );
    pushRecoveryEvent(
      "assessment",
      id,
      value.incidentId,
      `Xác minh đánh giá thiệt hại ${id}`,
      "assessment_verified",
    );
  };
  const rejectDamageAssessment = (id: string, reason: string) => {
    enforcePermission("damage_assessment_reject", [assessmentResource(id)]);
    const value = damageAssessments.find((item) => item.id === id);
    if (!value) return;
    assertRecoveryScope(role, value.geographicScope, currentScopeName);
    setDamageAssessments((current) =>
      current.map((item) =>
        item.id === id
          ? applyDamageRejection(item, actorName, reason, [], now())
          : item,
      ),
    );
    pushRecoveryEvent(
      "assessment",
      id,
      value.incidentId,
      `Từ chối ${id}: ${reason}`,
      "assessment_rejected",
    );
  };
  const addDamageItem = (assessmentId: string, item: DamageItem) => {
    enforcePermission("damage_assessment_edit", [
      assessmentResource(assessmentId),
    ]);
    const value = damageAssessments.find((row) => row.id === assessmentId);
    if (!value) return;
    assertRecoveryScope(role, value.geographicScope, currentScopeName);
    setDamageAssessments((current) =>
      current.map((row) =>
        row.id === assessmentId ? applyDamageItemAdd(row, item, now()) : row,
      ),
    );
  };
  const attachDamageEvidence = (
    assessmentId: string,
    evidence: RecoveryEvidence,
  ) => {
    enforcePermission("damage_assessment_edit", [
      assessmentResource(assessmentId),
    ]);
    const value = damageAssessments.find((row) => row.id === assessmentId);
    if (!value) return;
    assertRecoveryScope(role, value.geographicScope, currentScopeName);
    setDamageAssessments((current) =>
      current.map((row) =>
        row.id === assessmentId
          ? applyDamageEvidence(row, evidence, now())
          : row,
      ),
    );
  };
  const createDamageRevision = (assessmentId: string) => {
    enforcePermission("damage_assessment_edit", [
      assessmentResource(assessmentId),
    ]);
    const value = damageAssessments.find((item) => item.id === assessmentId);
    if (!value) throw new Error("Không tìm thấy assessment.");
    assertRecoveryScope(role, value.geographicScope, currentScopeName);
    const id = `${value.id}-R${value.revision + 1}`;
    const revision = applyDamageRevision(id, value, actorName, now());
    setDamageAssessments((current) => [revision, ...current]);
    pushRecoveryEvent(
      "assessment",
      id,
      value.incidentId,
      `Tạo revision ${id} từ ${value.id}`,
      "assessment_revision",
    );
    return id;
  };
  const createRecoveryProject = (input: NewRecoveryProjectInput) => {
    enforcePermission("recovery_project_create", [
      {
        type: "RecoveryProject",
        id: "new",
        geographicScope: input.geographicScope,
      },
      incidentResource(input.incidentId),
      ...input.assessmentIds.map(assessmentResource),
    ]);
    assertRecoveryScope(role, input.geographicScope, currentScopeName);
    if (!incidents.some((item) => item.id === input.incidentId))
      throw new Error("Incident không hợp lệ.");
    const id = `RP-${String(Math.max(240, ...recoveryProjects.map((item) => Number(item.id.replace(/\D/g, "")) || 0)) + 1).padStart(4, "0")}`;
    const value = createRecoveryProjectEntity(id, input, now());
    setRecoveryProjects((current) => [value, ...current]);
    pushRecoveryEvent(
      "project",
      id,
      input.incidentId,
      `Tạo dự án khôi phục ${id}`,
      "project_created",
    );
    return id;
  };
  const updateRecoveryProject = (
    id: string,
    changes: Partial<
      Pick<
        RecoveryProject,
        | "name"
        | "category"
        | "priority"
        | "owner"
        | "geographicScope"
        | "estimatedBudget"
        | "targetDate"
        | "notes"
        | "assessmentIds"
        | "assignedTeamIds"
        | "relatedReliefRequestIds"
      >
    >,
  ) => {
    enforcePermission("recovery_project_create", [
      recoveryProjectResource(id),
      ...(changes.geographicScope
        ? [
            {
              type: "RecoveryProject",
              id,
              geographicScope: changes.geographicScope,
            },
          ]
        : []),
      ...(changes.assessmentIds ?? []).map(assessmentResource),
      ...(changes.assignedTeamIds ?? []).map(teamResource),
    ]);
    const value = recoveryProjects.find((item) => item.id === id);
    if (!value) return;
    assertRecoveryScope(role, value.geographicScope, currentScopeName);
    setRecoveryProjects((current) =>
      current.map((item) =>
        item.id === id ? applyRecoveryUpdate(item, changes, now()) : item,
      ),
    );
  };
  const approveRecoveryProject = (id: string, budget: number) => {
    enforcePermission("recovery_project_approve", [
      recoveryProjectResource(id),
    ]);
    const value = recoveryProjects.find((item) => item.id === id);
    if (!value) return;
    assertRecoveryScope(role, value.geographicScope, currentScopeName);
    setRecoveryProjects((current) =>
      current.map((item) =>
        item.id === id
          ? applyRecoveryApproval(item, damageAssessments, budget, now())
          : item,
      ),
    );
    pushRecoveryEvent(
      "project",
      id,
      value.incidentId,
      `Phê duyệt dự án ${id} với ngân sách ${budget.toLocaleString("vi-VN")} đồng`,
      "project_approved",
    );
  };
  const rejectRecoveryProject = (id: string, reason: string) => {
    enforcePermission("recovery_project_approve", [
      recoveryProjectResource(id),
    ]);
    const value = recoveryProjects.find((item) => item.id === id);
    if (!value) return;
    setRecoveryProjects((current) =>
      current.map((item) =>
        item.id === id
          ? applyRecoveryProjectRejection(item, reason, now())
          : item,
      ),
    );
    pushRecoveryEvent(
      "project",
      id,
      value.incidentId,
      `Từ chối dự án ${id}: ${reason}`,
      "project_rejected",
    );
  };
  const startRecoveryProject = (id: string) => {
    enforcePermission("recovery_project_execute", [
      recoveryProjectResource(id),
    ]);
    const value = recoveryProjects.find((item) => item.id === id);
    if (!value) return;
    setRecoveryProjects((current) =>
      current.map((item) =>
        item.id === id ? applyRecoveryStart(item, now()) : item,
      ),
    );
    pushRecoveryEvent(
      "project",
      id,
      value.incidentId,
      `Khởi động dự án ${id}`,
      "project_started",
    );
  };
  const pauseRecoveryProject = (id: string) => {
    enforcePermission("recovery_project_execute", [
      recoveryProjectResource(id),
    ]);
    const value = recoveryProjects.find((item) => item.id === id);
    if (!value) return;
    setRecoveryProjects((current) =>
      current.map((item) =>
        item.id === id ? applyRecoveryPause(item, now()) : item,
      ),
    );
    pushRecoveryEvent(
      "project",
      id,
      value.incidentId,
      `Tạm dừng dự án ${id}`,
      "project_paused",
    );
  };
  const resumeRecoveryProject = (id: string) => {
    enforcePermission("recovery_project_execute", [
      recoveryProjectResource(id),
    ]);
    const value = recoveryProjects.find((item) => item.id === id);
    if (!value) return;
    setRecoveryProjects((current) =>
      current.map((item) =>
        item.id === id ? applyRecoveryResume(item, now()) : item,
      ),
    );
    pushRecoveryEvent(
      "project",
      id,
      value.incidentId,
      `Tiếp tục dự án ${id}`,
      "project_resumed",
    );
  };
  const cancelRecoveryProject = (id: string) => {
    enforcePermission("recovery_project_cancel", [recoveryProjectResource(id)]);
    const value = recoveryProjects.find((item) => item.id === id);
    if (!value) return;
    setRecoveryProjects((current) =>
      current.map((item) =>
        item.id === id ? applyRecoveryCancellation(item, now()) : item,
      ),
    );
    pushRecoveryEvent(
      "project",
      id,
      value.incidentId,
      `Hủy dự án ${id}`,
      "project_cancelled",
    );
  };
  const updateRecoveryBudget = (
    id: string,
    spent: number,
    overrideNote: string | null = null,
  ) => {
    enforcePermission("recovery_project_execute", [
      recoveryProjectResource(id),
    ]);
    const value = recoveryProjects.find((item) => item.id === id);
    if (!value) return;
    setRecoveryProjects((current) =>
      current.map((item) =>
        item.id === id
          ? applyRecoveryBudget(item, spent, overrideNote, now())
          : item,
      ),
    );
    pushRecoveryEvent(
      "project",
      id,
      value.incidentId,
      `Cập nhật chi phí dự án ${id}: ${spent.toLocaleString("vi-VN")} đồng`,
      "budget_updated",
    );
  };
  const verifyRecoveryCompletion = (
    id: string,
    note: string,
    evidence: string[],
  ) => {
    enforcePermission("recovery_project_approve", [
      recoveryProjectResource(id),
    ]);
    const value = recoveryProjects.find((item) => item.id === id);
    if (!value) return;
    setRecoveryProjects((current) =>
      current.map((item) =>
        item.id === id
          ? applyRecoveryCompletionVerification(
              item,
              actorName,
              note,
              evidence,
              now(),
            )
          : item,
      ),
    );
    pushRecoveryEvent(
      "project",
      id,
      value.incidentId,
      `Ghi nhận xác minh hoàn thành dự án ${id}`,
      "completion_verified",
    );
  };
  const completeRecoveryProject = (id: string) => {
    enforcePermission("recovery_project_execute", [
      recoveryProjectResource(id),
    ]);
    const value = recoveryProjects.find((item) => item.id === id);
    if (!value) return;
    const context = { tasks, assessments: damageAssessments };
    setRecoveryProjects((current) =>
      current.map((item) =>
        item.id === id ? applyRecoveryCompletion(item, context, now()) : item,
      ),
    );
    pushRecoveryEvent(
      "project",
      id,
      value.incidentId,
      `Hoàn thành dự án ${id}`,
      "project_completed",
    );
  };
  const addRecoveryMilestone = (
    projectId: string,
    milestone: Omit<
      RecoveryMilestone,
      "projectId" | "order" | "status" | "progress" | "completedAt"
    >,
  ) => {
    enforcePermission("recovery_project_execute", [
      recoveryProjectResource(projectId),
    ]);
    setRecoveryProjects((current) =>
      current.map((item) =>
        item.id === projectId
          ? applyRecoveryMilestoneAdd(item, milestone, now())
          : item,
      ),
    );
  };
  const startRecoveryMilestone = (projectId: string, milestoneId: string) => {
    enforcePermission("recovery_project_execute", [
      recoveryProjectResource(projectId),
    ]);
    const value = recoveryProjects.find((item) => item.id === projectId);
    if (!value) return;
    setRecoveryProjects((current) =>
      current.map((item) =>
        item.id === projectId
          ? syncRecoveryProgress(
              applyRecoveryMilestoneStart(item, milestoneId, now()),
              { tasks, assessments: damageAssessments },
              now(),
            )
          : item,
      ),
    );
    pushRecoveryEvent(
      "project",
      projectId,
      value.incidentId,
      `Bắt đầu milestone ${milestoneId}`,
      "milestone_started",
    );
  };
  const completeRecoveryMilestone = (
    projectId: string,
    milestoneId: string,
  ) => {
    enforcePermission("recovery_project_execute", [
      recoveryProjectResource(projectId),
    ]);
    const value = recoveryProjects.find((item) => item.id === projectId);
    if (!value) return;
    setRecoveryProjects((current) =>
      current.map((item) =>
        item.id === projectId
          ? syncRecoveryProgress(
              applyRecoveryMilestoneCompletion(item, milestoneId, now()),
              { tasks, assessments: damageAssessments },
              now(),
            )
          : item,
      ),
    );
    pushRecoveryEvent(
      "project",
      projectId,
      value.incidentId,
      `Hoàn thành milestone ${milestoneId}`,
      "milestone_completed",
    );
  };
  const skipRecoveryMilestone = (projectId: string, milestoneId: string) => {
    enforcePermission("recovery_project_execute", [
      recoveryProjectResource(projectId),
    ]);
    const value = recoveryProjects.find((item) => item.id === projectId);
    if (!value) return;
    setRecoveryProjects((current) =>
      current.map((item) =>
        item.id === projectId
          ? syncRecoveryProgress(
              applyRecoveryMilestoneSkip(item, milestoneId, now()),
              { tasks, assessments: damageAssessments },
              now(),
            )
          : item,
      ),
    );
    pushRecoveryEvent(
      "project",
      projectId,
      value.incidentId,
      `Bỏ qua milestone tùy chọn ${milestoneId}`,
      "milestone_skipped",
    );
  };
  const createTaskFromRecoveryProject = (projectId: string) => {
    enforcePermission("recovery_project_execute", [
      recoveryProjectResource(projectId),
    ]);
    const project = recoveryProjects.find((item) => item.id === projectId);
    const incident = incidents.find((item) => item.id === project?.incidentId);
    if (!project || !incident)
      throw new Error("Dự án hoặc Incident không hợp lệ.");
    enforcePermission("task_create", [
      incidentResource(incident.id),
      recoveryProjectResource(projectId),
    ]);
    const id = `TSK-${String(Math.max(240, ...tasks.map((item) => Number(item.id.replace(/\D/g, "")) || 0)) + 1).padStart(4, "0")}`;
    const task = createTaskEntity(
      id,
      {
        incidentId: incident.id,
        title: `${project.code} — ${project.name}`,
        type: "Khôi phục",
        priority: project.priority,
        teamId: "",
        assignee: "",
        location: project.location.name,
        dueAt: project.targetDate,
        description: `Nhiệm vụ canonical phục vụ dự án khôi phục ${project.code}.`,
      },
      now(),
      { teamLeader: "", coordinates: project.location.coordinates },
    );
    const next = [task, ...tasks];
    setTasks(next);
    setRecoveryProjects((current) =>
      current.map((item) =>
        item.id === projectId
          ? syncRecoveryProgress(
              {
                ...item,
                taskIds: [...item.taskIds, id],
                requiredTaskIds: [...item.requiredTaskIds, id],
              },
              { tasks: next, assessments: damageAssessments },
              now(),
            )
          : item,
      ),
    );
    pushEvent(
      incident.id,
      `Tạo nhiệm vụ ${id} từ dự án ${project.code}`,
      "recovery_task",
    );
    pushRecoveryEvent(
      "project",
      projectId,
      incident.id,
      `Tạo và liên kết nhiệm vụ ${id}`,
      "task_created",
    );
    return id;
  };
  const createPlaybook = (input: NewPlaybookInput) => {
    enforcePermission("playbook_edit", [
      { type: "Playbook", id: "new", geographicScope: input.geographicScope },
    ]);
    const number =
      Math.max(
        0,
        ...playbooks.map((item) => Number(item.id.replace(/\D/g, "")) || 0),
      ) + 1;
    const id = `PB-${String(number).padStart(3, "0")}`;
    const value = createPlaybookEntity(id, input, now());
    setPlaybooks((current) => [value, ...current]);
    pushTemplatePlaybookEvent(id, `Tạo playbook ${value.code}`, "created");
    return id;
  };
  const updatePlaybook = (
    playbookId: string,
    changes: Partial<
      Pick<
        Playbook,
        | "name"
        | "description"
        | "disasterType"
        | "triggerConditions"
        | "severityThreshold"
        | "geographicScope"
        | "owner"
        | "estimatedDuration"
      >
    >,
  ) => {
    enforcePermission("playbook_edit", [
      playbookResource(playbookId),
      ...(changes.geographicScope
        ? [
            {
              type: "Playbook",
              id: playbookId,
              geographicScope: changes.geographicScope,
            },
          ]
        : []),
    ]);
    setPlaybooks((current) =>
      current.map((item) =>
        item.id === playbookId
          ? applyPlaybookUpdate(item, changes, now())
          : item,
      ),
    );
  };
  const publishPlaybook = (playbookId: string) => {
    enforcePermission("playbook_publish", [playbookResource(playbookId)]);
    const value = playbooks.find((item) => item.id === playbookId);
    if (!value) return;
    setPlaybooks((current) =>
      current.map((item) =>
        item.id === playbookId ? applyPlaybookPublish(item, now()) : item,
      ),
    );
    pushTemplatePlaybookEvent(
      playbookId,
      `Xuất bản playbook ${value.code}`,
      "published",
    );
  };
  const archivePlaybook = (playbookId: string) => {
    enforcePermission("playbook_edit", [playbookResource(playbookId)]);
    const value = playbooks.find((item) => item.id === playbookId);
    if (!value) return;
    if (
      playbookExecutions.some(
        (item) =>
          item.playbookId === playbookId &&
          ["Đang hoạt động", "Tạm dừng"].includes(item.status),
      )
    )
      throw new Error("Không thể lưu trữ playbook còn execution đang mở.");
    setPlaybooks((current) =>
      current.map((item) =>
        item.id === playbookId ? applyPlaybookArchive(item, now()) : item,
      ),
    );
    pushTemplatePlaybookEvent(
      playbookId,
      `Lưu trữ playbook ${value.code}`,
      "archived",
    );
  };
  const addPlaybookStep = (
    playbookId: string,
    step: Omit<
      PlaybookStep,
      | "playbookId"
      | "order"
      | "status"
      | "startedAt"
      | "completedAt"
      | "completedBy"
    >,
  ) => {
    enforcePermission("playbook_edit", [playbookResource(playbookId)]);
    setPlaybooks((current) =>
      current.map((item) =>
        item.id === playbookId ? applyPlaybookStepAdd(item, step, now()) : item,
      ),
    );
  };
  const reorderPlaybookSteps = (playbookId: string, stepIds: string[]) => {
    enforcePermission("playbook_edit", [playbookResource(playbookId)]);
    setPlaybooks((current) =>
      current.map((item) =>
        item.id === playbookId
          ? applyPlaybookStepReorder(item, stepIds, now())
          : item,
      ),
    );
  };
  const activatePlaybook = (playbookId: string, incidentId: string) => {
    enforcePermission(
      "playbook_activate",
      [playbookResource(playbookId), incidentResource(incidentId)],
      "kích hoạt playbook",
    );
    const playbook = playbooks.find((item) => item.id === playbookId);
    const incident = incidents.find((item) => item.id === incidentId);
    if (!playbook || !incident)
      throw new Error("Playbook hoặc Incident không hợp lệ.");
    if (
      playbookExecutions.some(
        (item) =>
          item.playbookId === playbookId &&
          item.incidentId === incidentId &&
          ["Đang hoạt động", "Tạm dừng"].includes(item.status),
      )
    )
      throw new Error("Playbook đã được kích hoạt cho Incident này.");
    const id = `PBX-${String(Math.max(0, ...playbookExecutions.map((item) => Number(item.id.replace(/\D/g, "")) || 0)) + 1).padStart(4, "0")}`;
    const execution = applyPlaybookActivation(
      id,
      playbook,
      incident,
      actorName,
      role,
      currentScopeName,
      now(),
    );
    setPlaybookExecutions((current) => [execution, ...current]);
    const event: PlaybookTimelineEvent = {
      // Executed only inside an event-handler mutation command, never during render.
      // oxlint-disable-next-line react/purity
      id: `PBE-${Date.now()}`,
      executionId: id,
      playbookId,
      incidentId,
      stepId: null,
      type: "activated",
      message: `Kích hoạt ${playbook.code} cho ${incidentId}`,
      actor: actorName,
      timestamp: now(),
      source: "Điều hành playbook",
    };
    setPlaybookEvents((current) => [event, ...current]);
    setPlaybookExecutions((current) =>
      current.map((item) =>
        item.id === id ? { ...item, timeline: [event] } : item,
      ),
    );
    pushEvent(incidentId, event.message, "playbook");
    return id;
  };
  const pausePlaybookExecution = (executionId: string) => {
    enforcePermission(
      "playbook_execute",
      playbookExecutionResources(executionId),
    );
    const execution = playbookExecutions.find(
      (item) => item.id === executionId,
    );
    if (!execution) return;
    setPlaybookExecutions((current) =>
      current.map((item) =>
        item.id === executionId ? applyPlaybookPause(item, now()) : item,
      ),
    );
    pushPlaybookEvent(executionId, null, "Tạm dừng playbook", "paused");
  };
  const resumePlaybookExecution = (executionId: string) => {
    enforcePermission(
      "playbook_execute",
      playbookExecutionResources(executionId),
    );
    const execution = playbookExecutions.find(
      (item) => item.id === executionId,
    );
    const playbook = playbooks.find(
      (item) => item.id === execution?.playbookId,
    );
    if (!execution || !playbook) return;
    setPlaybookExecutions((current) =>
      current.map((item) =>
        item.id === executionId
          ? applyPlaybookResume(playbook, item, now())
          : item,
      ),
    );
    pushPlaybookEvent(
      executionId,
      null,
      "Tiếp tục thực thi playbook",
      "resumed",
    );
  };
  const cancelPlaybookExecution = (executionId: string) => {
    enforcePermission(
      "playbook_cancel",
      playbookExecutionResources(executionId),
    );
    const execution = playbookExecutions.find(
      (item) => item.id === executionId,
    );
    if (!execution) return;
    setPlaybookExecutions((current) =>
      current.map((item) =>
        item.id === executionId ? applyPlaybookCancel(item, now()) : item,
      ),
    );
    pushPlaybookEvent(executionId, null, "Hủy execution playbook", "cancelled");
  };
  const completePlaybookExecution = (executionId: string) => {
    enforcePermission(
      "playbook_execute",
      playbookExecutionResources(executionId),
    );
    const execution = playbookExecutions.find(
      (item) => item.id === executionId,
    );
    const playbook = playbooks.find(
      (item) => item.id === execution?.playbookId,
    );
    if (!execution || !playbook) return;
    setPlaybookExecutions((current) =>
      current.map((item) =>
        item.id === executionId
          ? applyPlaybookCompletion(playbook, item, now())
          : item,
      ),
    );
    pushPlaybookEvent(executionId, null, "Hoàn thành playbook", "completed");
  };
  const startPlaybookStep = (executionId: string, stepId: string) => {
    enforcePermission(
      "playbook_execute",
      playbookExecutionResources(executionId),
    );
    const execution = playbookExecutions.find(
      (item) => item.id === executionId,
    );
    const playbook = playbooks.find(
      (item) => item.id === execution?.playbookId,
    );
    if (!execution || !playbook) return;
    setPlaybookExecutions((current) =>
      current.map((item) =>
        item.id === executionId
          ? applyPlaybookStepStart(playbook, item, stepId, actorName, now())
          : item,
      ),
    );
    pushPlaybookEvent(
      executionId,
      stepId,
      `Bắt đầu bước ${playbook.steps.find((item) => item.id === stepId)?.name}`,
      "step_started",
    );
  };
  const completePlaybookStep = (executionId: string, stepId: string) => {
    enforcePermission(
      "playbook_execute",
      playbookExecutionResources(executionId),
    );
    const execution = playbookExecutions.find(
      (item) => item.id === executionId,
    );
    const playbook = playbooks.find(
      (item) => item.id === execution?.playbookId,
    );
    if (!execution || !playbook) return;
    const context = {
      tasks,
      teams,
      shelters,
      evacuations: evacuationOperations,
      sosRequests,
      reliefRequests,
    };
    const changed = applyPlaybookStepCompletion(
      playbook,
      execution,
      stepId,
      context,
      actorName,
      now(),
    );
    setPlaybookExecutions((current) =>
      current.map((item) => (item.id === executionId ? changed : item)),
    );
    pushPlaybookEvent(
      executionId,
      stepId,
      `Hoàn thành bước ${playbook.steps.find((item) => item.id === stepId)?.name}`,
      "step_completed",
    );
    changed.stepExecutions
      .filter(
        (item) =>
          item.status === "Bị chặn" &&
          execution.stepExecutions.find(
            (oldStep) => oldStep.stepId === item.stepId,
          )?.status !== "Bị chặn",
      )
      .forEach((item) =>
        pushPlaybookEvent(
          executionId,
          item.stepId,
          `Bước ${playbook.steps.find((step) => step.id === item.stepId)?.name} bị chặn: ${item.blockedReason}`,
          "step_blocked",
          "Hệ thống nghiệp vụ",
        ),
      );
  };
  const skipPlaybookStep = (executionId: string, stepId: string) => {
    const canOverride = can("playbook_override");
    enforcePermission(
      canOverride ? "playbook_override" : "playbook_execute",
      playbookExecutionResources(executionId),
    );
    const execution = playbookExecutions.find(
      (item) => item.id === executionId,
    );
    const playbook = playbooks.find(
      (item) => item.id === execution?.playbookId,
    );
    if (!execution || !playbook) return;
    setPlaybookExecutions((current) =>
      current.map((item) =>
        item.id === executionId
          ? applyPlaybookStepSkip(
              playbook,
              item,
              stepId,
              actorName,
              canOverride,
              now(),
            )
          : item,
      ),
    );
    pushPlaybookEvent(
      executionId,
      stepId,
      `Bỏ qua bước ${playbook.steps.find((item) => item.id === stepId)?.name}`,
      "step_skipped",
    );
  };
  const assignPlaybookStepOwner = (
    executionId: string,
    stepId: string,
    owner: string,
  ) => {
    enforcePermission(
      "playbook_execute",
      playbookExecutionResources(executionId),
    );
    setPlaybookExecutions((current) =>
      current.map((item) =>
        item.id === executionId
          ? applyPlaybookStepOwner(item, stepId, owner, now())
          : item,
      ),
    );
    pushPlaybookEvent(
      executionId,
      stepId,
      `Gán bước cho ${owner}`,
      "step_owner",
    );
  };
  const createRecoveryProjectFromPlaybook = (executionId: string) => {
    enforcePermission(
      "recovery_project_create",
      playbookExecutionResources(executionId),
    );
    const execution = playbookExecutions.find(
      (item) => item.id === executionId,
    );
    const playbook = playbooks.find(
      (item) => item.id === execution?.playbookId,
    );
    const incident = incidents.find(
      (item) => item.id === execution?.incidentId,
    );
    const basis = damageAssessments.filter(
      (item) =>
        item.incidentId === execution?.incidentId &&
        item.status === "Đã xác minh",
    );
    if (!execution || !playbook || !incident)
      throw new Error("Playbook execution hoặc Incident không hợp lệ.");
    if (!basis.length)
      throw new Error(
        "Chưa có Damage Assessment đã xác minh để tạo dự án khôi phục.",
      );
    const id = `RP-${String(Math.max(240, ...recoveryProjects.map((item) => Number(item.id.replace(/\D/g, "")) || 0)) + 1).padStart(4, "0")}`;
    const project = createRecoveryProjectEntity(
      id,
      {
        name: `Khôi phục sau ${incident.title}`,
        incidentId: incident.id,
        assessmentIds: basis.map((item) => item.id),
        category: "Khôi phục sau ứng phó",
        priority: incident.severity === "Khẩn cấp" ? "Khẩn cấp" : "Cao",
        owner: execution.activatedBy,
        geographicScope: `${incident.location.name}`,
        estimatedBudget: basis.reduce(
          (sum, item) => sum + item.estimatedLoss,
          0,
        ),
        targetDate: "30/09/2026",
        location: {
          name: incident.location.name,
          coordinates: incident.location.coordinates,
        },
        affectedAreaCoordinates: basis[0].affectedAreaCoordinates,
        notes: `Khởi tạo từ execution ${execution.id} của ${playbook.code}.`,
      },
      now(),
    );
    setRecoveryProjects((current) => [project, ...current]);
    pushRecoveryEvent(
      "project",
      id,
      incident.id,
      `Tạo dự án ${id} từ playbook execution ${execution.id}`,
      "project_created_from_playbook",
    );
    pushPlaybookEvent(
      executionId,
      null,
      `Chuyển giai đoạn sang khôi phục, tạo dự án ${id}`,
      "recovery_project_created",
    );
    return id;
  };
  const createTaskFromPlaybookStep = (executionId: string, stepId: string) => {
    enforcePermission(
      "playbook_execute",
      playbookExecutionResources(executionId),
    );
    const execution = playbookExecutions.find(
      (item) => item.id === executionId,
    );
    const playbook = playbooks.find(
      (item) => item.id === execution?.playbookId,
    );
    const template = playbook?.steps.find((item) => item.id === stepId);
    const incident = incidents.find(
      (item) => item.id === execution?.incidentId,
    );
    if (!execution || !playbook || !template || !incident)
      throw new Error("Execution, bước hoặc Incident không hợp lệ.");
    enforcePermission("task_create", [
      incidentResource(incident.id),
      ...playbookExecutionResources(executionId),
    ]);
    if (template.type !== "Nhiệm vụ")
      throw new Error("Chỉ bước Nhiệm vụ mới có thể tạo Task.");
    const number =
      Math.max(
        240,
        ...tasks.map((item) => Number(item.id.replace(/\D/g, "")) || 0),
      ) + 1;
    const id = `TSK-${String(number).padStart(4, "0")}`;
    const task = createTaskEntity(
      id,
      {
        incidentId: incident.id,
        title: template.name,
        type: "Playbook / SOP",
        priority: incident.severity === "Khẩn cấp" ? "Khẩn cấp" : "Cao",
        teamId: "",
        assignee: "",
        location: incident.location.name,
        dueAt: "21/08/2026 13:00",
        description: `Tạo từ ${playbook.code}, bước ${template.order}: ${template.objective}`,
      },
      now(),
      { teamLeader: "", coordinates: incident.location.coordinates },
    );
    setTasks((current) => [task, ...current]);
    setPlaybookExecutions((current) =>
      current.map((item) =>
        item.id === executionId
          ? applyPlaybookEvidence(
              item,
              stepId,
              {
                linkedTaskIds: [
                  ...new Set([
                    ...item.stepExecutions.find(
                      (value) => value.stepId === stepId,
                    )!.linkedTaskIds,
                    id,
                  ]),
                ],
              },
              now(),
            )
          : item,
      ),
    );
    pushEvent(
      incident.id,
      `Tạo nhiệm vụ ${id} từ ${playbook.code} / ${template.name}`,
      "playbook_task",
    );
    pushPlaybookEvent(
      executionId,
      stepId,
      `Tạo và liên kết nhiệm vụ ${id}`,
      "task_created",
    );
    return id;
  };
  const updatePlaybookStepEvidence = (
    executionId: string,
    stepId: string,
    changes: Partial<
      Pick<
        PlaybookStepExecution,
        | "notes"
        | "verificationNote"
        | "linkedTaskIds"
        | "linkedTeamIds"
        | "linkedShelterIds"
        | "linkedEvacuationIds"
        | "linkedSosIds"
        | "linkedReliefRequestIds"
      >
    >,
  ) => {
    enforcePermission(
      "playbook_execute",
      [
        ...playbookExecutionResources(executionId),
        ...(changes.linkedTaskIds ?? []).flatMap(taskResources),
        ...(changes.linkedTeamIds ?? []).map(teamResource),
        ...(changes.linkedShelterIds ?? []).map(shelterResource),
        ...(changes.linkedEvacuationIds ?? []).flatMap(evacuationResources),
        ...(changes.linkedSosIds ?? []).map(sosResource),
        ...(changes.linkedReliefRequestIds ?? []).map(reliefRequestResource),
      ],
      "cập nhật liên kết bằng chứng playbook",
    );
    setPlaybookExecutions((current) =>
      current.map((item) =>
        item.id === executionId
          ? applyPlaybookEvidence(item, stepId, changes, now())
          : item,
      ),
    );
    pushPlaybookEvent(
      executionId,
      stepId,
      "Cập nhật bằng chứng và liên kết nghiệp vụ cho bước",
      "step_evidence",
    );
  };
  const stepSimulation = () => {
    const currentSimulation = currentSimulationState();
    enforcePermission("simulation_control", [
      systemResource(
        "Simulation",
        "red-river-flood-hanoi",
        currentSimulation.status,
      ),
    ]);
    const result = applyNextSimulationTick(
      currentSimulation,
      currentOperationalSnapshot(),
    );
    applyOperationalSnapshot(result.snapshot);
    setSimulation(result.simulation);
  };
  const playSimulation = () => {
    const currentSimulation = currentSimulationState();
    enforcePermission("simulation_control", [
      systemResource(
        "Simulation",
        "red-river-flood-hanoi",
        currentSimulation.status,
      ),
    ]);
    setSimulation((current) => startSimulation(current));
  };
  const pauseSimulation = () => {
    const currentSimulation = currentSimulationState();
    enforcePermission("simulation_control", [
      systemResource(
        "Simulation",
        "red-river-flood-hanoi",
        currentSimulation.status,
      ),
    ]);
    setSimulation((current) => stopSimulation(current));
  };
  const setSimulationSpeed = (speed: SimulationSpeed) => {
    const currentSimulation = currentSimulationState();
    enforcePermission("simulation_control", [
      systemResource(
        "Simulation",
        "red-river-flood-hanoi",
        currentSimulation.status,
      ),
    ]);
    setSimulation((current) => changeSimulationSpeed(current, speed));
  };
  const resetSimulation = () => {
    const currentSimulation = currentSimulationState();
    enforcePermission("simulation_control", [
      systemResource(
        "Simulation",
        "red-river-flood-hanoi",
        currentSimulation.status,
      ),
    ]);
    applyOperationalSnapshot(inMemoryOperationalRepository.load());
    setSimulation(resetSimulationState());
  };
  useEffect(() => {
    if (simulation.status !== "Đang chạy") return;
    const delay = Math.max(250, 1600 / simulation.speed);
    const timer = window.setTimeout(() => executeAtomic(stepSimulation), delay);
    return () => window.clearTimeout(timer);
  });
  const addEvent = (incidentId: string, message: string, actor = actorName) => {
    enforcePermission("update", [incidentResource(incidentId)]);
    pushEvent(incidentId, message, "manual", actor);
    setIncidents((current) =>
      current.map((item) =>
        item.id === incidentId ? { ...item, updatedAt: now() } : item,
      ),
    );
  };
  const closeIncident = (id: string) => {
    const incident = incidents.find((item) => item.id === id);
    enforcePermission("close", [
      incidentResource(id),
      ...(incident?.assignedTeamId
        ? [teamResource(incident.assignedTeamId)]
        : []),
    ]);
    if (!incident) throw new Error("Không tìm thấy sự cố cần đóng.");
    assertIncidentCanClose(id, {
      tasks,
      sosRequests,
      evacuations: evacuationOperations,
      reliefRequests,
      playbookExecutions,
    });
    setIncidents((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              status: "Đã đóng",
              assignedTeamId: null,
              progress: 100,
              closedAt: now(),
              updatedAt: now(),
            }
          : item,
      ),
    );
    if (incident.assignedTeamId)
      setTeams((current) =>
        current.map((team) =>
          team.id === incident.assignedTeamId && team.currentIncident === id
            ? recalculateTeamAssignment(team, tasks, now())
            : team,
        ),
      );
    pushEvent(id, `Đóng sự cố ${id} và ghi nhận hoàn tất xử lý`, "closed");
  };
  const findDerivedAlert = (alertKey: string) => {
    const snapshot = currentOperationalSnapshot();
    const alert = deriveOperationalAlerts(snapshot).find(
      (item) => item.key === alertKey,
    );
    if (!alert)
      throw new Error(
        "Cảnh báo không tồn tại hoặc điều kiện tạo cảnh báo đã được xử lý.",
      );
    return { snapshot, alert };
  };
  const assertAlertReadable = (alert: DerivedAlert) => {
    if (!currentUser || !currentUser.active)
      throw new Error("Phiên đăng nhập không hợp lệ hoặc đã hết hạn.");
    if (!hasPermission(currentUser.role, "alert_view"))
      throw new Error("Vai trò hiện tại không được cấp quyền alert_view.");
    const read = authorizeResources(currentUser, {
      permission: alert.readPermission,
      resources: [alertAuthorizationResource(alert)],
    });
    if (!read.allowed) throw new Error(read.reason);
    return currentUser;
  };
  const markAlertRead = (alertKey: string) => {
    const { alert } = findDerivedAlert(alertKey);
    const user = assertAlertReadable(alert);
    setAlertInteractions((current) =>
      markAlertReadReceipt(current, alertKey, user.id, now()),
    );
  };
  const markAlertUnread = (alertKey: string) => {
    const { alert } = findDerivedAlert(alertKey);
    const user = assertAlertReadable(alert);
    setAlertInteractions((current) =>
      removeAlertReadReceipt(current, alertKey, user.id),
    );
  };
  const markAllAlertsRead = () => {
    if (!currentUser || !currentUser.active)
      throw new Error("Phiên đăng nhập không hợp lệ hoặc đã hết hạn.");
    if (!hasPermission(currentUser.role, "alert_view"))
      throw new Error("Vai trò hiện tại không được cấp quyền alert_view.");
    const visible = deriveAuthorizedAlerts(
      currentUser,
      createAuthorizedOperationalView(
        currentUser,
        currentOperationalSnapshot(),
      ),
    ).filter((item) => item.status === "Chưa đọc");
    if (!visible.length) return;
    setAlertInteractions((current) =>
      visible.reduce(
        (accumulator, item) =>
          markAlertReadReceipt(accumulator, item.key, currentUser.id, now()),
        current,
      ),
    );
  };
  const acknowledgeAlert = (alertKey: string) => {
    const { snapshot, alert } = findDerivedAlert(alertKey);
    const user = assertAlertReadable(alert);
    enforcePermission(
      "alert_acknowledge",
      [alertAuthorizationResource(alert)],
      "xác nhận cảnh báo tác nghiệp",
    );
    const resolved = resolveAlertState(
      alert,
      snapshot.alertInteractions.find((item) => item.alertKey === alertKey),
      user.id,
    );
    const outcome = acknowledgeOperationalAlert(
      snapshot.alertInteractions,
      resolved,
      { id: user.id, name: actorName },
      now(),
    );
    setAlertInteractions(outcome.interactions);
    setAlertEvents((current) => [outcome.event, ...current]);
  };
  const atomic =
    <TArgs extends unknown[], TResult>(command: (...args: TArgs) => TResult) =>
    (...args: TArgs) =>
      executeAtomic(() => command(...args));
  const authorizedOperationalView = createAuthorizedOperationalView(
    currentUser,
    currentOperationalSnapshot(),
  );
  const authorizedAlerts = deriveAuthorizedAlerts(
    currentUser,
    authorizedOperationalView,
  );
  const authorizedAlertKeys = new Set(
    authorizedAlerts.map((item) => item.key),
  );
  const authorizedAlertInteractions =
    authorizedOperationalView.alertInteractions.filter((item) =>
      authorizedAlertKeys.has(item.alertKey),
    );
  const authorizedAlertEvents = authorizedOperationalView.alertEvents.filter(
    (event) => authorizedAlertKeys.has(event.alertKey),
  );
  const value = {
    ...authorizedOperationalView,
    alertInteractions: authorizedAlertInteractions,
    alerts: authorizedAlerts,
    alertEvents: authorizedAlertEvents,
    simulation,
    session,
    currentUser,
    users,
    securityAuditEvents,
    role,
    can,
    login,
    logout,
    updateUserActive,
    updateUserRole,
    updateUserScope,
    createIncident: atomic(createIncident),
    updateStatus: atomic(updateStatus),
    updateSeverity: atomic(updateSeverity),
    dispatchTeam: atomic(dispatchTeam),
    createTask: atomic(createTask),
    assignTaskTeam: atomic(assignTaskTeam),
    transitionTask: atomic(transitionTask),
    updateTaskProgress: atomic(updateTaskProgress),
    addTaskUpdate: atomic(addTaskUpdate),
    dispatchTeamToTask: atomic(dispatchTeamToTask),
    updateTeamStatus: atomic(updateTeamStatus),
    updateTeamLocation: atomic(updateTeamLocation),
    updateTeamProfile: atomic(updateTeamProfile),
    updateTeamCapabilities: atomic(updateTeamCapabilities),
    releaseTeamFromTask: atomic(releaseTeamFromTask),
    updateShelterCapacity: atomic(updateShelterCapacity),
    updateShelterOccupancy: atomic(updateShelterOccupancy),
    setShelterOpen: atomic(setShelterOpen),
    updateShelterResources: atomic(updateShelterResources),
    createEvacuation: atomic(createEvacuation),
    transitionEvacuation: atomic(transitionEvacuation),
    assignEvacuationTeam: atomic(assignEvacuationTeam),
    updateEvacuationProgress: atomic(updateEvacuationProgress),
    updateEvacuationRoute: atomic(updateEvacuationRoute),
    redirectEvacuation: atomic(redirectEvacuation),
    verifySos: atomic(verifySos),
    rejectSos: atomic(rejectSos),
    linkSosToIncident: atomic(linkSosToIncident),
    createIncidentFromSos: atomic(createIncidentFromSos),
    createRescueTaskFromSos: atomic(createRescueTaskFromSos),
    updateSosPriority: atomic(updateSosPriority),
    updateSosLocation: atomic(updateSosLocation),
    addSosUpdate: atomic(addSosUpdate),
    markSosNoContact: atomic(markSosNoContact),
    routeSosToShelter: atomic(routeSosToShelter),
    resolveSos: atomic(resolveSos),
    closeSos: atomic(closeSos),
    cancelSos: atomic(cancelSos),
    createReliefRequest: atomic(createReliefRequest),
    transitionReliefRequest: atomic(transitionReliefRequest),
    approveReliefRequest: atomic(approveReliefRequest),
    reserveReliefStock: atomic(reserveReliefStock),
    dispatchReliefReservation: atomic(dispatchReliefReservation),
    updateShipmentStatus: atomic(updateShipmentStatus),
    confirmShipmentReceipt: atomic(confirmShipmentReceipt),
    adjustWarehouseInventory: atomic(adjustWarehouseInventory),
    setWarehouseStatus: atomic(setWarehouseStatus),
    createPlaybook: atomic(createPlaybook),
    updatePlaybook: atomic(updatePlaybook),
    publishPlaybook: atomic(publishPlaybook),
    archivePlaybook: atomic(archivePlaybook),
    addPlaybookStep: atomic(addPlaybookStep),
    reorderPlaybookSteps: atomic(reorderPlaybookSteps),
    activatePlaybook: atomic(activatePlaybook),
    pausePlaybookExecution: atomic(pausePlaybookExecution),
    resumePlaybookExecution: atomic(resumePlaybookExecution),
    cancelPlaybookExecution: atomic(cancelPlaybookExecution),
    completePlaybookExecution: atomic(completePlaybookExecution),
    startPlaybookStep: atomic(startPlaybookStep),
    completePlaybookStep: atomic(completePlaybookStep),
    skipPlaybookStep: atomic(skipPlaybookStep),
    assignPlaybookStepOwner: atomic(assignPlaybookStepOwner),
    createRecoveryProjectFromPlaybook: atomic(
      createRecoveryProjectFromPlaybook,
    ),
    createTaskFromPlaybookStep: atomic(createTaskFromPlaybookStep),
    updatePlaybookStepEvidence: atomic(updatePlaybookStepEvidence),
    createDamageAssessment: atomic(createDamageAssessment),
    updateDamageAssessment: atomic(updateDamageAssessment),
    submitDamageAssessment: atomic(submitDamageAssessment),
    reviewDamageAssessment: atomic(reviewDamageAssessment),
    verifyDamageAssessment: atomic(verifyDamageAssessment),
    rejectDamageAssessment: atomic(rejectDamageAssessment),
    addDamageItem: atomic(addDamageItem),
    attachDamageEvidence: atomic(attachDamageEvidence),
    createDamageRevision: atomic(createDamageRevision),
    createRecoveryProject: atomic(createRecoveryProject),
    updateRecoveryProject: atomic(updateRecoveryProject),
    approveRecoveryProject: atomic(approveRecoveryProject),
    rejectRecoveryProject: atomic(rejectRecoveryProject),
    startRecoveryProject: atomic(startRecoveryProject),
    pauseRecoveryProject: atomic(pauseRecoveryProject),
    resumeRecoveryProject: atomic(resumeRecoveryProject),
    cancelRecoveryProject: atomic(cancelRecoveryProject),
    updateRecoveryBudget: atomic(updateRecoveryBudget),
    verifyRecoveryCompletion: atomic(verifyRecoveryCompletion),
    completeRecoveryProject: atomic(completeRecoveryProject),
    addRecoveryMilestone: atomic(addRecoveryMilestone),
    startRecoveryMilestone: atomic(startRecoveryMilestone),
    completeRecoveryMilestone: atomic(completeRecoveryMilestone),
    skipRecoveryMilestone: atomic(skipRecoveryMilestone),
    createTaskFromRecoveryProject: atomic(createTaskFromRecoveryProject),
    playSimulation: atomic(playSimulation),
    pauseSimulation: atomic(pauseSimulation),
    stepSimulation: atomic(stepSimulation),
    resetSimulation: atomic(resetSimulation),
    setSimulationSpeed: atomic(setSimulationSpeed),
    addEvent: atomic(addEvent),
    closeIncident: atomic(closeIncident),
    markAlertRead: atomic(markAlertRead),
    markAlertUnread: atomic(markAlertUnread),
    markAllAlertsRead: atomic(markAllAlertsRead),
    acknowledgeAlert: atomic(acknowledgeAlert),
  };
  return (
    <OperationalStateContext.Provider value={value}>
      {children}
    </OperationalStateContext.Provider>
  );
}
