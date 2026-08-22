import { useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Filter,
  MapPin,
  Search,
  ShieldCheck,
  UserCog,
  UserX,
  X,
} from "lucide-react";
import { permissionMatrix } from "@/lib/permissions/permissions";
import { initials, roleLabels, roleOptions } from "@/domain/auth/labels";
import type { AuthUser, GeographicScopeLevel, Role } from "@/domain/auth/types";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { AccessDeniedPage } from "./AccessDeniedPage";
export function UserManagementPage({
  navigate,
}: {
  navigate: (path: string) => void;
}) {
  const store = useOperationalState();
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const rows = useMemo(
    () =>
      store.users.filter(
        (user) =>
          (!query ||
            `${user.displayName} ${user.id}`
              .toLowerCase()
              .includes(query.toLowerCase())) &&
          (role === "all" || user.role === role) &&
          (status === "all" || String(user.active) === status),
      ),
    [store.users, query, role, status],
  );
  const selected = store.users.find((user) => user.id === selectedId) ?? null;
  if (!store.can("user_manage"))
    return (
      <AccessDeniedPage
        navigate={navigate}
        reason="Chức năng quản lý người dùng yêu cầu quyền quản trị user_manage."
      />
    );
  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <div>
          <span>
            <UserCog size={14} />
            Quản trị truy cập
          </span>
          <h1>Người dùng</h1>
          <p>
            Quản lý vai trò, trạng thái và phạm vi địa lý của tài khoản trình
            diễn.
          </p>
        </div>
        <button onClick={() => navigate("/admin/audit")}>
          <ShieldCheck size={15} />
          Nhật ký bảo mật
        </button>
      </header>
      <div className="admin-summary">
        <div>
          <b>{store.users.length}</b>
          <span>Tổng tài khoản</span>
        </div>
        <div>
          <b>{store.users.filter((item) => item.active).length}</b>
          <span>Đang hoạt động</span>
        </div>
        <div>
          <b>{new Set(store.users.map((item) => item.role)).size}</b>
          <span>Vai trò</span>
        </div>
        <div>
          <b>
            {
              store.users.filter(
                (item) => item.geographicScope.level !== "national",
              ).length
            }
          </b>
          <span>Giới hạn địa bàn</span>
        </div>
      </div>
      <section className="admin-content">
        <div className="admin-filters">
          <label>
            <Search size={15} />
            <input
              aria-label="Tìm kiếm tài khoản"
              placeholder="Tìm họ tên hoặc mã tài khoản"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label>
            <Filter size={14} />
            <select
              aria-label="Lọc theo vai trò"
              value={role}
              onChange={(event) => setRole(event.target.value)}
            >
              <option value="all">Tất cả vai trò</option>
              {roleOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <select
            aria-label="Lọc theo trạng thái tài khoản"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="all">Mọi trạng thái</option>
            <option value="true">Đang hoạt động</option>
            <option value="false">Đã vô hiệu hóa</option>
          </select>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Người dùng</th>
                <th>Vai trò</th>
                <th>Phạm vi địa lý</th>
                <th>Trạng thái</th>
                <th>Cập nhật</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((user) => (
                <tr key={user.id}>
                  <td>
                    <button
                      className="user-identity"
                      onClick={() => setSelectedId(user.id)}
                    >
                      <span>{initials(user.displayName)}</span>
                      <div>
                        <b>{user.displayName}</b>
                        <small>{user.id}</small>
                      </div>
                    </button>
                  </td>
                  <td>{roleLabels[user.role]}</td>
                  <td>
                    <span className="scope-cell">
                      <MapPin size={13} />
                      {user.geographicScope.name}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`account-state ${user.active ? "active" : "inactive"}`}
                    >
                      {user.active ? (
                        <CheckCircle2 size={12} />
                      ) : (
                        <UserX size={12} />
                      )}{" "}
                      {user.active ? "Hoạt động" : "Vô hiệu hóa"}
                    </span>
                  </td>
                  <td>{user.updatedAt}</td>
                  <td>
                    <button
                      className="row-open"
                      aria-label={`Mở chi tiết tài khoản ${user.displayName}`}
                      onClick={() => setSelectedId(user.id)}
                    >
                      <ChevronRight size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {selected && (
        <UserDrawer
          user={selected}
          close={() => setSelectedId(null)}
          store={store}
        />
      )}
    </main>
  );
}
function UserDrawer({
  user,
  close,
  store,
}: {
  user: AuthUser;
  close: () => void;
  store: ReturnType<typeof useOperationalState>;
}) {
  const [scopeName, setScopeName] = useState(user.geographicScope.name);
  const [scopeCode, setScopeCode] = useState(user.geographicScope.code);
  const [scopeLevel, setScopeLevel] = useState<GeographicScopeLevel>(
    user.geographicScope.level,
  );
  const audits = store.securityAuditEvents
    .filter((item) => item.actorId === user.id || item.resourceId === user.id)
    .slice(0, 5);
  return (
    <>
      <button
        className="admin-drawer-backdrop"
        onClick={close}
        aria-label="Đóng"
      />
      <aside
        className="admin-user-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`Chi tiết tài khoản ${user.displayName}`}
      >
        <header>
          <div className="drawer-avatar">{initials(user.displayName)}</div>
          <div>
            <small>Chi tiết tài khoản quản trị</small>
            <h2>{user.displayName}</h2>
            <span>{user.id}</span>
          </div>
          <button onClick={close} aria-label="Đóng chi tiết tài khoản">
            <X size={18} />
          </button>
        </header>
        <section>
          <h3>Quyền và trạng thái</h3>
          <label>
            Vai trò
            <select
              value={user.role}
              onChange={(event) =>
                store.updateUserRole(user.id, event.target.value as Role)
              }
            >
              {roleOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <button
            className={user.active ? "deactivate" : "activate"}
            onClick={() => store.updateUserActive(user.id, !user.active)}
          >
            {user.active ? <UserX size={14} /> : <CheckCircle2 size={14} />}{" "}
            {user.active ? "Vô hiệu hóa tài khoản" : "Kích hoạt tài khoản"}
          </button>
        </section>
        <section>
          <h3>Phạm vi địa lý</h3>
          <label>
            Cấp phạm vi
            <select
              value={scopeLevel}
              onChange={(event) =>
                setScopeLevel(event.target.value as GeographicScopeLevel)
              }
            >
              <option value="national">Toàn quốc</option>
              <option value="province">Tỉnh/thành</option>
              <option value="district">Quận/huyện</option>
              <option value="commune">Xã/phường</option>
              <option value="warehouse">Kho được giao</option>
            </select>
          </label>
          <label>
            Tên phạm vi
            <input
              value={scopeName}
              onChange={(event) => setScopeName(event.target.value)}
            />
          </label>
          <label>
            Mã phạm vi
            <input
              value={scopeCode}
              onChange={(event) => setScopeCode(event.target.value)}
            />
          </label>
          <button
            className="save-scope"
            onClick={() =>
              store.updateUserScope(user.id, {
                level: scopeLevel,
                name: scopeName,
                code: scopeCode,
              })
            }
          >
            Lưu phạm vi
          </button>
        </section>
        <section>
          <h3>Quyền hiệu lực ({permissionMatrix[user.role].length})</h3>
          <div className="permission-list">
            {permissionMatrix[user.role].map((permission) => (
              <span key={permission}>{permission}</span>
            ))}
          </div>
        </section>
        <section>
          <h3>Audit gần đây</h3>
          <div className="user-audit-list">
            {audits.map((event) => (
              <div key={event.id}>
                <b>{event.action}</b>
                <span>{event.timestamp}</span>
                <p>{event.reason}</p>
              </div>
            ))}
            {!audits.length && <p>Chưa có hoạt động bảo mật.</p>}
          </div>
        </section>
      </aside>
    </>
  );
}
