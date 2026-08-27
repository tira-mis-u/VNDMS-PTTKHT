import { PageSectionHeader, Input } from "@/components/ui";
import { Select as UiSelect } from "@/components/ui/Select";
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
import { permissionLabel } from "@/lib/permissions/labels";
import {
  auditActionLabel,
  auditTimestampLabel,
  initials,
  roleLabels,
  roleOptions,
} from "@/domain/auth/labels";
import type { AuthUser, GeographicScopeLevel, Role } from "@/domain/auth/types";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { AccessDeniedPage } from "./AccessDeniedPage";

const ROLE_COLORS: Record<Role, { bg: string; color: string; border: string }> = {
  commander: { bg: "#fef3f2", color: "#b42318", border: "#fecdca" },
  operator: { bg: "#eff8ff", color: "#175cd3", border: "#b2ddff" },
  local_officer: { bg: "#fdf2fa", color: "#c11574", border: "#fbcfe8" },
  rescue_leader: { bg: "#fffaeb", color: "#b54708", border: "#fedf89" },
  rescue_member: { bg: "#fff6ed", color: "#c4320a", border: "#fdba74" },
  warehouse_staff: { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
  relief_worker: { bg: "#f5f3ff", color: "#7c3aed", border: "#ddd6fe" },
  citizen: { bg: "#f8fafc", color: "#475467", border: "#e2e8f0" },
};

export function UserManagementPage({
  navigate,
  mode = "users",
}: {
  navigate: (path: string) => void;
  mode?: "users" | "permissions";
}) {
  const store = useOperationalState();
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const isCommander =
    store.currentUser?.role === "commander" || store.can("user_manage");

  const rows = useMemo(
    () =>
      store.users.filter(
        (user) =>
          (!query ||
            `${user.displayName} ${user.username} ${user.id} ${user.geographicScope.name}`
              .toLowerCase()
              .includes(query.toLowerCase())) &&
          (roleFilter === "all" || user.role === roleFilter) &&
          (statusFilter === "all" || String(user.active) === statusFilter),
      ),
    [store.users, query, roleFilter, statusFilter],
  );

  const selected = store.users.find((user) => user.id === selectedId) ?? null;

  const handleRoleChange = (userId: string, newRole: Role) => {
    const targetUser = store.users.find((u) => u.id === userId);
    store.updateUserRole(userId, newRole);
    setFeedback(
      `Đã phân quyền tài khoản "${targetUser?.displayName || userId}" thành "${roleLabels[newRole]}".`,
    );
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleStatusToggle = (userId: string, currentActive: boolean) => {
    const targetUser = store.users.find((u) => u.id === userId);
    store.updateUserActive(userId, !currentActive);
    setFeedback(
      `Đã ${!currentActive ? "kích hoạt" : "vô hiệu hóa"} tài khoản "${targetUser?.displayName || userId}".`,
    );
    setTimeout(() => setFeedback(null), 4000);
  };

  if (!store.can("user_manage"))
    return (
      <AccessDeniedPage
        navigate={navigate}
        reason="Tài khoản hiện tại chưa được cấp quyền quản lý người dùng."
      />
    );

  const citizenCount = store.users.filter((u) => u.role === "citizen").length;
  const responderCount = store.users.filter((u) =>
    ["rescue_leader", "rescue_member", "local_officer", "operator", "commander"].includes(u.role),
  ).length;

  return (
    <main className="admin-page">
      <PageSectionHeader
        section="Quản trị truy cập & Phân quyền"
        title={mode === "permissions" ? "Phân quyền người dùng" : "Quản lý người dùng"}
        description="Hiển thị toàn bộ người dùng đã và đang sử dụng hệ thống. Chỉ huy có toàn quyền phân quyền tác nghiệp và kích hoạt tài khoản trực tiếp."
        icon={UserCog}
        className="admin-page-header"
        actions={
          <button onClick={() => navigate("/admin/audit")} className="btn-audit-nav">
            <ShieldCheck size={15} />
            Nhật ký bảo mật ({store.securityAuditEvents.length})
          </button>
        }
      />

      {feedback && (
        <div className="admin-feedback-toast" role="status">
          <CheckCircle2 size={16} />
          <span>{feedback}</span>
          <button onClick={() => setFeedback(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      <div className="admin-summary">
        <div>
          <b>{store.users.length}</b>
          <span>Tổng số người dùng</span>
        </div>
        <div>
          <b>{store.users.filter((item) => item.active).length}</b>
          <span>Đang hoạt động</span>
        </div>
        <div>
          <b>{responderCount}</b>
          <span>Lực lượng tác chiến</span>
        </div>
        <div>
          <b>{citizenCount}</b>
          <span>Tài khoản công dân</span>
        </div>
      </div>

      <section className="admin-content">
        <div className="admin-filters">
          <label className="input-with-icon admin-search">
            <Search size={15} />
            <Input
              aria-label="Tìm kiếm tài khoản"
              placeholder="Tìm theo tên, username, mã hoặc địa bàn…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label className="admin-filter-item">
            <Filter size={14} />
            <UiSelect
              aria-label="Lọc theo vai trò"
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
            >
              <option value="all">Tất cả vai trò ({store.users.length})</option>
              {roleOptions.map((item) => {
                const count = store.users.filter((u) => u.role === item.value).length;
                return (
                  <option key={item.value} value={item.value}>
                    {item.label} ({count})
                  </option>
                );
              })}
            </UiSelect>
          </label>
          <label className="admin-filter-item">
            <UiSelect
              aria-label="Lọc theo trạng thái tài khoản"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">Mọi trạng thái</option>
              <option value="true">Đang hoạt động</option>
              <option value="false">Đã vô hiệu hóa</option>
            </UiSelect>
          </label>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Người dùng</th>
                <th>Tên đăng nhập</th>
                <th>Phân quyền vai trò (Chỉ huy trực tiếp gán)</th>
                <th>Phạm vi địa lý</th>
                <th>Trạng thái</th>
                <th>Cập nhật</th>
                <th>Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((user) => {
                const badgeStyle = ROLE_COLORS[user.role] || ROLE_COLORS.citizen;
                const isSelf = user.id === store.currentUser?.id;
                return (
                  <tr key={user.id} className={!user.active ? "row-inactive" : ""}>
                    <td>
                      <button
                        className="user-identity"
                        onClick={() => setSelectedId(user.id)}
                        title="Xem hồ sơ và nhật ký thao tác"
                      >
                        <span
                          style={{
                            background: badgeStyle.bg,
                            color: badgeStyle.color,
                            border: `1px solid ${badgeStyle.border}`,
                          }}
                        >
                          {initials(user.displayName)}
                        </span>
                        <div>
                          <b>
                            {user.displayName} {isSelf && <small className="self-tag">(Bạn)</small>}
                          </b>
                          <small>{user.id}</small>
                        </div>
                      </button>
                    </td>
                    <td>
                      <code className="username-tag">@{user.username}</code>
                    </td>
                    <td>
                      {isCommander ? (
                        <div className="direct-role-picker">
                          <UiSelect
                            className="role-inline-select"
                            value={user.role}
                            style={{
                              backgroundColor: badgeStyle.bg,
                              color: badgeStyle.color,
                              borderColor: badgeStyle.border,
                            }}
                            onChange={(e) => handleRoleChange(user.id, e.target.value as Role)}
                            accessibleLabel="Chọn để đổi vai trò trực tiếp"
                          >
                            {roleOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </UiSelect>
                        </div>
                      ) : (
                        <span
                          className="role-badge"
                          style={{
                            backgroundColor: badgeStyle.bg,
                            color: badgeStyle.color,
                            borderColor: badgeStyle.border,
                          }}
                        >
                          {roleLabels[user.role]}
                        </span>
                      )}
                    </td>
                    <td>
                      <button
                        className="scope-cell-btn"
                        onClick={() => setSelectedId(user.id)}
                        title="Bấm để chỉnh sửa phạm vi địa lý"
                      >
                        <MapPin size={13} />
                        <span>{user.geographicScope.name || "Toàn quốc"}</span>
                      </button>
                    </td>
                    <td>
                      <button
                        className={`account-state-toggle ${user.active ? "active" : "inactive"}`}
                        onClick={() => !isSelf && handleStatusToggle(user.id, user.active)}
                        disabled={isSelf}
                        title={
                          isSelf
                            ? "Không thể vô hiệu hóa tài khoản đang đăng nhập"
                            : user.active
                              ? "Bấm để vô hiệu hóa tài khoản"
                              : "Bấm để kích hoạt tài khoản"
                        }
                      >
                        {user.active ? (
                          <>
                            <CheckCircle2 size={13} /> Hoạt động
                          </>
                        ) : (
                          <>
                            <UserX size={13} /> Vô hiệu hóa
                          </>
                        )}
                      </button>
                    </td>
                    <td>
                      <small className="updated-date">
                        {user.updatedAt.includes("T")
                          ? user.updatedAt.split("T")[0]
                          : user.updatedAt}
                      </small>
                    </td>
                    <td>
                      <button
                        className="row-open"
                        aria-label={`Mở chi tiết tài khoản ${user.displayName}`}
                        onClick={() => setSelectedId(user.id)}
                      >
                        <ChevronRight size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!rows.length && (
                <tr>
                  <td colSpan={7} className="admin-empty">
                    Không tìm thấy tài khoản nào khớp với bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selected && (
        <UserDrawer
          user={selected}
          close={() => setSelectedId(null)}
          store={store}
          onRoleChange={handleRoleChange}
          onStatusToggle={handleStatusToggle}
        />
      )}
    </main>
  );
}

function UserDrawer({
  user,
  close,
  store,
  onRoleChange,
  onStatusToggle,
}: {
  user: AuthUser;
  close: () => void;
  store: ReturnType<typeof useOperationalState>;
  onRoleChange: (userId: string, role: Role) => void;
  onStatusToggle: (userId: string, currentActive: boolean) => void;
}) {
  const [scopeName, setScopeName] = useState(user.geographicScope.name);
  const [scopeCode, setScopeCode] = useState(user.geographicScope.code);
  const [scopeLevel, setScopeLevel] = useState<GeographicScopeLevel>(
    user.geographicScope.level,
  );
  const [savedScope, setSavedScope] = useState(false);

  const audits = store.securityAuditEvents
    .filter((item) => item.actorId === user.id || item.resourceId === user.id)
    .slice(0, 8);

  const isSelf = user.id === store.currentUser?.id;

  const handleSaveScope = () => {
    store.updateUserScope(user.id, {
      level: scopeLevel,
      name: scopeName,
      code: scopeCode,
    });
    setSavedScope(true);
    setTimeout(() => setSavedScope(false), 3000);
  };

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
            <small>Hồ sơ & Phân quyền tài khoản</small>
            <h2>{user.displayName}</h2>
            <span>
              @{user.username} · ID: {user.id}
            </span>
          </div>
          <button onClick={close} aria-label="Đóng chi tiết tài khoản">
            <X size={18} />
          </button>
        </header>

        <section>
          <h3>Phân quyền vai trò trực tiếp</h3>
          <label>
            Vai trò tác nghiệp
            <UiSelect
              value={user.role}
              onChange={(event) =>
                onRoleChange(user.id, event.target.value as Role)
              }
            >
              {roleOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </UiSelect>
          </label>
          <button
            className={user.active ? "deactivate" : "activate"}
            onClick={() => onStatusToggle(user.id, user.active)}
            disabled={isSelf}
          >
            {user.active ? <UserX size={14} /> : <CheckCircle2 size={14} />}{" "}
            {user.active ? "Vô hiệu hóa tài khoản" : "Kích hoạt tài khoản"}
          </button>
        </section>

        <section>
          <h3>Phạm vi địa lý tác nghiệp</h3>
          <label>
            Cấp phạm vi
            <UiSelect
              value={scopeLevel}
              onChange={(event) =>
                setScopeLevel(event.target.value as GeographicScopeLevel)
              }
            >
              <option value="national">Toàn quốc</option>
              <option value="province">Tỉnh / Thành phố</option>
              <option value="district">Quận / Huyện</option>
              <option value="commune">Xã / Phường</option>
              <option value="warehouse">Kho được giao</option>
            </UiSelect>
          </label>
          <label>
            Tên địa bàn / Đơn vị
            <Input
              value={scopeName}
              onChange={(event) => setScopeName(event.target.value)}
              placeholder="VD: Tây Hồ, Hà Nội"
            />
          </label>
          <label>
            Mã định danh địa bàn
            <Input
              value={scopeCode}
              onChange={(event) => setScopeCode(event.target.value)}
              placeholder="VD: HN-TAYHO"
            />
          </label>
          <button className="save-scope" onClick={handleSaveScope}>
            {savedScope ? <CheckCircle2 size={14} /> : <MapPin size={14} />}
            {savedScope ? "Đã lưu thành công!" : "Lưu phạm vi địa lý"}
          </button>
        </section>

        <section>
          <h3>Quyền hạn có hiệu lực ({permissionMatrix[user.role]?.length || 0})</h3>
          <div className="permission-list">
            {(permissionMatrix[user.role] || []).map((permission) => (
              <span key={permission}>{permissionLabel(permission)}</span>
            ))}
          </div>
        </section>

        <section>
          <h3>Nhật ký bảo mật gần đây ({audits.length})</h3>
          <div className="user-audit-list">
            {audits.map((event) => (
              <div key={event.id}>
                <b>{auditActionLabel(event.action)}</b>
                <span>{auditTimestampLabel(event.timestamp)}</span>
                <p>{event.reason}</p>
              </div>
            ))}
            {!audits.length && <p className="text-muted">Chưa có nhật ký hoạt động.</p>}
          </div>
        </section>
      </aside>
    </>
  );
}
