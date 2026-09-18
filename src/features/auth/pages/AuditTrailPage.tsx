import { PageSectionHeader, Input } from "@/components/ui";
import { Select as UiSelect } from "@/components/ui/Select";
import { useEffect, useMemo, useState } from "react";
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
import { permissionLabel } from "@/lib/permissions/labels";
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

  // Mở trang = đã đọc tới hiện tại → sidebar hết huy hiệu đỏ.
  // Mốc "đã xem" cũ được giữ lại trong phiên để đóng dấu các dòng mới
  // (người dùng biết sự kiện nào vừa phát sinh, dòng nào mới nhất).
  const viewerId = store.currentUser?.id;
  // Mốc "đã xem" trước khi mở trang — đọc một lần lúc render, trước khi
  // effect dưới đây đóng dấu mới. Các dòng phát sinh sau mốc này được gắn
  // nhãn "Mới"/"Mới nhất" để người dùng nhận ra sự kiện vừa diễn ra.
  const seenKey = viewerId ? `vndms_audit_seen_${viewerId}` : null;
  const newSinceMs = useMemo(() => {
    if (!seenKey) return null;
    try {
      const raw = localStorage.getItem(seenKey);
      if (!raw) return null;
      const ms = Date.parse(raw);
      return Number.isNaN(ms) ? null : ms;
    } catch {
      return null;
    }
  }, [seenKey]);
  useEffect(() => {
    if (!seenKey) return;
    try {
      localStorage.setItem(seenKey, new Date().toISOString());
    } catch {
      /* bỏ qua */
    }
  }, [seenKey]);
  const actions = [
    ...new Set(store.securityAuditEvents.map((item) => item.action)),
  ];
  const rows = useMemo(
    () => {
      const base = store.securityAuditEvents.filter(
        (item) =>
          (!query ||
            `${item.actorName} ${item.action} ${item.resourceType} ${item.resourceId ?? ""}`
              .toLowerCase()
              .includes(query.toLowerCase())) &&
          (result === "all" || item.result === result) &&
          (action === "all" || item.action === action),
      );
      // Một thao tác quản trị User ghi 2 dòng: quyền duyệt chung
      // (MUTATION_AUTHORIZED) và dòng nghiệp vụ cụ thể. Trên trang nhật ký,
      // gộp hiển thị về 1 block — dòng cụ thể thắng, dòng trùng bị ẩn.
      const specific = new Set([
        "USER_ROLE_CHANGED",
        "USER_SCOPE_CHANGED",
        "USER_ACTIVATED",
        "USER_DEACTIVATED",
      ]);
      const drop = new Set<string>();
      base.forEach((item, index) => {
        if (item.action !== "MUTATION_AUTHORIZED" || item.resourceType !== "User")
          return;
        for (
          let j = Math.max(0, index - 2);
          j <= Math.min(base.length - 1, index + 2);
          j += 1
        ) {
          if (j === index) continue;
          const other = base[j];
          if (
            specific.has(other.action) &&
            other.resourceId === item.resourceId &&
            other.actorId === item.actorId &&
            Math.abs(Date.parse(other.timestamp) - Date.parse(item.timestamp)) <= 2000
          ) {
            drop.add(item.id);
            break;
          }
        }
      });
      return drop.size ? base.filter((item) => !drop.has(item.id)) : base;
    },
    [store.securityAuditEvents, query, result, action],
  );
  const latestFreshId =
    newSinceMs != null
      ? rows.find((item) => Date.parse(item.timestamp) > newSinceMs)?.id
      : undefined;
  // Sự kiện trên tài khoản hiển thị theo tên đăng nhập (@username) thay vì mã
  // nội bộ USR-… cho dễ đọc (owner request 2026-09); tài khoản đã xóa thì
  // fallback về mã để không mất dấu vết kiểm toán.
  const resourceHandle = (event: (typeof rows)[number]) => {
    if (!event.resourceId) return "—";
    if (event.resourceType === "User") {
      const target = store.users.find((user) => user.id === event.resourceId);
      if (target) return `@${target.username}`;
    }
    return event.resourceId;
  };
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
        description="Nhật ký tập trung cho xác thực, phiên, quyết định quyền, thao tác nghiệp vụ điều hành/ứng phó và quản trị tài khoản."
        icon={ShieldCheck}
        className="admin-page-header"
        actions={
          store.can("user_manage") ? (
            <button onClick={() => navigate("/admin/users")}>
              <ArrowLeft size={15} />
              Người dùng
            </button>
          ) : undefined
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
              {rows.map((event) => {
                const isFresh =
                  newSinceMs != null &&
                  Date.parse(event.timestamp) > newSinceMs;
                return (
                <tr
                  key={event.id}
                  className={isFresh ? "audit-row-new" : undefined}
                >
                  <td>
                    <span className="audit-time">
                      <Clock3 size={12} />
                      {auditTimestampLabel(event.timestamp)}
                      {isFresh && (
                        <span className="audit-new-tag">
                          {event.id === latestFreshId ? "Mới nhất" : "Mới"}
                        </span>
                      )}
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
                    {event.permission && (
                      <small>
                        Quyền: {permissionLabel(event.permission)}
                      </small>
                    )}
                  </td>
                  <td>
                    {auditResourceLabel(event.resourceType)}
                    <small>{resourceHandle(event)}</small>
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
                );
              })}
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
