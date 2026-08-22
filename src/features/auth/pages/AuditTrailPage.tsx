import { useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Filter,
  Search,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { roleLabels } from "@/domain/auth/labels";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { AccessDeniedPage } from "./AccessDeniedPage";
export function AuditTrailPage({
  navigate,
}: {
  navigate: (path: string) => void;
}) {
  const store = useOperationalState();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState("all");
  const [action, setAction] = useState("all");
  const actions = [
    ...new Set(store.securityAuditEvents.map((item) => item.action)),
  ];
  const rows = useMemo(
    () =>
      store.securityAuditEvents.filter(
        (item) =>
          (!query ||
            `${item.actorName} ${item.action} ${item.resourceType} ${item.resourceId ?? ""}`
              .toLowerCase()
              .includes(query.toLowerCase())) &&
          (result === "all" || item.result === result) &&
          (action === "all" || item.action === action),
      ),
    [store.securityAuditEvents, query, result, action],
  );
  if (!store.can("audit_view"))
    return (
      <AccessDeniedPage
        navigate={navigate}
        reason="Chức năng nhật ký bảo mật yêu cầu quyền audit_view."
      />
    );
  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <div>
          <span>
            <ShieldCheck size={14} />
            Quản trị truy cập
          </span>
          <h1>Nhật ký bảo mật</h1>
          <p>
            Audit tập trung cho xác thực, phiên, quyết định quyền và quản trị
            tài khoản.
          </p>
        </div>
        <button onClick={() => navigate("/admin/users")}>
          <ArrowLeft size={15} />
          Người dùng
        </button>
      </header>
      <div className="audit-notice">
        <ShieldAlert size={17} />
        <div>
          <b>Ranh giới audit cục bộ</b>
          <p>
            Nhật ký được lưu tối đa 500 sự kiện trong localStorage; backend
            production cần append-only server log.
          </p>
        </div>
      </div>
      <section className="admin-content">
        <div className="admin-filters">
          <label>
            <Search size={15} />
            <input
              aria-label="Tìm kiếm nhật ký bảo mật"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm actor, action, resource"
            />
          </label>
          <label>
            <Filter size={14} />
            <select
              aria-label="Lọc theo hành động"
              value={action}
              onChange={(event) => setAction(event.target.value)}
            >
              <option value="all">Mọi hành động</option>
              {actions.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <select
            aria-label="Lọc theo kết quả"
            value={result}
            onChange={(event) => setResult(event.target.value)}
          >
            <option value="all">Mọi kết quả</option>
            <option>SUCCESS</option>
            <option>DENIED</option>
            <option>FAILED</option>
          </select>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table audit-table">
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Actor</th>
                <th>Hành động</th>
                <th>Tài nguyên</th>
                <th>Phạm vi</th>
                <th>Kết quả</th>
                <th>Lý do</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((event) => (
                <tr key={event.id}>
                  <td>
                    <span className="audit-time">
                      <Clock3 size={12} />
                      {format(event.timestamp)}
                    </span>
                  </td>
                  <td>
                    <b>{event.actorName}</b>
                    <small>
                      {event.role ? roleLabels[event.role] : "Chưa xác thực"}
                    </small>
                  </td>
                  <td>
                    <code>{event.action}</code>
                    {event.permission && <small>{event.permission}</small>}
                  </td>
                  <td>
                    {event.resourceType}
                    <small>{event.resourceId ?? "—"}</small>
                  </td>
                  <td>{event.geographicScope}</td>
                  <td>
                    <span
                      className={`audit-result ${event.result.toLowerCase()}`}
                    >
                      {event.result === "SUCCESS" ? (
                        <CheckCircle2 size={12} />
                      ) : (
                        <XCircle size={12} />
                      )}{" "}
                      {event.result}
                    </span>
                  </td>
                  <td>{event.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <p className="admin-empty">Không có audit event phù hợp.</p>
          )}
        </div>
      </section>
    </main>
  );
}
function format(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("vi-VN");
}
