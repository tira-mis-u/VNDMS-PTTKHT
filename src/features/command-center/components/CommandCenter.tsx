import { useCallback, useState } from "react";
import {
  CalendarDays,
  ChevronRight,
  FlaskConical,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import {
  getCommandCenterHeader,
  type CommandCenterEntityRef,
} from "@/application/command-center/commandCenterQueries";
import { Button, PageSectionHeader, StatusDot } from "@/components/ui";
import { ActionDialog } from "./ActionDialog";
import { ActionQueue } from "./ActionQueue";
import { CoordinationTimeline } from "./CoordinationTimeline";
import { DetailDrawer } from "./DetailDrawer";
import { IncidentOverview } from "./IncidentOverview";
import { OperationalAlerts } from "./OperationalAlerts";
import { OperationalMap } from "./OperationalMap";
import { QuickActions } from "./QuickActions";
import { ResourceExceptions } from "./ResourceExceptions";
import { RecoveryExceptions } from "./RecoveryExceptions";
import { PlaybookOperations } from "./PlaybookOperations";
import { LogisticsExceptions } from "./LogisticsExceptions";
import { SituationSummary } from "./SituationSummary";
import { useOperationalState } from "@/state/operations/OperationalStateContext";

export function CommandCenter({
  navigate,
}: {
  navigate: (path: string) => void;
}) {
  const store = useOperationalState();
  const { simulation } = store;
  const scenario = getCommandCenterHeader(store, simulation);
  const [selected, setSelected] = useState<CommandCenterEntityRef | null>(null);
  const [dialogAction, setDialogAction] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const openEntity = useCallback(
    (ref: CommandCenterEntityRef) => setSelected(ref),
    [],
  );
  const refresh = () => {
    setRefreshing(true);
    window.setTimeout(() => setRefreshing(false), 700);
  };
  /** CTA trong drawer điều hướng tới trang canonical thay cho dialog giả. */
  const handleDrawerAction = useCallback(
    (label: string) => {
      if (label === "Quản lý sự cố" && selected?.kind === "incident") {
        const path = `/incidents/${selected.id}`;
        setSelected(null);
        navigate(path);
        return;
      }
      if (label === "Mở phương án điều phối" && selected) {
        const path =
          selected.kind === "warehouse"
            ? `/relief/warehouses/${selected.id}`
            : selected.kind === "team"
              ? `/teams/${selected.id}`
              : selected.kind === "shelter"
                ? `/shelters/${selected.id}`
                : selected.kind === "sos"
                  ? `/sos/${selected.id}`
                  : "/";
        setSelected(null);
        navigate(path);
        return;
      }
      setDialogAction(label);
    },
    [selected, navigate],
  );

  return (
    <div className="workspace-content cc-command-center">
      <PageSectionHeader
        section="Quản lý & điều hành"
        title="Trung tâm điều hành"
        description={
          <span className="cc-page-context">
            <span>Phạm vi: <b>{scenario.scope}</b></span>
            <i />
            <span className="cc-operation-status">
              <StatusDot tone="blue" />
              Trạng thái vận hành: <b>{scenario.status}</b>
            </span>
          </span>
        }
        icon={SlidersHorizontal}
        className="cc-page-header"
        actions={
          <div className="cc-header-controls">
            <span className="filter-chip" aria-label="Phạm vi thời gian 24 giờ gần nhất">
              <CalendarDays size={15} />
              <span>24 giờ gần nhất</span>
            </span>
            <span className="filter-chip" aria-label={`Kịch bản ${scenario.name}`}>
              <SlidersHorizontal size={15} />
              <span>{scenario.name}</span>
            </span>
            <Button
              variant="secondary"
              onClick={refresh}
              aria-label={refreshing ? "Đang làm mới dữ liệu" : "Làm mới dữ liệu"}
            >
              <RefreshCw size={15} className={refreshing ? "spin-once" : ""} />
              <span>{refreshing ? "Đang làm mới" : "Làm mới"}</span>
            </Button>
          </div>
        }
      />

      {simulation.tick > 0 && (
        <button
          className="cc-simulation-strip"
          onClick={() => navigate("/simulation")}
        >
          <FlaskConical size={15} />
          <b>DỮ LIỆU MÔ PHỎNG</b>
          <span>
            Bước mô phỏng {simulation.tick}/{simulation.maxTick} · {simulation.stage} ·
            Mực nước {simulation.riverLevel.toFixed(2)} m · Các bảng dưới đây
            đang đọc dữ liệu nghiệp vụ đã được đồng bộ.
          </span>
          <ChevronRight size={14} />
        </button>
      )}
      <div className="cc-layout">
        <QuickActions onAction={setDialogAction} />
        <SituationSummary />
        <OperationalAlerts navigate={navigate} />
        <ActionQueue
          onOpen={openEntity}
          onQuickAction={setDialogAction}
          onNavigate={navigate}
        />
        <IncidentOverview onNavigate={navigate} />
        <OperationalMap onOpen={openEntity} onNavigate={navigate} />
        <CoordinationTimeline />
        <ResourceExceptions
          onOpen={openEntity}
          onQuickAction={setDialogAction}
          onNavigate={navigate}
        />
        <LogisticsExceptions navigate={navigate} />
        <PlaybookOperations navigate={navigate} />
        <RecoveryExceptions navigate={navigate} />
      </div>
      <DetailDrawer
        selected={selected}
        onClose={() => setSelected(null)}
        onAction={handleDrawerAction}
      />
      <ActionDialog
        action={dialogAction}
        presetSosId={selected?.kind === "sos" ? selected.id : undefined}
        navigate={navigate}
        onClose={() => setDialogAction(null)}
      />
    </div>
  );
}
