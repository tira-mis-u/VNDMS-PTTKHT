import {
  AlertTriangle,
  ChevronRight,
  ClipboardCheck,
  Hammer,
} from "lucide-react";
import { getRecoveryExceptions } from "@/application/recovery/recoveryQueries";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { Badge } from "@/components/ui";
export function RecoveryExceptions({
  navigate,
}: {
  navigate: (path: string) => void;
}) {
  const { damageAssessments, recoveryProjects } = useOperationalState();
  const rows = getRecoveryExceptions(damageAssessments, recoveryProjects);
  return (
    <section className="cc-panel recovery-exceptions">
      <div className="cc-panel-header">
        <div>
          <span>Ngoại lệ khôi phục</span>
          <small>Xác minh, thời hạn, ngân sách và mốc tiến độ</small>
        </div>
        <button onClick={() => navigate("/recovery")}>
          Mở nghiệp vụ
          <ChevronRight size={13} />
        </button>
      </div>
      <div className="recovery-exception-list">
        {rows.slice(0, 6).map((item) => (
          <button
            key={`${item.kind}-${item.id}`}
            onClick={() =>
              navigate(
                item.kind === "assessment"
                  ? `/recovery/assessments/${item.id}`
                  : `/recovery/projects/${item.id}`,
              )
            }
          >
            <span className={`recovery-exception-icon ${item.kind}`}>
              {item.kind === "assessment" ? (
                <ClipboardCheck size={15} />
              ) : (
                <Hammer size={15} />
              )}
            </span>
            <span>
              <b>{item.label}</b>
              <small>
                {item.kind === "assessment"
                  ? "Đánh giá cần quyết định xác minh"
                  : "Dự án cần can thiệp điều hành"}
              </small>
            </span>
            <Badge tone={item.severity === "Khẩn cấp" ? "red" : "amber"}>
              {item.severity}
            </Badge>
          </button>
        ))}
        {!rows.length && (
          <p>
            <AlertTriangle size={14} />
            Không có ngoại lệ khôi phục cần xử lý.
          </p>
        )}
      </div>
    </section>
  );
}
