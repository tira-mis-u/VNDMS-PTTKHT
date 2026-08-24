import {
  AlertTriangle,
  BookOpenCheck,
  ChevronRight,
  LockKeyhole,
} from "lucide-react";
import { executionSummary } from "@/application/playbooks/playbookQueries";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { Badge, Progress } from "@/components/ui";
export function PlaybookOperations({
  navigate,
}: {
  navigate: (path: string) => void;
}) {
  const { playbooks, playbookExecutions } = useOperationalState();
  const active = playbookExecutions.filter((item) =>
    ["Đang hoạt động", "Tạm dừng"].includes(item.status),
  );
  return (
    <section className="cc-panel playbook-operations">
      <div className="cc-panel-header">
        <div>
          <span>Quy trình tác chiến đang chạy</span>
          <small>Tiến độ, bước hiện tại và ngoại lệ</small>
        </div>
        <button onClick={() => navigate("/playbooks")}>
          Tất cả phương án điều phối
          <ChevronRight size={13} />
        </button>
      </div>
      <div className="cc-playbook-list">
        {active.map((execution) => {
          const playbook = playbooks.find(
            (item) => item.id === execution.playbookId,
          );
          if (!playbook) return null;
          const summary = executionSummary(playbook, execution);
          return (
            <button
              key={execution.id}
              onClick={() => navigate(`/playbooks/${playbook.id}/execute`)}
            >
              <span className="cc-playbook-icon">
                <BookOpenCheck size={17} />
              </span>
              <span className="cc-playbook-copy">
                <span>
                  <b>
                    {playbook.code} · {playbook.name}
                  </b>
                  <Badge
                    tone={
                      execution.status === "Đang hoạt động" ? "green" : "amber"
                    }
                  >
                    {execution.status}
                  </Badge>
                </span>
                <small className="cc-playbook-current">
                  <span>Bước hiện tại</span>
                  {summary.current?.name ?? "Chưa xác định"} ·{" "}
                  {execution.incidentId}
                </small>
                <div className="cc-playbook-progress">
                  <Progress value={summary.progress} tone="blue" />
                  <b>{summary.progress}%</b>
                </div>
                <em className="cc-playbook-next">
                  <span>Tiếp theo</span>
                  {summary.next?.name ?? "Chưa có"}
                </em>
                {summary.blocked.length > 0 && (
                  <strong>
                    <LockKeyhole size={12} />
                    {summary.blocked.length} bước bị chặn · cần hoàn thành tiên
                    quyết
                  </strong>
                )}
              </span>
              <ChevronRight size={15} />
            </button>
          );
        })}
        {!active.length && (
          <p>
            <AlertTriangle size={14} />
            Không có phương án điều phối đang thực hiện.
          </p>
        )}
      </div>
    </section>
  );
}
