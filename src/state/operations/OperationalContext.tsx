import { type ReactNode, useEffect, useRef, useState, useCallback } from "react";
import type {
  IncidentSeverity,
  IncidentStatus,
} from "../../domain/incidents/types";
import type {
  IncidentTask,
  TaskPriority,
  TaskReview,
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
  createTaskReview,
  decideTaskReview,
  initialAssignmentRecord,
  reassignTaskEntity,
  releaseTaskAssignment,
  reportTaskDoneEntity,
  reviewTaskResultEntity,
  transitionTaskEntity,
  type NewTaskInput,
} from "../../application/tasks/taskUseCases";
import {
  createCitizenReportEntity,
  reviewCitizenReportEntity,
  type NewCitizenReportInput,
} from "../../application/reports/reportUseCases";
import {
  createPublishedAlertDraft,
  publishAlertEntity,
  updatePublishedAlertEntity,
  withdrawAlertEntity,
  type PublishedAlertDraftInput,
} from "../../application/published-alerts/publishedAlertUseCases";
import type { CitizenReportStatus } from "../../domain/reports/types";
import {
  applyTeamLocation,
  assertTeamDispatchable,
  assignTeamToOperation,
  changeTeamStatus,
  recalculateTeamAssignment,
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
  assertSosScope,
  createSosRequest,
  incidentInputFromSos,
  linkSosIncident as applySosIncident,
  linkSosTaskAndTeam,
  resolveSos as applySosResolution,
  retriageSos,
  taskInputFromSos,
  transitionSos,
  updateSosLocation as applySosLocation,
  verifySos as applySosVerification,
  type NewSosInput,
} from "../../application/sos/sosUseCases";
import type { SosLocation, SosPriority, SosRequest } from "../../domain/sos/types";
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
  supabaseOperationalRepository,
  readCachedSnapshot,
} from "../../infrastructure/persistence/supabaseOperationalRepository";
import { isExplicitDemoMode } from "../../infrastructure/supabase/supabaseClient";
import {
  appendSystemDutyEntry,
  type DutyLink,
} from "../../infrastructure/duty/dutyLogStore";
import { roleLabels } from "../../domain/auth/labels";

import { OperationalStateContext } from "./OperationalStateContext";
import { useAtomicOperationalState } from "./useAtomicOperationalState";
import { useOperationalSecurity } from "./useOperationalSecurity";

export function OperationalProvider({ children }: { children: ReactNode }) {
  const [persistenceMode, setPersistenceMode] = useState<"supabase" | "demo" | "unavailable">(
    isExplicitDemoMode ? "demo" : "unavailable",
  );
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

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
    register,
    resetPassword,
    logout,
    updateUserActive,
    updateUserRole,
    updateUserScope,
    updateSelfProfile,
    recordSecurityAudit,
  } = useOperationalSecurity();
  const {
    incidents,
    tasks,
    teams,
    shelters,
    sosRequests,
    setIncidents,
    setEvents,
    setTasks,
    setTaskUpdates,
    setTeams,
    setTeamEvents,
    setShelters,
    setShelterEvents,
    setSosRequests,
    setSosEvents,
    setAlertInteractions,
    setAlertEvents,
    setTaskReviews,
    setCitizenReports,
    setCitizenReportEvents,
    setPublishedAlerts,
    setPublishedAlertEvents,
    currentOperationalSnapshot,
    executeAtomic,
  } = useAtomicOperationalState(
    readCachedSnapshot() ?? inMemoryOperationalRepository.load(),
  );

  // Lưu bất đồng bộ kèm hoàn tác khi Supabase từ chối / lỗi mạng
  const saveWithRollback = useCallback(
    (promise: Promise<void>, label: string, rollback?: () => void): void => {
      promise
        .then(() => {
          setPersistenceError(null);
          setLastSyncAt(new Date().toLocaleTimeString("vi-VN"));
        })
        .catch((err: any) => {
          const errMsg = err?.message ?? String(err);
          console.error(`[VNDMS/Supabase] Lỗi lưu ${label}:`, errMsg);
          setPersistenceError(`Lỗi lưu ${label}: ${errMsg}`);
          if (rollback) {
            rollback();
          }
          recordSecurityAudit(
            "OPERATIONAL_MUTATION",
            `Lỗi đồng bộ Supabase (${label}): ${errMsg}. Đã hoàn tác giao diện.`,
            "SupabasePersistence",
            label,
          );
        });
    },
    [recordSecurityAudit],
  );

  const fireAndForget = (promise: Promise<void>, label: string, rollback?: () => void) => {
    saveWithRollback(promise, label, rollback);
  };

  // Nạp snapshot từ Supabase sau khi mount và đồng bộ lại khi người dùng đăng nhập/đổi phiên
  const lastLoadedUserRef = useRef<string | null>(null);
  useEffect(() => {
    const currentUserId = currentUser?.id ?? null;
    const currentToken = session?.token ?? null;
    const userKey = `${currentUserId}:${currentToken}`;

    if (lastLoadedUserRef.current === userKey) return;
    lastLoadedUserRef.current = userKey;

    supabaseOperationalRepository
      .load()
      .then((snapshot) => {
        setIncidents(snapshot.incidents);
        setTasks(snapshot.tasks);
        setTaskUpdates(snapshot.taskUpdates);
        setTaskReviews(snapshot.taskReviews);
        setTeams(snapshot.teams);
        setShelters(snapshot.shelters);
        setSosRequests(snapshot.sosRequests);
        setCitizenReports(snapshot.citizenReports);
        setPublishedAlerts(snapshot.publishedAlerts);

        const isLive = snapshot.metadata.source?.includes("Live");
        setPersistenceMode(isLive ? "supabase" : isExplicitDemoMode ? "demo" : "unavailable");
        if (!isLive) {
          setPersistenceError(snapshot.metadata.source ?? "Đang sử dụng dữ liệu mẫu nội bộ");
        } else {
          setPersistenceError(null);
        }
        setLastSyncAt(new Date().toLocaleTimeString("vi-VN"));
      })
      .catch((err) => {
        lastLoadedUserRef.current = null;
        const fallbackSnapshot = readCachedSnapshot() ?? inMemoryOperationalRepository.load();
        setIncidents(fallbackSnapshot.incidents);
        setTasks(fallbackSnapshot.tasks);
        setTaskUpdates(fallbackSnapshot.taskUpdates);
        setTaskReviews(fallbackSnapshot.taskReviews);
        setTeams(fallbackSnapshot.teams);
        setShelters(fallbackSnapshot.shelters);
        setSosRequests(fallbackSnapshot.sosRequests);
        setCitizenReports(fallbackSnapshot.citizenReports);
        setPublishedAlerts(fallbackSnapshot.publishedAlerts);

        const msg = err?.message ?? String(err);
        console.warn("[VNDMS/Supabase] Supabase tạm dừng hoặc mất mạng, kích hoạt dữ liệu lưu đệm:", msg);
        setPersistenceMode("unavailable");
        setPersistenceError(`Supabase Cloud đang tạm dừng hoặc mất kết nối (${msg}). Hệ thống đang dùng dữ liệu lưu đệm.`);
      });
  }, [
    currentUser?.id,
    session?.token,
    setIncidents,
    setTasks,
    setTaskUpdates,
    setTaskReviews,
    setTeams,
    setShelters,
    setSosRequests,
    setCitizenReports,
    setPublishedAlerts,
  ]);
  const now = () => currentOperationalSnapshot().metadata.asOf;
  const timeOnly = () => now().split(" ")[1] ?? now();
  const {
    incident: incidentResource,
    team: teamResource,
    task: taskResources,
    shelter: shelterResource,
    sos: sosResource,
    citizenReport: citizenReportResource,
    publishedAlert: publishedAlertResource,
  } = createOperationalResourceContext(currentOperationalSnapshot);
  const { pushEvent, pushTeamEvent, pushShelterEvent, pushSosEvent } =
    createOperationalTimeline({
      read: currentOperationalSnapshot,
      actorName,
      now,
      timeOnly,
      setEvents,
      setTeamEvents,
      setShelterEvents,
      setSosEvents,
    });
  /**
   * SỔ TRỰC BAN TỰ GHI (system entries): mỗi thao tác nghiệp vụ lớn bên dưới
   * để lại 1 dòng tóm tắt + link hồ sơ gốc. Bọc try/catch để sổ không bao giờ
   * làm vỡ nghiệp vụ; thao tác sổ (ký nhận/thu hồi/đánh dấu) không gọi ngược
   * lại đây nên không có vòng lặp.
   */
  const logDutySystem = (text: string, link?: DutyLink) => {
    try {
      appendSystemDutyEntry({
        actor: actorName,
        actorRole: roleLabels[role] ?? role,
        actorId: currentUser?.id ?? undefined,
        text,
        ...(link ? { link } : {}),
      });
    } catch {
      /* bỏ qua: sổ trực không được chặn nghiệp vụ */
    }
  };
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

  /** Phản hồi vòng đời sự cố: khi đội thực sự vào cuộc với một nhiệm vụ của
   * sự cố (tiếp nhận / bắt đầu / báo xong / hoàn thành), trạng thái
   * "Đang điều phối" tự chuyển sang "Đang xử lý" kèm dòng timeline — hết cảnh
   * điều phối xong là treo vô thời hạn vì phải nhớ đổi tay. Quyền quyết định
   * "Đã kiểm soát"/"Đóng" vẫn thuộc cán bộ (nút Chuyển trạng thái + chuông
   * nhắc khi mọi nhiệm vụ hoàn thành). */
  const advanceIncidentOnTaskEngagement = (
    incidentId: string,
    nextTasks: IncidentTask[],
    taskId: string,
  ) => {
    const incident = incidents.find((item) => item.id === incidentId);
    if (!incident || incident.status !== "Đang điều phối") return;
    const engaged = nextTasks.some(
      (task) =>
        task.incidentId === incidentId &&
        [
          "Đã tiếp nhận",
          "Đang thực hiện",
          "Chờ xác nhận",
          "Hoàn thành",
        ].includes(task.status),
    );
    if (!engaged) return;
    setIncidents((current) =>
      current.map((item) =>
        item.id === incidentId
          ? { ...item, status: "Đang xử lý" as const, updatedAt: now() }
          : item,
      ),
    );
    pushEvent(
      incidentId,
      `${taskId} — đội đã vào cuộc; sự cố tự chuyển sang ĐANG XỬ LÝ`,
      "status",
    );
    logDutySystem(
      `Sự cố ${incidentId} tự chuyển ĐANG XỬ LÝ (đội tiếp nhận ${taskId})`,
      { kind: "incident", id: incidentId, code: incidentId },
    );
  };

  const createIncident = (data: CreateIncidentInput) => {
    enforcePermission("create", [
      { type: "Incident", id: "new", geographicScope: data.location.name },
    ]);
    const number =
      Math.max(
        240,
        ...incidents.map((item) => Number(item.id.replace(/\D/g, "")) || 0),
      ) + 1;
    const id = `INC-${String(number).padStart(4, "0")}`;
    const incident = createIncidentEntity(id, data, actorName, now());
    setIncidents((current) => [incident, ...current]);
    fireAndForget(
      supabaseOperationalRepository.saveIncident(incident),
      `Incident ${id}`,
      () => setIncidents((current) => current.filter((item) => item.id !== id)),
    );
    pushEvent(id, `Tạo sự cố ${id}: ${data.title}`, "created");
    logDutySystem(`Tạo sự cố ${id}: ${data.title}`, { kind: "incident", id, code: id });
    return id;
  };
  const updateStatus = (id: string, status: IncidentStatus) => {
    enforcePermission("update", [incidentResource(id)]);
    const prevIncident = incidents.find((item) => item.id === id);
    if (!prevIncident) return;
    const updated = changeIncidentStatus(prevIncident, status, now());
    setIncidents((current) =>
      current.map((item) => (item.id === id ? updated : item)),
    );
    fireAndForget(
      supabaseOperationalRepository.saveIncident(updated),
      `Incident ${id}`,
      () => setIncidents((current) => current.map((item) => (item.id === id ? prevIncident : item))),
    );
    pushEvent(
      id,
      `Chuyển trạng thái sự cố sang ${status.toUpperCase()}`,
      "status",
    );
    logDutySystem(`Sự cố ${id} chuyển sang ${status}`, { kind: "incident", id, code: id });
  };
  const updateSeverity = (id: string, severity: IncidentSeverity) => {
    enforcePermission("severity", [incidentResource(id)]);
    const prevIncident = incidents.find((item) => item.id === id);
    if (!prevIncident) return;
    const updated = changeIncidentSeverity(prevIncident, severity, now());
    setIncidents((current) =>
      current.map((item) => (item.id === id ? updated : item)),
    );
    fireAndForget(
      supabaseOperationalRepository.saveIncident(updated),
      `Incident ${id}`,
      () => setIncidents((current) => current.map((item) => (item.id === id ? prevIncident : item))),
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
    const prevIncident = incidents.find((item) => item.id === incidentId);
    const prevTeam = teams.find((item) => item.id === teamId);
    const updatedIncident = prevIncident
      ? {
          ...prevIncident,
          assignedTeamId: teamId,
          status: "Đang điều phối" as const,
          updatedAt: now(),
        }
      : null;
    const updatedTeam = prevTeam
      ? {
          ...prevTeam,
          status: "Đang điều động" as const,
          currentIncident: incidentId,
          availability: "Đang bận" as const,
          updatedAt: now(),
        }
      : null;
    if (updatedIncident) {
      setIncidents((current) =>
        current.map((item) => (item.id === incidentId ? updatedIncident : item)),
      );
      fireAndForget(
        supabaseOperationalRepository.saveIncident(updatedIncident),
        `Incident ${incidentId}`,
        prevIncident ? () => setIncidents((cur) => cur.map((it) => it.id === incidentId ? prevIncident : it)) : undefined,
      );
    }
    if (updatedTeam) {
      setTeams((current) =>
        current.map((team) => (team.id === teamId ? updatedTeam : team)),
      );
      fireAndForget(
        supabaseOperationalRepository.saveTeam(updatedTeam),
        `Team ${teamId}`,
        prevTeam ? () => setTeams((cur) => cur.map((it) => it.id === teamId ? prevTeam : it)) : undefined,
      );
    }
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
    logDutySystem(`Điều đội ${teamId} tới sự cố ${incidentId}`, { kind: "incident", id: incidentId, code: incidentId });
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
    const created = createTaskEntity(id, data, now(), {
      teamLeader: team?.leader ?? "",
      coordinates: incident?.location.coordinates ?? [105.85, 21.05],
    });
    const task = data.teamId
      ? {
          ...created,
          assignmentHistory: [initialAssignmentRecord(data.teamId, actorName, now())],
        }
      : created;
    const next = [task, ...tasks];
    setTasks(next);
    fireAndForget(
      supabaseOperationalRepository.saveTask(task),
      `Task ${id}`,
      () => setTasks((current) => current.filter((item) => item.id !== id)),
    );
    if (data.teamId && team) {
      const assignedTeam = assignTeamToOperation(team, id, data.incidentId, now());
      setTeams((current) =>
        current.map((item) =>
          item.id === data.teamId ? assignedTeam : item,
        ),
      );
      fireAndForget(
        supabaseOperationalRepository.saveTeam(assignedTeam),
        `Team ${data.teamId}`,
        () => setTeams((current) => current.map((item) => item.id === data.teamId ? team : item)),
      );
      pushTeamEvent(data.teamId, `Nhận phân công nhiệm vụ ${id}`, "assignment");
    }
    syncIncidentProgress(data.incidentId, next);
    pushEvent(
      data.incidentId,
      `Tạo nhiệm vụ ${id}: ${data.title}${data.teamId ? ` và giao cho ${data.teamId}` : ""}`,
      "task",
    );
    logDutySystem(`Tạo nhiệm vụ ${id}: ${data.title}${data.teamId ? `, giao cho ${data.teamId}` : ""}`, { kind: "task", id, code: id });
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
    const assignedBase = assignTaskToTeam(
      task,
      { teamId, teamLeader: team.leader },
      now(),
    );
    const assigned = {
      ...assignedBase,
      assignmentHistory: [
        ...(task.assignmentHistory ?? []),
        initialAssignmentRecord(
          teamId,
          actorName,
          now(),
          task.teamId && task.teamId !== teamId
            ? "Gán lại đội (không ghi lý do — dùng Phân công lại để ghi lý do)"
            : "Phân công ban đầu",
        ),
      ],
    };
    const next = tasks.map((item) => (item.id === taskId ? assigned : item));
    setTasks(next);
    fireAndForget(
      supabaseOperationalRepository.saveTask(assigned),
      `Task ${taskId}`,
      () => setTasks((current) => current.map((item) => item.id === taskId ? task : item)),
    );
    const nextTeams = teams.map((item) => {
      if (item.id === teamId)
        return assignTeamToOperation(item, taskId, task.incidentId, now());
      if (task.teamId && task.teamId !== teamId && item.id === task.teamId)
        return recalculateTeamAssignment(item, next, now());
      return item;
    });
    setTeams(nextTeams);
    const assignedTeamEntity = nextTeams.find((item) => item.id === teamId);
    if (assignedTeamEntity) {
      fireAndForget(
        supabaseOperationalRepository.saveTeam(assignedTeamEntity),
        `Team ${teamId}`,
        () => setTeams((current) => current.map((item) => item.id === teamId ? team : item)),
      );
    }
    if (task.teamId && task.teamId !== teamId) {
      const prevTeam = teams.find((item) => item.id === task.teamId);
      const prevTeamEntity = nextTeams.find((item) => item.id === task.teamId);
      if (prevTeamEntity) {
        fireAndForget(
          supabaseOperationalRepository.saveTeam(prevTeamEntity),
          `Team ${prevTeamEntity.id}`,
          prevTeam ? () => setTeams((current) => current.map((item) => item.id === task.teamId ? prevTeam : item)) : undefined,
        );
      }
    }
    pushTeamEvent(
      teamId,
      `Được điều phối cho nhiệm vụ ${taskId}`,
      "assignment",
    );
    const incident = incidents.find((item) => item.id === task.incidentId);
    if (incident && !incident.assignedTeamId) {
      const updatedIncident = { ...incident, assignedTeamId: teamId, updatedAt: now() };
      setIncidents((current) =>
        current.map((item) => item.id === task.incidentId ? updatedIncident : item),
      );
      fireAndForget(
        supabaseOperationalRepository.saveIncident(updatedIncident),
        `Incident ${task.incidentId}`,
        () => setIncidents((current) => current.map((item) => item.id === task.incidentId ? incident : item)),
      );
    }
    pushEvent(
      task.incidentId,
      `Đã điều phối ${teamId} cho nhiệm vụ ${taskId}`,
      "task_assignment",
    );
    logDutySystem(`Giao nhiệm vụ ${taskId} cho đội ${teamId}`, { kind: "task", id: taskId, code: taskId });
  };

  const transitionTask = (taskId: string, status: TaskStatus) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    const permission: Permission =
      status === "Đã tiếp nhận"
        ? "task_accept"
        : status === "Đang thực hiện"
          ? "task_start"
          : status === "Chờ xác nhận"
            ? "task_report_done"
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
    fireAndForget(
      supabaseOperationalRepository.saveTask(transitioned),
      `Task ${taskId}`,
      () => setTasks((current) => current.map((item) => item.id === taskId ? task : item)),
    );
    syncIncidentProgress(task.incidentId, next);
    advanceIncidentOnTaskEngagement(task.incidentId, next, taskId);
    const updatedIncident = incidents.find((it) => it.id === task.incidentId);
    if (updatedIncident) {
      fireAndForget(
        supabaseOperationalRepository.saveIncident(updatedIncident),
        `Incident ${task.incidentId}`,
      );
    }
    if (task.teamId) {
      const team = teams.find((item) => item.id === task.teamId);
      if (team) {
        const nextTeam = recalculateTeamAssignment(team, next, now());
        setTeams((current) =>
          current.map((t) => (t.id === task.teamId ? nextTeam : t)),
        );
        fireAndForget(
          supabaseOperationalRepository.saveTeam(nextTeam),
          `Team ${task.teamId}`,
          () => setTeams((current) => current.map((t) => t.id === task.teamId ? team : t)),
        );
      }
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
    logDutySystem(`${taskId} chuyển sang ${status}`, { kind: "task", id: taskId, code: taskId });
    const linkedSos = sosRequests.find((item) => item.linkedTaskId === taskId);
    if (linkedSos) {
      if (status === "Đang thực hiện") {
        const changedSos = linkedSos.status === "Đã điều phối"
          ? transitionSos(linkedSos, "Đang cứu hộ", now())
          : linkedSos;
        setSosRequests((current) =>
          current.map((item) =>
            item.id === linkedSos.id ? changedSos : item,
          ),
        );
        fireAndForget(
          supabaseOperationalRepository.saveSosRequest(changedSos),
          `SOS ${linkedSos.id}`,
          () => setSosRequests((cur) => cur.map((it) => it.id === linkedSos.id ? linkedSos : it)),
        );
        pushSosEvent(
          linkedSos.id,
          `Đội ${task.teamId} bắt đầu cứu hộ theo ${taskId}`,
          "rescue",
          task.teamId || actorName,
        );
      } else if (status === "Hoàn thành") {
        const changedSos = ["Đang cứu hộ", "Đã điều phối"].includes(linkedSos.status)
          ? applySosResolution(
              linkedSos,
              `Nhiệm vụ ${taskId} hoàn thành, người yêu cầu đã được hỗ trợ.`,
              now(),
            )
          : linkedSos;
        setSosRequests((current) =>
          current.map((item) =>
            item.id === linkedSos.id ? changedSos : item,
          ),
        );
        fireAndForget(
          supabaseOperationalRepository.saveSosRequest(changedSos),
          `SOS ${linkedSos.id}`,
          () => setSosRequests((cur) => cur.map((it) => it.id === linkedSos.id ? linkedSos : it)),
        );
        pushSosEvent(
          linkedSos.id,
          `Nhiệm vụ ${taskId} hoàn thành, chuyển SOS sang đã xử lý`,
          "resolved",
        );
      } else if (status === "Đã hủy") {
        const changedSos: SosRequest = {
          ...linkedSos,
          status: "Đã xác minh",
          linkedTaskId: null,
          assignedTeamId: null,
          lastUpdatedAt: now(),
        };
        setSosRequests((current) =>
          current.map((item) =>
            item.id === linkedSos.id ? changedSos : item,
          ),
        );
        fireAndForget(
          supabaseOperationalRepository.saveSosRequest(changedSos),
          `SOS ${linkedSos.id}`,
          () => setSosRequests((cur) => cur.map((it) => it.id === linkedSos.id ? linkedSos : it)),
        );
        pushSosEvent(
          linkedSos.id,
          `Nhiệm vụ ${taskId} bị hủy, yêu cầu chờ điều phối lại`,
          "task_cancel",
        );
      }
    }
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
    fireAndForget(supabaseOperationalRepository.saveTaskUpdate(update), `TaskUpdate ${update.id}`);
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
    fireAndForget(supabaseOperationalRepository.saveTask(assigned), `Task ${taskId}`);
    const nextTeams = teams.map((item) => {
      if (item.id === teamId)
        return assignTeamToOperation(item, taskId, incidentId, now());
      if (task.teamId && task.teamId !== teamId && item.id === task.teamId)
        return recalculateTeamAssignment(item, next, now());
      return item;
    });
    setTeams(nextTeams);
    const assignedTeamEntity = nextTeams.find((item) => item.id === teamId);
    if (assignedTeamEntity) fireAndForget(supabaseOperationalRepository.saveTeam(assignedTeamEntity), `Team ${teamId}`);
    if (task.teamId && task.teamId !== teamId) {
      const prevTeam = nextTeams.find((item) => item.id === task.teamId);
      if (prevTeam) fireAndForget(supabaseOperationalRepository.saveTeam(prevTeam), `Team ${prevTeam.id}`);
    }
    const updatedIncident = {
      ...incident,
      assignedTeamId: incident.assignedTeamId ?? teamId,
      updatedAt: now(),
    };
    setIncidents((current) =>
      current.map((item) =>
        item.id === incidentId ? updatedIncident : item,
      ),
    );
    fireAndForget(supabaseOperationalRepository.saveIncident(updatedIncident), `Incident ${incidentId}`);
    syncIncidentProgress(incidentId, next);
    const message = `Điều phối ${teamId} thực hiện ${taskId} tới ${destination}${note ? `: ${note}` : ""}`;
    pushTeamEvent(teamId, message, "dispatch");
    pushEvent(incidentId, message, "team_dispatch");
    logDutySystem(message, { kind: "task", id: taskId, code: taskId });
  };
  const updateTeamStatus = (teamId: string, status: TeamStatus) => {
    enforcePermission("team_update_status", [teamResource(teamId)]);
    const team = teams.find((item) => item.id === teamId);
    if (!team) return;
    const changed = changeTeamStatus(team, status, now());
    setTeams((current) =>
      current.map((item) => (item.id === teamId ? changed : item)),
    );
    fireAndForget(supabaseOperationalRepository.saveTeam(changed), `Team ${teamId}`);
    pushTeamEvent(
      teamId,
      `Chuyển trạng thái đội sang ${status.toUpperCase()}`,
      "status",
    );
    logDutySystem(`Đội ${teamId} chuyển sang trạng thái ${status}`, { kind: "team", id: teamId, code: teamId });
  };
  const updateTeamLocation = (teamId: string, location: TeamLocation) => {
    enforcePermission("team_update_location", [teamResource(teamId)]);
    const team = teams.find((item) => item.id === teamId);
    if (!team) return;
    const changed = applyTeamLocation(team, location, now());
    setTeams((current) =>
      current.map((item) =>
        item.id === teamId ? changed : item,
      ),
    );
    fireAndForget(supabaseOperationalRepository.saveTeam(changed), `Team ${teamId}`);
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
    fireAndForget(supabaseOperationalRepository.saveTeam(changed), `Team ${teamId}`);
    if (input.leader !== team.leader) {
      const updatedTasks = tasks
        .filter((task) => task.teamId === teamId && !["Hoàn thành", "Đã hủy"].includes(task.status))
        .map((task) => ({
          ...task,
          teamLeader: input.leader,
          assignee: task.assignee === team.leader ? input.leader : task.assignee,
          updatedAt: now(),
        }));
      if (updatedTasks.length > 0) {
        setTasks((current) =>
          current.map((task) => {
            const matched = updatedTasks.find((u) => u.id === task.id);
            return matched ?? task;
          }),
        );
        for (const ut of updatedTasks) {
          fireAndForget(supabaseOperationalRepository.saveTask(ut), `Task ${ut.id}`);
        }
      }
    }
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
    fireAndForget(supabaseOperationalRepository.saveTeam(changed), `Team ${teamId}`);
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
    fireAndForget(supabaseOperationalRepository.saveTeam(changed), `Team ${teamId}`);
    fireAndForget(supabaseOperationalRepository.saveTask(released), `Task ${task.id}`);
    const replacementTeam =
      next.find(
        (item) =>
          item.incidentId === task.incidentId &&
          item.teamId &&
          item.teamId !== teamId &&
          !["Hoàn thành", "Đã hủy"].includes(item.status),
      )?.teamId ?? null;
    const targetIncident = incidents.find((item) => item.id === task.incidentId && item.assignedTeamId === teamId);
    if (targetIncident) {
      const updatedInc = { ...targetIncident, assignedTeamId: replacementTeam, updatedAt: now() };
      setIncidents((current) =>
        current.map((item) => (item.id === task.incidentId ? updatedInc : item)),
      );
      fireAndForget(supabaseOperationalRepository.saveIncident(updatedInc), `Incident ${task.incidentId}`);
    }
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
    logDutySystem(`Thu hồi đội ${teamId} khỏi nhiệm vụ ${task.id}`, { kind: "task", id: task.id, code: task.id });
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
    fireAndForget(
      supabaseOperationalRepository.saveShelter(changed),
      `Shelter ${shelterId}`,
      () => setShelters((current) => current.map((item) => item.id === shelterId ? shelter : item)),
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
    fireAndForget(
      supabaseOperationalRepository.saveShelter(changed),
      `Shelter ${shelterId}`,
      () => setShelters((current) => current.map((item) => item.id === shelterId ? shelter : item)),
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
    fireAndForget(
      supabaseOperationalRepository.saveShelter(changed),
      `Shelter ${shelterId}`,
      () => setShelters((current) => current.map((item) => item.id === shelterId ? shelter : item)),
    );
    pushShelterEvent(
      shelterId,
      open ? "Mở điểm sơ tán để tiếp nhận" : "Tạm đóng điểm sơ tán",
      open ? "open" : "close",
    );
    logDutySystem(`${open ? "Mở tiếp nhận" : "Tạm đóng"} điểm ${shelterId} — ${shelter.name}`, { kind: "shelter", id: shelterId, code: shelterId });
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
    fireAndForget(
      supabaseOperationalRepository.saveShelter(changed),
      `Shelter ${shelterId}`,
      () => setShelters((current) => current.map((item) => item.id === shelterId ? shelter : item)),
    );
    pushShelterEvent(
      shelterId,
      "Cập nhật điều kiện vận hành và nguồn lực",
      "resources",
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
    fireAndForget(
      supabaseOperationalRepository.saveSosRequest(changed),
      `SOS ${sosId}`,
      () => setSosRequests((cur) => cur.map((it) => it.id === sosId ? sos : it)),
    );
    pushSosEvent(sosId, "Hoàn tất xác minh thông tin SOS", "verified");
    logDutySystem(`Xác minh SOS ${sosId}`, { kind: "sos", id: sosId, code: sosId });
  };
  const rejectSos = (sosId: string) => {
    enforcePermission("sos_verify", [sosResource(sosId)]);
    const sos = sosRequests.find((item) => item.id === sosId);
    if (!sos) return;
    const changed = transitionSos(sos, "Từ chối", now());
    setSosRequests((current) =>
      current.map((item) => (item.id === sosId ? changed : item)),
    );
    fireAndForget(
      supabaseOperationalRepository.saveSosRequest(changed),
      `SOS ${sosId}`,
      () => setSosRequests((cur) => cur.map((it) => it.id === sosId ? sos : it)),
    );
    pushSosEvent(sosId, "Từ chối SOS sau xác minh", "rejected");
    logDutySystem(`Từ chối SOS ${sosId} sau xác minh`, { kind: "sos", id: sosId, code: sosId });
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
    fireAndForget(
      supabaseOperationalRepository.saveSosRequest(changed),
      `SOS ${sosId}`,
      () => setSosRequests((cur) => cur.map((it) => it.id === sosId ? sos : it)),
    );
    pushSosEvent(sosId, `Liên kết với sự cố ${incidentId}`, "incident");
    pushEvent(
      incidentId,
      `Liên kết yêu cầu ${sosId}: ${sos.description}`,
      "sos",
    );
    logDutySystem(`Gắn SOS ${sosId} vào sự cố ${incidentId}`, { kind: "sos", id: sosId, code: sosId });
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
    const updatedSos = applySosIncident(sos, id, now());
    setSosRequests((current) =>
      current.map((item) => (item.id === sosId ? updatedSos : item)),
    );
    fireAndForget(
      supabaseOperationalRepository.saveSosRequest(updatedSos),
      `SOS ${sosId}`,
      () => setSosRequests((cur) => cur.map((it) => it.id === sosId ? sos : it)),
    );
    pushSosEvent(sosId, `Tạo và liên kết sự cố ${id}`, "incident_created");
    pushEvent(
      id,
      `Sự cố được tạo từ ${sosId}, ${sos.peopleAtRisk} người gặp nguy hiểm`,
      "sos",
    );
    logDutySystem(`Lập sự cố ${id} từ SOS ${sosId} (${sos.peopleAtRisk} người gặp nguy hiểm)`, { kind: "sos", id: sosId, code: sosId });
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
    const changedSos = linkSosTaskAndTeam(sos, id, teamId, now());
    setSosRequests((current) =>
      current.map((item) => (item.id === sosId ? changedSos : item)),
    );
    fireAndForget(
      supabaseOperationalRepository.saveSosRequest(changedSos),
      `SOS ${sosId}`,
      () => setSosRequests((cur) => cur.map((it) => it.id === sosId ? sos : it)),
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
    fireAndForget(
      supabaseOperationalRepository.saveSosRequest(changed),
      `SOS ${sosId}`,
      () => setSosRequests((cur) => cur.map((it) => it.id === sosId ? sos : it)),
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
    fireAndForget(
      supabaseOperationalRepository.saveSosRequest(changed),
      `SOS ${sosId}`,
      () => setSosRequests((cur) => cur.map((it) => it.id === sosId ? sos : it)),
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
    fireAndForget(
      supabaseOperationalRepository.saveSosRequest(changed),
      `SOS ${sosId}`,
      () => setSosRequests((cur) => cur.map((it) => it.id === sosId ? sos : it)),
    );
    pushSosEvent(
      sosId,
      "Không thể liên lạc với người báo tin",
      "communication",
    );
  };
  const createSos = (input: NewSosInput, options?: { securityAudited?: boolean }) => {
    // Caller (nút SOS Panic) có dòng nhật ký chuyên biệt PANIC_ALERT_TRIGGERED
    // riêng → truyền securityAudited:true để không nhân đôi thành 2 dòng + 2
    // thông báo cho MỘT lần bấm (owner request 2026-09). Các nơi gọi khác
    // (portal công dân, form tiếp nhận) giữ dòng generic.
    enforcePermission(
      "sos_create",
      [{ type: "SosRequest", id: "new", geographicScope: input.location.address }],
      undefined,
      options?.securityAudited ? { logGranted: false } : undefined,
    );
    const maxNum = Math.max(
      100,
      ...sosRequests.map((item) => Number(item.id.replace(/\D/g, "")) || 0),
    );
    const id = `SOS-${String(maxNum + 1).padStart(4, "0")}`;
    const newSos = createSosRequest(id, input, now(), currentUser?.id ?? null);
    setSosRequests((current) => [newSos, ...current]);
    fireAndForget(
      supabaseOperationalRepository.saveSosRequest(newSos),
      `SOS ${id}`,
      () => setSosRequests((current) => current.filter((item) => item.id !== id)),
    );
    pushSosEvent(
      id,
      `Gửi yêu cầu SOS khẩn cấp tại ${input.location.address}`,
      "created",
      input.reporter.name,
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
    fireAndForget(
      supabaseOperationalRepository.saveSosRequest(changed),
      `SOS ${sosId}`,
      () => setSosRequests((cur) => cur.map((it) => it.id === sosId ? sos : it)),
    );
    pushSosEvent(sosId, `Đánh dấu đã xử lý: ${summary}`, "resolved");
    logDutySystem(`Xử lý xong SOS ${sosId}`, { kind: "sos", id: sosId, code: sosId });
  };
  const cancelSos = (sosId: string) => {
    enforcePermission("sos_cancel", [sosResource(sosId)]);
    const sos = sosRequests.find((item) => item.id === sosId);
    if (!sos) return;
    const changed = transitionSos(sos, "Hủy", now());
    setSosRequests((current) =>
      current.map((item) => (item.id === sosId ? changed : item)),
    );
    fireAndForget(
      supabaseOperationalRepository.saveSosRequest(changed),
      `SOS ${sosId}`,
      () => setSosRequests((cur) => cur.map((it) => it.id === sosId ? sos : it)),
    );
    pushSosEvent(
      sosId,
      "Hủy yêu cầu SOS theo quyết định điều hành",
      "cancelled",
    );
    logDutySystem(`Hủy SOS ${sosId} theo quyết định điều hành`, { kind: "sos", id: sosId, code: sosId });
  };
  /**
   * Người gửi rút lại chính SOS của mình (dùng cho nút Hoàn tác 5 giây sau
   * SOS 1 chạm). Không yêu cầu quyền điều hành `sos_cancel` — thay vào đó
   * ràng buộc chặt: đúng chủ sở hữu + trạng thái còn cho phép hủy. Khi SOS đã
   * đi xa trong quy trình (đang cứu hộ/đã xử lý), transitionSos sẽ chặn và
   * người gửi phải liên hệ cán bộ.
   */
  const cancelOwnSos = (sosId: string) => {
    const sos = sosRequests.find((item) => item.id === sosId);
    if (!sos) throw new Error("Không tìm thấy yêu cầu SOS vừa gửi.");
    if (sos.ownerUserId == null || sos.ownerUserId !== currentUser?.id)
      throw new Error("Chỉ người gửi mới được rút lại yêu cầu SOS này.");
    const changed = transitionSos(sos, "Hủy", now());
    setSosRequests((current) =>
      current.map((item) => (item.id === sosId ? changed : item)),
    );
    fireAndForget(
      supabaseOperationalRepository.saveSosRequest(changed),
      `SOS ${sosId}`,
      () => setSosRequests((cur) => cur.map((it) => it.id === sosId ? sos : it)),
    );
    pushSosEvent(sosId, "Người gửi đã rút lại yêu cầu SOS", "cancelled");
    recordSecurityAudit(
      "OPERATIONAL_MUTATION",
      `Rút lại yêu cầu SOS ${sosId} do chính tài khoản gửi (trước khi điều phối)`,
      "SOS",
      sosId,
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
    fireAndForget(
      supabaseOperationalRepository.saveSosRequest(changed),
      `SOS ${sosId}`,
      () => setSosRequests((cur) => cur.map((it) => it.id === sosId ? sos : it)),
    );
    pushSosEvent(sosId, "Xác nhận kết quả và đóng SOS", "closed");
    logDutySystem(`Đóng SOS ${sosId}`, { kind: "sos", id: sosId, code: sosId });
  };
  /* ── V2: đơn vị báo xong → chờ xác nhận; cán bộ xác nhận; phân công lại có lý do ── */
  const reportTaskDone = (taskId: string, note: string) => {
    enforcePermission("task_report_done", taskResources(taskId), "báo hoàn thành nhiệm vụ");
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    const snapshot = currentOperationalSnapshot();
    const reviewNumber =
      Math.max(0, ...snapshot.taskReviews.map((r) => Number(r.id.replace(/\D/g, "")) || 0)) + 1;
    const review = createTaskReview(
      `TRV-${String(reviewNumber).padStart(4, "0")}`,
      task,
      actorName,
      note,
      now(),
    );
    const reported = reportTaskDoneEntity(task, now());
    const next = tasks.map((item) => (item.id === taskId ? reported : item));
    setTasks(next);
    fireAndForget(
      supabaseOperationalRepository.saveTask(reported),
      `Task ${taskId}`,
      () => setTasks((cur) => cur.map((it) => it.id === taskId ? task : it)),
    );
    setTaskReviews((current) => [review, ...current]);
    fireAndForget(
      supabaseOperationalRepository.saveTaskReview(review),
      `TaskReview ${review.id}`,
      () => setTaskReviews((cur) => cur.filter((r) => r.id !== review.id)),
    );
    advanceIncidentOnTaskEngagement(task.incidentId, next, taskId);
    pushTeamEvent(
      task.teamId,
      `${taskId} báo hoàn thành, chờ cán bộ xác nhận`,
      "task_status",
      task.teamId,
    );
    pushEvent(
      task.incidentId,
      `${taskId} báo hoàn thành (${note.trim()}) — chờ xác nhận`,
      "task_status",
      task.teamId || actorName,
    );
    logDutySystem(`Đơn vị báo hoàn thành ${taskId} — chờ xác nhận`, { kind: "task", id: taskId, code: taskId });
  };
  const reviewTaskResult = (taskId: string, accepted: boolean, note: string) => {
    enforcePermission("task_review", taskResources(taskId), "xác nhận kết quả nhiệm vụ");
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    const snapshot = currentOperationalSnapshot();
    const pending = snapshot.taskReviews.find(
      (r) => r.taskId === taskId && r.decision === "Chờ xác nhận",
    );
    if (!pending) throw new Error("Không có báo cáo kết quả nào đang chờ xác nhận.");
    const decided = decideTaskReview(pending, accepted, note, actorName, now());
    setTaskReviews((current) =>
      current.map((r) => (r.id === decided.id ? decided : r)),
    );
    fireAndForget(
      supabaseOperationalRepository.saveTaskReview(decided),
      `TaskReview ${decided.id}`,
      () => setTaskReviews((cur) => cur.map((r) => r.id === pending.id ? pending : r)),
    );
    if (accepted) {
      // Chấp nhận: đi qua transitionTask để đồng bộ đội, sự cố và SOS liên kết.
      transitionTask(taskId, "Hoàn thành");
      pushEvent(
        task.incidentId,
        `Cán bộ chấp nhận kết quả ${taskId}${note.trim() ? `: ${note.trim()}` : ""}`,
        "task_status",
      );
      return;
    }
    const rejected = reviewTaskResultEntity(task, false, now());
    const next = tasks.map((item) => (item.id === taskId ? rejected : item));
    setTasks(next);
    fireAndForget(
      supabaseOperationalRepository.saveTask(rejected),
      `Task ${taskId}`,
      () => setTasks((cur) => cur.map((it) => it.id === taskId ? task : it)),
    );
    syncIncidentProgress(task.incidentId, next);
    pushTeamEvent(
      task.teamId,
      `Kết quả ${taskId} bị từ chối: ${note.trim()} — tiếp tục thực hiện`,
      "task_status",
      task.teamId,
    );
    pushEvent(
      task.incidentId,
      `Cán bộ từ chối kết quả ${taskId}: ${note.trim()}`,
      "task_status",
    );
    logDutySystem(`Cán bộ từ chối kết quả ${taskId}, yêu cầu làm tiếp`, { kind: "task", id: taskId, code: taskId });
  };
  const reassignTask = (taskId: string, teamId: string, reason: string) => {
    enforcePermission(
      "task_assign",
      [...taskResources(taskId), teamResource(teamId)],
      "phân công lại nhiệm vụ",
    );
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    const team = teams.find((item) => item.id === teamId);
    if (!team) return;
    assertTeamDispatchable(team, taskId);
    const reassigned = reassignTaskEntity(
      task,
      { teamId, teamLeader: team.leader },
      reason,
      actorName,
      now(),
    );
    const next = tasks.map((item) => (item.id === taskId ? reassigned : item));
    setTasks(next);
    fireAndForget(
      supabaseOperationalRepository.saveTask(reassigned),
      `Task ${taskId}`,
      () => setTasks((current) => current.map((item) => item.id === taskId ? task : item)),
    );
    // Báo cáo đang chờ xác nhận (nếu có) không còn giá trị sau khi đổi đội.
    const pendingReview = currentOperationalSnapshot().taskReviews.find(
      (r) => r.taskId === taskId && r.decision === "Chờ xác nhận"
    );
    if (pendingReview) {
      const rejectedReview: TaskReview = {
        ...pendingReview,
        decision: "Từ chối",
        reviewedBy: actorName,
        reviewedAt: now(),
        reviewNote: `Phân công lại cho ${teamId}: ${reason.trim()}`,
      };
      setTaskReviews((current) =>
        current.map((r) => r.id === pendingReview.id ? rejectedReview : r)
      );
      fireAndForget(
        supabaseOperationalRepository.saveTaskReview(rejectedReview),
        `TaskReview ${rejectedReview.id}`,
      );
    }
    const nextTeams = teams.map((item) => {
      if (item.id === teamId)
        return assignTeamToOperation(item, taskId, task.incidentId, now());
      if (task.teamId && item.id === task.teamId)
        return recalculateTeamAssignment(item, next, now());
      return item;
    });
    setTeams(nextTeams);
    const assignedTeamEntity = nextTeams.find((item) => item.id === teamId);
    if (assignedTeamEntity) {
      fireAndForget(
        supabaseOperationalRepository.saveTeam(assignedTeamEntity),
        `Team ${teamId}`,
      );
    }
    if (task.teamId) {
      const prevTeam = nextTeams.find((item) => item.id === task.teamId);
      if (prevTeam) {
        fireAndForget(
          supabaseOperationalRepository.saveTeam(prevTeam),
          `Team ${task.teamId}`,
        );
      }
      pushTeamEvent(
        task.teamId,
        `Được rút khỏi ${taskId} (phân công lại: ${reason.trim()})`,
        "assignment",
      );
    }
    pushTeamEvent(teamId, `Nhận phân công lại nhiệm vụ ${taskId}`, "assignment");
    const linkedSos = sosRequests.find((item) => item.linkedTaskId === taskId);
    if (linkedSos) {
      const updatedSos = { ...linkedSos, assignedTeamId: teamId, lastUpdatedAt: now() };
      setSosRequests((current) =>
        current.map((item) => item.id === linkedSos.id ? updatedSos : item)
      );
      fireAndForget(
        supabaseOperationalRepository.saveSosRequest(updatedSos),
        `SOS ${linkedSos.id}`,
      );
    }
    pushEvent(
      task.incidentId,
      `Phân công lại ${taskId}: ${task.teamId || "chưa có đội"} → ${teamId}. Lý do: ${reason.trim()}`,
      "task_assignment",
    );
    logDutySystem(`Phân công lại ${taskId} sang đội ${teamId}`, { kind: "task", id: taskId, code: taskId });
  };

  /* ── V2: Phản ánh của người dân ── */
  const createCitizenReport = (input: NewCitizenReportInput) => {
    enforcePermission("report_create", [
      {
        type: "CitizenReport",
        id: "new",
        geographicScope: input.location.administrativeArea,
        ownerUserId: currentUser?.id ?? null,
      },
    ]);
    if (!currentUser) throw new Error("Cần đăng nhập để gửi phản ánh.");
    const snapshot = currentOperationalSnapshot();
    const number =
      Math.max(0, ...snapshot.citizenReports.map((r) => Number(r.id.replace(/\D/g, "")) || 0)) + 1;
    const id = `RPT-${String(number).padStart(4, "0")}`;
    const report = createCitizenReportEntity(id, input, currentUser.id, now());
    setCitizenReports((current) => [report, ...current]);
    fireAndForget(
      supabaseOperationalRepository.saveCitizenReport(report),
      `CitizenReport ${id}`,
      () => setCitizenReports((current) => current.filter((item) => item.id !== id)),
    );
    setCitizenReportEvents((current) => [
      {
        id: `RPE-${Date.now()}-${current.length + 1}`,
        reportId: id,
        type: "created",
        message: `Gửi phản ánh ${input.category} tại ${report.location.address}`,
        actor: actorName,
        timestamp: now(),
      },
      ...current,
    ]);
    return id;
  };
  const reviewCitizenReport = (
    reportId: string,
    decision: Exclude<CitizenReportStatus, "Mới">,
    note: string,
    duplicateOfId: string | null = null,
  ) => {
    enforcePermission("report_review", [citizenReportResource(reportId)], "đánh giá phản ánh");
    const report = currentOperationalSnapshot().citizenReports.find((r) => r.id === reportId);
    if (!report) return;
    const reviewed = reviewCitizenReportEntity(
      report,
      decision,
      note,
      actorName,
      now(),
      duplicateOfId,
    );
    setCitizenReports((current) =>
      current.map((r) => (r.id === reportId ? reviewed : r)),
    );
    fireAndForget(
      supabaseOperationalRepository.saveCitizenReport(reviewed),
      `CitizenReport ${reportId}`,
      () => setCitizenReports((cur) => cur.map((r) => r.id === reportId ? report : r)),
    );
    setCitizenReportEvents((current) => [
      {
        id: `RPE-${Date.now()}-${current.length + 1}`,
        reportId,
        type: "reviewed",
        message: `Đánh dấu ${decision}${note.trim() ? `: ${note.trim()}` : ""}${
          decision === "Trùng" && duplicateOfId ? ` (trùng với ${duplicateOfId})` : ""
        }`,
        actor: actorName,
        timestamp: now(),
      },
      ...current,
    ]);
  };

  /* ── V2: Cảnh báo công bố (nháp → công bố → cập nhật/thu hồi) ── */
  const pushPublishedAlertEvent = (
    alertId: string,
    type: "drafted" | "published" | "updated" | "withdrawn",
    message: string,
  ) =>
    setPublishedAlertEvents((current) => [
      {
        id: `PAE-${Date.now()}-${current.length + 1}`,
        alertId,
        type,
        message,
        actor: actorName,
        timestamp: now(),
      },
      ...current,
    ]);
  const draftPublishedAlert = (input: PublishedAlertDraftInput) => {
    enforcePermission("published_alert_manage", [
      { type: "PublishedAlert", id: "new", geographicScope: input.areaName },
    ]);
    const snapshot = currentOperationalSnapshot();
    const number =
      Math.max(0, ...snapshot.publishedAlerts.map((a) => Number(a.id.replace(/\D/g, "")) || 0)) + 1;
    const id = `PUB-${String(number).padStart(4, "0")}`;
    const draft = createPublishedAlertDraft(id, input, actorName, now());
    setPublishedAlerts((current) => [draft, ...current]);
    fireAndForget(
      supabaseOperationalRepository.savePublishedAlert(draft),
      `PublishedAlert ${id}`,
      () => setPublishedAlerts((current) => current.filter((item) => item.id !== id)),
    );
    pushPublishedAlertEvent(id, "drafted", `Soạn nháp cảnh báo: ${draft.title}`);
    return id;
  };
  const updatePublishedAlert = (alertId: string, input: PublishedAlertDraftInput) => {
    enforcePermission("published_alert_manage", [publishedAlertResource(alertId)]);
    const alert = currentOperationalSnapshot().publishedAlerts.find((a) => a.id === alertId);
    if (!alert) return;
    const updated = updatePublishedAlertEntity(alert, input, now());
    setPublishedAlerts((current) =>
      current.map((a) => (a.id === alertId ? updated : a)),
    );
    fireAndForget(
      supabaseOperationalRepository.savePublishedAlert(updated),
      `PublishedAlert ${alertId}`,
      () => setPublishedAlerts((cur) => cur.map((a) => a.id === alertId ? alert : a)),
    );
    pushPublishedAlertEvent(
      alertId,
      "updated",
      alert.status === "Đã công bố"
        ? `Cập nhật bản tin đã công bố (bản ${updated.revision})`
        : "Cập nhật nội dung nháp",
    );
  };
  const publishAlert = (alertId: string) => {
    enforcePermission("published_alert_manage", [publishedAlertResource(alertId)], "công bố cảnh báo");
    const alert = currentOperationalSnapshot().publishedAlerts.find((a) => a.id === alertId);
    if (!alert) return;
    const published = publishAlertEntity(alert, now());
    setPublishedAlerts((current) =>
      current.map((a) => (a.id === alertId ? published : a)),
    );
    fireAndForget(
      supabaseOperationalRepository.savePublishedAlert(published),
      `PublishedAlert ${alertId}`,
      () => setPublishedAlerts((cur) => cur.map((a) => a.id === alertId ? alert : a)),
    );
    pushPublishedAlertEvent(alertId, "published", `Công bố cảnh báo tới người dân: ${alert.title}`);
    logDutySystem(`Công bố cảnh báo tới người dân: ${alert.title}`);
  };
  const withdrawPublishedAlert = (alertId: string, reason: string) => {
    enforcePermission("published_alert_manage", [publishedAlertResource(alertId)], "thu hồi cảnh báo");
    const alert = currentOperationalSnapshot().publishedAlerts.find((a) => a.id === alertId);
    if (!alert) return;
    const withdrawn = withdrawAlertEntity(alert, reason, now());
    setPublishedAlerts((current) =>
      current.map((a) => (a.id === alertId ? withdrawn : a)),
    );
    fireAndForget(
      supabaseOperationalRepository.savePublishedAlert(withdrawn),
      `PublishedAlert ${alertId}`,
      () => setPublishedAlerts((cur) => cur.map((a) => a.id === alertId ? alert : a)),
    );
    pushPublishedAlertEvent(alertId, "withdrawn", `Thu hồi cảnh báo: ${reason.trim()}`);
  };

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
    assertIncidentCanClose(id, { tasks, sosRequests });
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
    // Persist closed incident
    const closedIncident = { ...incident, status: "Đã đóng" as const, assignedTeamId: null, progress: 100, closedAt: now(), updatedAt: now() };
    fireAndForget(
      supabaseOperationalRepository.saveIncident(closedIncident),
      `Incident ${id}`,
      () => setIncidents((cur) => cur.map((it) => it.id === id ? incident : it)),
    );
    if (incident.assignedTeamId) {
      const assignedTeamId = incident.assignedTeamId;
      const team = teams.find((t) => t.id === assignedTeamId);
      if (team && team.currentIncident === id) {
        const releasedTeam = recalculateTeamAssignment(team, tasks, now());
        setTeams((current) =>
          current.map((t) =>
            t.id === assignedTeamId ? releasedTeam : t,
          ),
        );
        fireAndForget(
          supabaseOperationalRepository.saveTeam(releasedTeam),
          `Team ${assignedTeamId}`,
        );
      }
    }
    pushEvent(id, `Đóng sự cố ${id} và ghi nhận hoàn tất xử lý`, "closed");
    logDutySystem(`Đóng sự cố ${id} và ghi nhận hoàn tất xử lý`, { kind: "incident", id, code: id });
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
    const { snapshot, alert } = findDerivedAlert(alertKey);
    const user = assertAlertReadable(alert);
    // No-op guard: cảnh báo ĐÃ đọc bởi chính người này → bấm tiếp không sinh
    // dòng ALERT_INTERACTION thứ hai cho cùng một trạng thái (owner 2026-09).
    if (
      snapshot.alertInteractions.some(
        (item) =>
          item.alertKey === alertKey &&
          item.readBy.some((receipt) => receipt.userId === user.id),
      )
    )
      return;
    setAlertInteractions((current) =>
      markAlertReadReceipt(current, alertKey, user.id, now()),
    );
    recordSecurityAudit(
      "ALERT_INTERACTION",
      `Đánh dấu đã đọc cảnh báo tác nghiệp ${alert.title ?? alertKey}`,
      "OperationalAlert",
      alertKey,
    );
  };
  const markAlertUnread = (alertKey: string) => {
    const { snapshot, alert } = findDerivedAlert(alertKey);
    const user = assertAlertReadable(alert);
    // No-op guard đối xứng với markAlertRead: chưa có receipt thì "hủy đánh
    // dấu đã đọc" không đổi gì → không sinh dòng ALERT_INTERACTION (owner 09-26).
    if (
      !snapshot.alertInteractions.some(
        (item) =>
          item.alertKey === alertKey &&
          item.readBy.some((receipt) => receipt.userId === user.id),
      )
    )
      return;
    setAlertInteractions((current) =>
      removeAlertReadReceipt(current, alertKey, user.id),
    );
    recordSecurityAudit(
      "ALERT_INTERACTION",
      `Hủy đánh dấu đã đọc cảnh báo tác nghiệp ${alert.title ?? alertKey}`,
      "OperationalAlert",
      alertKey,
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
    recordSecurityAudit(
      "ALERT_INTERACTION",
      `Đánh dấu đã đọc toàn bộ ${visible.length} cảnh báo tác nghiệp trong phạm vi`,
      "OperationalAlert",
      null,
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
    // Xác nhận ngầm định ĐÃ ĐỌC: bấm "Xác nhận tiếp nhận" là dấu chấm chưa đọc
    // phải tắt trên mọi màn hình (bell, danh sách, chi tiết) — người dùng không
    // phải bấm thêm nút "đã đọc" thứ hai. markAlertReadReceipt idempotent theo
    // (key, user) nên không sinh bản ghi trùng.
    setAlertInteractions(
      markAlertReadReceipt(outcome.interactions, alertKey, user.id, now()),
    );
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
    session,
    currentUser,
    users,
    securityAuditEvents,
    role,
    persistenceMode,
    persistenceError,
    lastSyncAt,
    can,
    login,
    register,
    resetPassword,
    logout,
    updateUserActive,
    updateUserRole,
    updateUserScope,
    updateSelfProfile,
    recordSecurityAudit,
    createIncident: atomic(createIncident),
    updateStatus: atomic(updateStatus),
    updateSeverity: atomic(updateSeverity),
    dispatchTeam: atomic(dispatchTeam),
    createTask: atomic(createTask),
    assignTaskTeam: atomic(assignTaskTeam),
    transitionTask: atomic(transitionTask),
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
    verifySos: atomic(verifySos),
    rejectSos: atomic(rejectSos),
    linkSosToIncident: atomic(linkSosToIncident),
    createIncidentFromSos: atomic(createIncidentFromSos),
    createRescueTaskFromSos: atomic(createRescueTaskFromSos),
    updateSosPriority: atomic(updateSosPriority),
    updateSosLocation: atomic(updateSosLocation),
    addSosUpdate: atomic(addSosUpdate),
    markSosNoContact: atomic(markSosNoContact),
    createSos: atomic(createSos),
    resolveSos: atomic(resolveSos),
    closeSos: atomic(closeSos),
    cancelSos: atomic(cancelSos),
    cancelOwnSos: atomic(cancelOwnSos),
    reportTaskDone: atomic(reportTaskDone),
    reviewTaskResult: atomic(reviewTaskResult),
    reassignTask: atomic(reassignTask),
    createCitizenReport: atomic(createCitizenReport),
    reviewCitizenReport: atomic(reviewCitizenReport),
    draftPublishedAlert: atomic(draftPublishedAlert),
    updatePublishedAlert: atomic(updatePublishedAlert),
    publishAlert: atomic(publishAlert),
    withdrawPublishedAlert: atomic(withdrawPublishedAlert),
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
