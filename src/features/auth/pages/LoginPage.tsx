import { useEffect, useState, type FormEvent } from "react";
import {
  AlertCircle,
  Eye,
  EyeOff,
  LockKeyhole,
  LogIn,
  Moon,
  ShieldCheck,
  Sun,
  UserRound,
} from "lucide-react";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import type { AuthUser } from "@/domain/auth/types";
const hints = [
  ["Trần Quốc Thuận", "Chỉ huy"],
  ["Nguyễn Quốc Trung", "Điều hành viên"],
  ["Phạm Văn Đam", "Cán bộ địa phương"],
  ["Phạm Trung Hiếu", "Đội trưởng đội cứu hộ"],
  ["Lê Nguyễn Minh Trí", "Thành viên cứu hộ"],
  ["Nguyễn Nam Anh", "Nhân viên kho"],
];
export function LoginPage({
  onSuccess,
}: {
  onSuccess: (user: AuthUser) => void;
}) {
  const { login } = useOperationalState();
  const [username, setUsername] = useState("Nguyễn Nam Anh");
  const [password, setPassword] = useState("VNDMS@2026");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    localStorage.getItem("vndms-theme") === "dark" ? "dark" : "light",
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("vndms-theme", theme);
  }, [theme]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    const result = await login(username, password);
    setBusy(false);
    if (result.ok && result.user) onSuccess(result.user);
    else setError(result.error);
  };
  return (
    <main className="login-page">
      <button
        className="login-theme-toggle"
        type="button"
        onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        aria-label={
          theme === "light"
            ? "Chuyển sang chế độ tối"
            : "Chuyển sang chế độ sáng"
        }
        title={
          theme === "light"
            ? "Chuyển sang chế độ tối"
            : "Chuyển sang chế độ sáng"
        }
      >
        {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
      </button>
      <section className="login-identity">
        <div className="login-brand">
          <span>
            <ShieldCheck size={25} />
          </span>
          <div>
            <b>VNDMS</b>
            <small>Hệ thống quản lý, giám sát và phòng chống thiên tai</small>
          </div>
        </div>
        <div className="login-context">
          <span>NỀN TẢNG TÁC NGHIỆP</span>
          <h1>Đăng nhập hệ thống</h1>
          <p>
            Truy cập các chức năng điều hành theo vai trò, phạm vi địa lý và
            phiên làm việc được kiểm soát.
          </p>
          <ul>
            <li>
              <ShieldCheck size={15} />
              Phân quyền tập trung theo vai trò
            </li>
            <li>
              <LockKeyhole size={15} />
              Phiên đăng nhập có thời hạn
            </li>
            <li>
              <UserRound size={15} />
              Mọi thao tác nhạy cảm được ghi audit
            </li>
          </ul>
        </div>
        <footer>
          Dữ liệu tài khoản bên dưới chỉ dành cho môi trường trình diễn cục bộ.
        </footer>
      </section>
      <section className="login-form-side">
        <form className="login-card" onSubmit={submit}>
          <header>
            <span>
              <LockKeyhole size={20} />
            </span>
            <div>
              <h2>Xác thực người dùng</h2>
              <p>Nhập thông tin tài khoản VNDMS.</p>
            </div>
          </header>
          {error && (
            <div className="login-error">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}
          <label>
            Tên đăng nhập
            <div>
              <UserRound size={16} />
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                required
                autoFocus
              />
            </div>
          </label>
          <label>
            Mật khẩu
            <div>
              <LockKeyhole size={16} />
              <input
                type={show ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>
          <button className="login-submit" disabled={busy}>
            <LogIn size={16} />
            {busy ? "Đang xác thực…" : "Đăng nhập"}
          </button>
          <div className="demo-account-hint">
            <b>Tài khoản trình diễn</b>
            <p>
              Mật khẩu dùng chung: <code>VNDMS@2026</code>
            </p>
            <div>
              {hints.map(([account, role]) => (
                <button
                  type="button"
                  key={account}
                  onClick={() => {
                    setUsername(account);
                    setPassword("VNDMS@2026");
                  }}
                >
                  <span>{account}</span>
                  <small>{role}</small>
                </button>
              ))}
            </div>
          </div>
          <small className="local-security-note">
            Adapter xác thực cục bộ; không phải xác thực máy chủ production.
          </small>
        </form>
      </section>
    </main>
  );
}
