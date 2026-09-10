import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { OperationalSnapshot } from "@/application/operations/operationalSnapshot";
import {
  OperationalMutationBoundary,
  type AtomicMutationState,
} from "@/application/operations/operationalMutationBoundary";

/** Không còn "control state" (mô phỏng đã gỡ); giữ generic để boundary không đổi. */
export type OperationalControlState = Record<string, never>;
export type OperationalAtomicState = AtomicMutationState<
  OperationalSnapshot,
  OperationalControlState
>;

type SnapshotSetter<K extends keyof OperationalSnapshot> = Dispatch<
  SetStateAction<OperationalSnapshot[K]>
>;

function resolve<T>(action: SetStateAction<T>, current: T): T {
  return typeof action === "function"
    ? (action as (value: T) => T)(current)
    : action;
}

/** React state mechanics only. Business rules remain in domain/application modules. */
export function useAtomicOperationalState(initialSnapshot: OperationalSnapshot) {
  const [state, setState] = useState<OperationalAtomicState>(() => ({
    snapshot: initialSnapshot,
    control: {},
  }));
  const stateRef = useRef(state);
  const boundary = useRef(
    new OperationalMutationBoundary<OperationalSnapshot, OperationalControlState>(),
  );

  const setSlice =
    <K extends keyof OperationalSnapshot>(key: K): SnapshotSetter<K> =>
    (action) => {
      if (boundary.current.active) {
        boundary.current.updateSnapshot((snapshot) => ({
          ...snapshot,
          [key]: resolve(action, snapshot[key]),
        }));
        return;
      }
      setState((current) => ({
        ...current,
        snapshot: {
          ...current.snapshot,
          [key]: resolve(action, current.snapshot[key]),
        },
      }));
    };

  const executeAtomic = <TResult>(operation: () => TResult): TResult =>
    boundary.current.execute(
      stateRef.current,
      (next) => {
        stateRef.current = next;
        setState(next);
      },
      operation,
    );

  return {
    ...state.snapshot,
    setIncidents: setSlice("incidents"),
    setEvents: setSlice("events"),
    setTasks: setSlice("tasks"),
    setTaskUpdates: setSlice("taskUpdates"),
    setTaskReviews: setSlice("taskReviews"),
    setTeams: setSlice("teams"),
    setTeamEvents: setSlice("teamEvents"),
    setShelters: setSlice("shelters"),
    setShelterEvents: setSlice("shelterEvents"),
    setSosRequests: setSlice("sosRequests"),
    setSosEvents: setSlice("sosEvents"),
    setCitizenReports: setSlice("citizenReports"),
    setCitizenReportEvents: setSlice("citizenReportEvents"),
    setPublishedAlerts: setSlice("publishedAlerts"),
    setPublishedAlertEvents: setSlice("publishedAlertEvents"),
    setAlertInteractions: setSlice("alertInteractions"),
    setAlertEvents: setSlice("alertEvents"),
    currentOperationalSnapshot: () =>
      boundary.current.active
        ? boundary.current.readSnapshot()
        : stateRef.current.snapshot,
    executeAtomic,
  };
}
