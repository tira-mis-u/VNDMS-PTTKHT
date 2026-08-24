import { useState } from "react";
import { ChevronDown, PanelLeftClose, ShieldCheck, X } from "lucide-react";
import {
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
  // Ẩn hoàn toàn các mục tài khoản không có quyền đọc; route guard vẫn chặn
  // truy cập trực tiếp bằng URL (AccessDeniedPage).
  const groups = visibleNavigationGroups((permission) =>
    store.can(permission),
  );
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      navigationGroups.map((group) => [group.label, !group.admin]),
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
          <div className="brand-mark">
            <ShieldCheck size={22} />
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
