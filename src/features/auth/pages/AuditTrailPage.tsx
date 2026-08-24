import { PageSectionHeader, Input } from "@/components/ui";
import { Select as UiSelect } from "@/components/ui/Select";
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
import {
  auditActionLabel,
  auditResourceLabel,
  auditResultLabel,
  auditTimestampLabel,
  roleLabels,
} from "@/domain/auth/labels";
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
        reason="Tài khoản hiện tại chưa được cấp quyền xem nhật ký bảo mật."
      />
    );
  return (
    <main className="admin-page">
      <PageSectionHeader
        section="Quản trị truy cập"
        title="Nhật ký bảo mật"
        description="Nhật ký tập trung cho xác thực, phiên, quyết định quyền và quản trị tài khoản."
        icon={ShieldCheck}
        className="admin-page-header"
        actions={
          <button onClick={() => navigate("/admin/users")}>
            <ArrowLeft size={15} />
            Người dùng
          </button>
        }
      />
      <div className="audit-notice">
        <ShieldAlert size={17} />
        <div>
          <b>Phạm vi nhật ký bảo mật cục bộ</b>
          <p>
            Nhật ký được lưu tối đa 500 sự kiện trong bộ nhớ trình duyệt; môi
            trường vận hành cần nhật ký máy chủ chỉ được phép ghi nối tiếp.
          </p>
        </div>
      </div>
      <section className="admin-content">
        <div className="admin-filters">
          <label className="input-with-icon">
            <Search size={15} />
            <Input
              aria-label="Tìm kiếm nhật ký bảo mật"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm người thực hiện, hành động hoặc đối tượng"
            />
          </label>
          <label>
            <Filter size={14} />
            <UiSelect
              aria-label="Lọc theo hành động"
              value={action}
              onChange={(event) => setAction(event.target.value)}
            >
              <option value="all">Mọi hành động</option>
              {actions.map((item) => (
                <option key={item} value={item}>
                  {auditActionLabel(item)}
                </option>
              ))}
            </UiSelect>
          </label>
          <UiSelect
            aria-label="Lọc theo kết quả"
            value={result}
            onChange={(event) => setResult(event.target.value)}
          >
            <option value="all">Mọi kết quả</option>
            <option value="SUCCESS">Thành công</option>
            <option value="DENIED">Bị từ chối</option>
            <option value="FAILED">Không thành công</option>
          </UiSelect>
        </div>
        <div
          className="admin-table-wrap"
          role="region"
          aria-label="Bảng nhật ký bảo mật"
          tabIndex={0}
        >
          <table className="admin-table audit-table">
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Người thực hiện</th>
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
                      {auditTimestampLabel(event.timestamp)}
                    </span>
                  </td>
                  <td>
                    <b>{event.actorName}</b>
                    <small>
                      {event.role ? roleLabels[event.role] : "Chưa xác thực"}
                    </small>
                  </td>
                  <td>
                    <b>{auditActionLabel(event.action)}</b>
                    {event.permission && <small>Quyền nghiệp vụ liên quan</small>}
                  </td>
                  <td>
                    {auditResourceLabel(event.resourceType)}
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
                      {auditResultLabel(event.result)}
                    </span>
                  </td>
                  <td>{event.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <p className="admin-empty">Không có sự kiện nhật ký phù hợp.</p>
          )}
        </div>
      </section>
    </main>
  );
}
