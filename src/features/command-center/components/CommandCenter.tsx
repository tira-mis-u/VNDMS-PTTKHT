import { useCallback, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import {
  getCommandCenterHeader,
  type CommandCenterEntityRef,
} from "@/application/command-center/commandCenterQueries";
import { PageSectionHeader, StatusDot } from "@/components/ui";
import { CommandSectionTabs } from "@/components/navigation/GroupedSectionTabs";
import { ResourceAlertStrip } from "./ResourceAlertStrip";
import { ActionDialog } from "./ActionDialog";
import { ActionQueue } from "./ActionQueue";
import { DutyLog } from "./DutyLog";
import { DetailDrawer } from "./DetailDrawer";
import { OperationalAlerts } from "./OperationalAlerts";
import { CommandCenterMap } from "./CommandCenterMap";
import { QuickActions } from "./QuickActions";
import { SituationSummary } from "./SituationSummary";
import { useOperationalState } from "@/state/operations/OperationalStateContext";

export function CommandCenter({
  navigate,
}: {
  navigate: (path: string) => void;
}) {
  const store = useOperationalState();
  const scenario = getCommandCenterHeader(store);
  const [selected, setSelected] = useState<CommandCenterEntityRef | null>(null);
  const [dialogAction, setDialogAction] = useState<string | null>(null);
  const openEntity = useCallback(
    (ref: CommandCenterEntityRef) => setSelected(ref),
    [],
  );
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
          selected.kind === "team"
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
        section="Điều hành"
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
      />
      <CommandSectionTabs active="/" navigate={navigate} />

      {/*
        Trung tâm điều hành chỉ giữ những gì thay đổi theo phút VÀ dẫn tới một
        hành động ngay: hàng đợi việc, tình hình chung, cảnh báo, bản đồ, sổ
        trực ban.
      */}
      <div className="cc-layout">
        <QuickActions onAction={setDialogAction} />
        <SituationSummary />
        <ResourceAlertStrip onNavigate={navigate} />
        <ActionQueue
          onOpen={openEntity}
          onQuickAction={setDialogAction}
          onNavigate={navigate}
        />
        <OperationalAlerts navigate={navigate} />
        <CommandCenterMap onNavigate={navigate} />
        <DutyLog />
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
