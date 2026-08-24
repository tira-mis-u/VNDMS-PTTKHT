import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Building2,
  LifeBuoy,
  LogOut,
  MapPinned,
  Menu,
  Moon,
  ShieldCheck,
  Sun,
  UserRound,
} from "lucide-react";
import { Avatar, Button } from "@/components/ui";
import { initials, roleLabels } from "@/domain/auth/labels";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import {
  AlertNotificationBell,
  AlertNotificationPopover,
} from "@/features/alerts";
import {
  loadProfileAvatar,
  PROFILE_AVATAR_CHANGED,
} from "@/features/auth/profileAvatar";
export function AppHeader({
  openMobile,
  navigate,
}: {
  openMobile: () => void;
  navigate: (path: string) => void;
}) {
  const store = useOperationalState();
  const user = store.currentUser!;
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountWrapRef = useRef<HTMLDivElement>(null);
  const notificationWrapRef = useRef<HTMLDivElement>(null);
  const profileActionRef = useRef<HTMLButtonElement>(null);
  const [avatar, setAvatar] = useState(() => loadProfileAvatar(user.id));
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    localStorage.getItem("vndms-theme") === "dark" ? "dark" : "light",
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("vndms-theme", theme);
  }, [theme]);
  useEffect(() => {
    const refreshAvatar = (event: Event) => {
      const changedUserId = (event as CustomEvent<{ userId: string }>).detail
        ?.userId;
      if (!changedUserId || changedUserId === user.id)
        setAvatar(loadProfileAvatar(user.id));
    };
    window.addEventListener(PROFILE_AVATAR_CHANGED, refreshAvatar);
    return () =>
      window.removeEventListener(PROFILE_AVATAR_CHANGED, refreshAvatar);
  }, [user.id]);
  useEffect(() => {
    if (!accountOpen && !notificationsOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target as Node;
      if (accountOpen && !accountWrapRef.current?.contains(target))
        setAccountOpen(false);
      if (notificationsOpen && !notificationWrapRef.current?.contains(target))
        setNotificationsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setAccountOpen(false);
      setNotificationsOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [accountOpen, notificationsOpen]);
  useEffect(() => {
    if (accountOpen)
      requestAnimationFrame(() => profileActionRef.current?.focus());
  }, [accountOpen]);
  const logout = () => {
    setAccountOpen(false);
    store.logout();
    window.history.replaceState({}, "", "/login");
  };
  return (
    <header className="topbar">
      <div className="brand">
        <button
          className="mobile-menu"
          onClick={openMobile}
          aria-label="Mở điều hướng"
        >
          <Menu size={24} />
        </button>
        <div className="brand-mark">
          <ShieldCheck size={26} />
        </div>
        <div className="brand-copy">
          <strong>VNDMS</strong>
          <span>Hệ thống quản lý, giám sát và phòng chống thiên tai</span>
        </div>
      </div>
      <div className="topbar-actions">
        <Button
          variant="ghost"
          size="icon"
          title={
            theme === "light"
              ? "Chuyển sang chế độ tối"
              : "Chuyển sang chế độ sáng"
          }
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        >
          {theme === "light" ? <Moon size={25} /> : <Sun size={25} />}
        </Button>
        <div className="popover-wrap" ref={notificationWrapRef}>
          <AlertNotificationBell
            open={notificationsOpen}
            onToggle={() => {
              setNotificationsOpen(!notificationsOpen);
              setAccountOpen(false);
            }}
          />
          {notificationsOpen && (
            <AlertNotificationPopover
              navigate={navigate}
              onClose={() => setNotificationsOpen(false)}
            />
          )}
        </div>
        <div className="topbar-divider" />
        <div className="popover-wrap account-wrap" ref={accountWrapRef}>
          <button
            className="account"
            aria-haspopup="menu"
            aria-expanded={accountOpen}
            aria-controls="account-session-menu"
            onClick={() => {
              setAccountOpen(!accountOpen);
              setNotificationsOpen(false);
            }}
          >
            <Avatar
              initials={initials(user.displayName)}
              src={avatar ?? undefined}
              alt={`Ảnh đại diện của ${user.displayName}`}
            />
            <span>
              <strong>{user.displayName}</strong>
              <small>{roleLabels[user.role]}</small>
            </span>
            <ChevronDown
              size={17}
              className={accountOpen ? "rotate-account" : ""}
            />
          </button>
          {accountOpen && (
            <div
              className="account-popover"
              id="account-session-menu"
              role="menu"
              aria-label="Tài khoản và phiên làm việc"
            >
              <div className="account-popover-head">
                <Avatar
                  initials={initials(user.displayName)}
                  src={avatar ?? undefined}
                  alt=""
                />
                <span>
                  <b>{user.displayName}</b>
                  <small>{roleLabels[user.role]}</small>
                </span>
              </div>
              <div className="account-session-context">
                <div>
                  <span className="account-context-icon">
                    <MapPinned size={19} />
                  </span>
                  <span>
                    <small>Phạm vi được phân quyền</small>
                    <b>{user.geographicScope.name}</b>
                  </span>
                </div>
                {user.teamId && (
                  <div>
                    <span className="account-context-icon">
                      <LifeBuoy size={19} />
                    </span>
                    <span>
                      <small>Đội phụ trách</small>
                      <b>{user.teamId}</b>
                    </span>
                  </div>
                )}
                {user.warehouseId && (
                  <div>
                    <span className="account-context-icon">
                      <Building2 size={19} />
                    </span>
                    <span>
                      <small>Kho phụ trách</small>
                      <b>{user.warehouseId}</b>
                    </span>
                  </div>
                )}
              </div>
              <div className="account-popover-actions">
                <button
                  ref={profileActionRef}
                  role="menuitem"
                  onClick={() => {
                    setAccountOpen(false);
                    navigate("/profile");
                  }}
                >
                  <UserRound size={19} />
                  Hồ sơ cá nhân
                </button>
                <button className="logout" role="menuitem" onClick={logout}>
                  <LogOut size={19} />
                  Đăng xuất
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
