import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { OperationalSnapshot } from "@/application/operations/operationalSnapshot";
import {
  OperationalMutationBoundary,
  type AtomicMutationState,
} from "@/application/operations/operationalMutationBoundary";
import type { SimulationState } from "@/domain/simulation/types";

export type OperationalAtomicState = AtomicMutationState<
  OperationalSnapshot,
  SimulationState
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
export function useAtomicOperationalState(
  initialSnapshot: OperationalSnapshot,
  initialSimulation: SimulationState,
) {
  const [state, setState] = useState<OperationalAtomicState>(() => ({
    snapshot: initialSnapshot,
    control: initialSimulation,
  }));
  const stateRef = useRef(state);
  const boundary = useRef(
    new OperationalMutationBoundary<OperationalSnapshot, SimulationState>(),
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

  const setSimulation: Dispatch<SetStateAction<SimulationState>> = (action) => {
    if (boundary.current.active) {
      boundary.current.updateControl((control) => resolve(action, control));
      return;
    }
    setState((current) => ({
      ...current,
      control: resolve(action, current.control),
    }));
  };

  const applyOperationalSnapshot = (snapshot: OperationalSnapshot) => {
    if (boundary.current.active) {
      boundary.current.updateSnapshot(() => snapshot);
      return;
    }
    setState((current) => ({ ...current, snapshot }));
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
    simulation: state.control,
    setIncidents: setSlice("incidents"),
    setEvents: setSlice("events"),
    setTasks: setSlice("tasks"),
    setTaskUpdates: setSlice("taskUpdates"),
    setTeams: setSlice("teams"),
    setTeamEvents: setSlice("teamEvents"),
    setShelters: setSlice("shelters"),
    setShelterEvents: setSlice("shelterEvents"),
    setEvacuationOperations: setSlice("evacuationOperations"),
    setEvacuationEvents: setSlice("evacuationEvents"),
    setSosRequests: setSlice("sosRequests"),
    setSosEvents: setSlice("sosEvents"),
    setWarehouses: setSlice("warehouses"),
    setInventory: setSlice("inventory"),
    setReliefRequests: setSlice("reliefRequests"),
    setReservations: setSlice("reservations"),
    setShipments: setSlice("shipments"),
    setReliefEvents: setSlice("reliefEvents"),
    setPlaybooks: setSlice("playbooks"),
    setPlaybookExecutions: setSlice("playbookExecutions"),
    setPlaybookEvents: setSlice("playbookEvents"),
    setDamageAssessments: setSlice("damageAssessments"),
    setRecoveryProjects: setSlice("recoveryProjects"),
    setRecoveryEvents: setSlice("recoveryEvents"),
    setAlertInteractions: setSlice("alertInteractions"),
    setAlertEvents: setSlice("alertEvents"),
    setSimulation,
    currentOperationalSnapshot: () =>
      boundary.current.active
        ? boundary.current.readSnapshot()
        : stateRef.current.snapshot,
    currentSimulationState: () =>
      boundary.current.active
        ? boundary.current.readControl()
        : stateRef.current.control,
    applyOperationalSnapshot,
    executeAtomic,
  };
}
