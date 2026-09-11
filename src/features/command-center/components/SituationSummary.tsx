import { AlertTriangle } from "lucide-react";
import { getSituationSummary } from "@/application/command-center/commandCenterQueries";
import { isTaskOverdue } from "@/domain/tasks/rules";
import { useOperationalState } from "@/state/operations/OperationalStateContext";

const CLOSED_SOS = ["Đã xử lý", "Đã đóng", "Từ chối"];

/**
 * DẢI TÌNH HÌNH 1 DÒNG (thay cho khối "Tóm tắt tình hình" cồng kềnh cũ)
 * ─────────────────────────────────────────────────────────────────────────
 * Trang Chỉ huy chỉ trả lời "cần làm gì ngay": dải này cho biết mức độ + 4
 * con số phải xử lý (SOS mở · sự cố mở · NV quá hạn · đội sẵn sàng). Muốn
 * đọc sâu thì sang tab "Tình hình thiên tai" — không trùng metrics nữa.
 */
export function SituationSummary() {
  const store = useOperationalState();
  const situation = getSituationSummary(store);
  const openSos = store.sosRequests.filter(
    (item) => !CLOSED_SOS.includes(item.status),
  ).length;
  const openIncidents = store.incidents.filter(
    (item) => !["Đã đóng", "Đã kiểm soát"].includes(item.status),
  ).length;
  const overdueTasks = store.tasks.filter((task) => isTaskOverdue(task)).length;
  const readyTeams = store.teams.filter(
    (team) => team.status === "Sẵn sàng",
  ).length;
  return (
    <section className="cc-situation-strip" aria-labelledby="situation-title">
      <span className="cc-situation-strip-level">
        <AlertTriangle size={15} />
        <span id="situation-title">
          Mức độ: <b>{situation.level}</b>
        </span>
      </span>
      <span className="cc-situation-strip-sep" aria-hidden="true" />
      <span>
        SOS mở <b className={openSos > 0 ? "cc-danger-text" : ""}>{openSos}</b>
      </span>
      <span>
        Sự cố mở <b>{openIncidents}</b>
      </span>
      <span>
        NV quá hạn{" "}
        <b className={overdueTasks > 0 ? "cc-danger-text" : ""}>{overdueTasks}</b>
      </span>
      <span>
        Đội sẵn sàng <b>{readyTeams}</b>
      </span>
    </section>
  );
}
