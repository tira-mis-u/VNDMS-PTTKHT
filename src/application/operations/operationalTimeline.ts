import type { OperationalSnapshot } from "./operationalSnapshot";
import type { IncidentEvent } from "../../domain/incidents/types";
import type { TeamEvent } from "../../domain/teams/types";
import type { ShelterEvent } from "../../domain/shelters/types";
import type { SosEvent } from "../../domain/sos/types";

type Update<T> = (update: (current: T[]) => T[]) => void;
export interface OperationalTimelineWriter {
  read: () => OperationalSnapshot;
  actorName: string;
  now: () => string;
  timeOnly: () => string;
  setEvents: Update<IncidentEvent>;
  setTeamEvents: Update<TeamEvent>;
  setShelterEvents: Update<ShelterEvent>;
  setSosEvents: Update<SosEvent>;
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
  return {
    pushEvent,
    pushTeamEvent,
    pushShelterEvent,
    pushSosEvent,
  };
}
