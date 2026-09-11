import { useState } from "react";
import { ChevronDown, PanelLeftClose, X } from "lucide-react";
import {
  citizenNavigationGroups,
  navigationGroups,
  visibleNavigationGroups,
} from "@/components/navigation/navigationConfig";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
export function AppSidebar({
  active,
  onSelect,
  mobileOpen,
  closeMobile,
}: {
  active: string;
  onSelect: (label: string, path?: string) => void;
  mobileOpen: boolean;
  closeMobile: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const store = useOperationalState();
  const unreadAlerts = store.alerts.filter(
    (alert) => alert.status === "Chưa đọc",
  ).length;
  // Sự kiện bảo mật MỚI kể từ lần mở trang nhật ký gần nhất (mỗi tài khoản
  // nhớ mốc riêng). Lần đầu chưa có mốc thì coi như đã đọc tới hiện tại để
  // huy hiệu chỉ đếm sự kiện mới phát sinh, không đếm dữ liệu cũ.
  const auditSeenAt = (() => {
    const userId = store.currentUser?.id;
    if (!userId) return 0;
    try {
      const raw = localStorage.getItem(`vndms_audit_seen_${userId}`);
      if (!raw) {
        const now = new Date().toISOString();
        localStorage.setItem(`vndms_audit_seen_${userId}`, now);
        return Date.parse(now);
      }
      const ms = Date.parse(raw);
      return Number.isNaN(ms) ? 0 : ms;
    } catch {
      return 0;
    }
  })();
  const unreadAudits = store.securityAuditEvents.filter((event) => {
    const ms = Date.parse(event.timestamp);
    return !Number.isNaN(ms) && ms > auditSeenAt;
  }).length;
  const groups = visibleNavigationGroups(
    (permission) => store.can(permission),
    store.role,
  );
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      [...navigationGroups, ...citizenNavigationGroups].map((group) => [group.label, !group.admin]),
    ),
  );
  const go = (label: string, path?: string) => {
    onSelect(label, path);
    closeMobile();
  };
  return (
    <>
      {mobileOpen && (
        <button
          className="sidebar-backdrop"
          onClick={closeMobile}
          aria-label="Đóng điều hướng"
        />
      )}
      <aside
        className={`sidebar ${collapsed ? "sidebar-collapsed" : ""} ${mobileOpen ? "sidebar-mobile-open" : ""}`}
      >
        <div className="mobile-sidebar-top">
          <div className="brand-mark" style={{ overflow: "hidden", background: "transparent" }}>
            <img
              src="/earthIcon.png"
              alt="VNDMS"
              style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "8px" }}
            />
          </div>
          <strong>VNDMS</strong>
          <button onClick={closeMobile} aria-label="Đóng thanh điều hướng">
            <X size={22} />
          </button>
        </div>
        <div className="sidebar-tools">
          <button
            className="collapse-btn"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}
          >
            <PanelLeftClose size={18} />
            <span>Thu gọn thanh bên</span>
          </button>
        </div>
        <nav className="sidebar-scroll" aria-label="Điều hướng chính">
          {groups.map((group) => {
            const opened = openGroups[group.label];
            return (
              <div className="nav-group" key={group.label}>
                <button
                  className="nav-group-title"
                  onClick={() =>
                    setOpenGroups((current) => ({
                      ...current,
                      [group.label]: !opened,
                    }))
                  }
                >
                  <span>{group.label}</span>
                  <ChevronDown size={15} className={opened ? "" : "rotate"} />
                </button>
                {opened && (
                  <div className="nav-items">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.label}
                          title={collapsed ? item.label : undefined}
                          className={`nav-item ${active === item.label ? "active" : ""}`}
                          onClick={() => go(item.label, item.path)}
                        >
                          <Icon size={19} />
                          <span className="nav-label">{item.label}</span>
                          {item.label === "Cảnh báo"
                            ? unreadAlerts > 0 && (
                                <span className="nav-count">
                                  {unreadAlerts}
                                </span>
                              )
                            : item.label === "Nhật ký bảo mật"
                              ? unreadAudits > 0 && (
                                  <span className="nav-count">
                                    {unreadAudits}
                                  </span>
                                )
                              : item.badge && (
                                  <span className="nav-count">{item.badge}</span>
                                )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
