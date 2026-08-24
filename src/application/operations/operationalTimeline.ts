import type { OperationalSnapshot } from "./operationalSnapshot";
import type { IncidentEvent } from "../../domain/incidents/types";
import type { TeamEvent } from "../../domain/teams/types";
import type { ShelterEvent } from "../../domain/shelters/types";
import type { EvacuationEvent } from "../../domain/evacuations/types";
import type { SosEvent } from "../../domain/sos/types";
import type { ReliefEvent } from "../../domain/relief/types";
import type { RecoveryEvent } from "../../domain/recovery/types";
import type {
  PlaybookExecution,
  PlaybookTimelineEvent,
} from "../../domain/playbooks/types";

type Update<T> = (update: (current: T[]) => T[]) => void;
export interface OperationalTimelineWriter {
  read: () => OperationalSnapshot;
  actorName: string;
  now: () => string;
  timeOnly: () => string;
  setEvents: Update<IncidentEvent>;
  setTeamEvents: Update<TeamEvent>;
  setShelterEvents: Update<ShelterEvent>;
  setEvacuationEvents: Update<EvacuationEvent>;
  setSosEvents: Update<SosEvent>;
  setReliefEvents: Update<ReliefEvent>;
  setRecoveryEvents: Update<RecoveryEvent>;
  setPlaybookEvents: Update<PlaybookTimelineEvent>;
  setPlaybookExecutions: Update<PlaybookExecution>;
}

export function createOperationalTimeline(writer: OperationalTimelineWriter) {
  const pushEvent = (
    incidentId: string,
    message: string,
    type = "manual",
    actor = writer.actorName,
  ) =>
    writer.setEvents((current) => [
      {
        id: `EV-${Date.now()}-${current.length}`,
        incidentId,
        type,
        message,
        actor,
        timestamp: writer.timeOnly(),
        source: "Trung tâm điều hành",
      },
      ...current,
    ]);
  const pushTeamEvent = (
    teamId: string,
    message: string,
    type = "status",
    actor = writer.actorName,
    source = "Trung tâm điều hành",
  ) =>
    writer.setTeamEvents((current) => [
      {
        id: `TE-${Date.now()}-${current.length}`,
        teamId,
        type,
        message,
        actor,
        timestamp: writer.timeOnly(),
        source,
      },
      ...current,
    ]);
  const pushShelterEvent = (
    shelterId: string,
    message: string,
    type = "update",
  ) =>
    writer.setShelterEvents((current) => [
      {
        id: `SHE-${Date.now()}-${current.length}`,
        shelterId,
        type,
        message,
        actor: writer.actorName,
        timestamp: writer.timeOnly(),
        source: "Điều hành sơ tán",
      },
      ...current,
    ]);
  const pushEvacuationEvent = (
    operationId: string,
    message: string,
    type = "update",
    actor = writer.actorName,
  ) =>
    writer.setEvacuationEvents((current) => [
      {
        id: `EVE-${Date.now()}-${current.length}`,
        operationId,
        type,
        message,
        actor,
        timestamp: writer.timeOnly(),
        source: "Trung tâm điều hành",
      },
      ...current,
    ]);
  const pushSosEvent = (
    sosId: string,
    message: string,
    type = "update",
    actor = writer.actorName,
    source = "Trung tâm điều hành",
  ) =>
    writer.setSosEvents((current) => [
      {
        id: `SOSE-${Date.now()}-${current.length}`,
        sosId,
        type,
        message,
        actor,
        timestamp: writer.timeOnly(),
        source,
      },
      ...current,
    ]);
  const pushReliefEvent = (
    entityType: "request" | "warehouse" | "shipment",
    entityId: string,
    message: string,
    type = "update",
  ) =>
    writer.setReliefEvents((current) => [
      {
        id: `RLE-${Date.now()}-${current.length}`,
        entityType,
        entityId,
        type,
        message,
        actor: writer.actorName,
        timestamp: writer.timeOnly(),
        source: "Điều hành hậu cần",
      },
      ...current,
    ]);
  const pushRecoveryEvent = (
    entityType: "assessment" | "project",
    entityId: string,
    incidentId: string,
    message: string,
    type: string,
    actor = writer.actorName,
  ) => {
    writer.setRecoveryEvents((current) => [
      {
        id: `RCE-${Date.now()}-${current.length}`,
        entityType,
        entityId,
        incidentId,
        type,
        message,
        actor,
        timestamp: writer.now(),
        source: "Điều hành khôi phục",
      },
      ...current,
    ]);
    pushEvent(incidentId, message, "recovery", actor);
  };
  const pushTemplatePlaybookEvent = (
    playbookId: string,
    message: string,
    type: string,
  ) =>
    writer.setPlaybookEvents((current) => [
      {
        id: `PBE-${Date.now()}-${current.length}`,
        executionId: null,
        playbookId,
        incidentId: null,
        stepId: null,
        type,
        message,
        actor: writer.actorName,
        timestamp: writer.now(),
        source: "Quản trị kế hoạch ứng phó",
      },
      ...current,
    ]);
  const pushPlaybookEvent = (
    executionId: string,
    stepId: string | null,
    message: string,
    type = "update",
    actor = writer.actorName,
  ) => {
    const execution = writer
      .read()
      .playbookExecutions.find((item) => item.id === executionId);
    if (!execution) return;
    const event: PlaybookTimelineEvent = {
      id: `PBE-${Date.now()}-${writer.read().playbookEvents.length}`,
      executionId,
      playbookId: execution.playbookId,
      incidentId: execution.incidentId,
      stepId,
      type,
      message,
      actor,
      timestamp: writer.now(),
      source: "Điều hành kế hoạch ứng phó",
    };
    writer.setPlaybookEvents((current) => [event, ...current]);
    writer.setPlaybookExecutions((current) =>
      current.map((item) =>
        item.id === executionId
          ? {
              ...item,
              timeline: [event, ...item.timeline],
              updatedAt: writer.now(),
            }
          : item,
      ),
    );
    pushEvent(execution.incidentId, message, "playbook", actor);
  };
  return {
    pushEvent,
    pushTeamEvent,
    pushShelterEvent,
    pushEvacuationEvent,
    pushSosEvent,
    pushReliefEvent,
    pushRecoveryEvent,
    pushTemplatePlaybookEvent,
    pushPlaybookEvent,
  };
}
