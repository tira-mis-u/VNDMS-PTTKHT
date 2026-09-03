import { Input } from "@/components/ui";
import { useEffect, useState, type FormEvent } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  LogIn,
  Moon,
  Phone,
  ShieldCheck,
  Sun,
  UserPlus,
  UserRound,
} from "lucide-react";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import type { AuthUser } from "@/domain/auth/types";

type AuthMode = "login" | "register" | "forgot";

/* ─────────────── Login form ─────────────── */
function LoginForm({
  onSuccess,
  onForgot,
}: {
  onSuccess: (user: AuthUser) => void;
  onForgot: () => void;
}) {
  const { login } = useOperationalState();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const result = await login(username, password);
    setBusy(false);
    if (result.ok && result.user) onSuccess(result.user);
    else setError(result.error);
  };

  return (
    <form className="login-form-inner" onSubmit={submit} id="login-form">
      <header className="auth-form-header">
        <span>
          <LockKeyhole size={20} />
        </span>
        <div>
          <h2>Đăng nhập vào tài khoản</h2>
          <p>Nhập thông tin tài khoản VNDMS.</p>
        </div>
      </header>

      {error && (
        <div className="login-error" role="alert">
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      <label className="auth-field-label">
        <span className="label-text">
          Tên đăng nhập <b className="req">*</b>
        </span>
        <span className="input-with-icon">
          <UserRound size={16} />
          <Input
            id="login-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            placeholder="Tên đăng nhập của bạn"
            required
            autoFocus
          />
        </span>
      </label>

      <label className="auth-field-label">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
          <span className="label-text">
            Mật khẩu <b className="req">*</b>
          </span>
          <button
            type="button"
            onClick={onForgot}
            style={{
              background: "none",
              border: 0,
              color: "#2563eb",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              padding: 0,
            }}
          >
            Quên mật khẩu?
          </button>
        </div>
        <span className="input-with-icon" style={{ marginTop: "4px" }}>
          <LockKeyhole size={16} />
          <Input
            id="login-password"
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="Mật khẩu"
            required
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </span>
      </label>

      <button
        id="login-submit-btn"
        className="login-submit"
        type="submit"
        disabled={busy}
      >
        <LogIn size={16} />
        {busy ? "Đang xác thực…" : "Đăng nhập"}
      </button>

      <small className="local-security-note">
        Phiên đăng nhập có hiệu lực 8 giờ. Mọi thao tác được ghi nhật ký bảo mật.
      </small>
    </form>
  );
}

/* ─────────────── Forgot Password Form ─────────────── */
function ForgotPasswordForm({
  onBackToLogin,
}: {
  onBackToLogin: () => void;
}) {
  const { resetPassword } = useOperationalState();
  const [accountIdentifier, setAccountIdentifier] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  const passwordMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const valid = accountIdentifier.trim().length >= 2 && newPassword.length >= 6 && newPassword === confirmPassword;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!valid) return;
    setBusy(true);
    const result = await resetPassword(accountIdentifier, newPassword);
    setBusy(false);
    if (result.ok) {
      setSuccess(true);
    } else {
      setError(result.error);
    }
  };

  if (success) {
    return (
      <div className="login-form-inner" style={{ textAlign: "center", padding: "20px 0" }}>
        <div style={{
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          background: "#ecfdf3",
          color: "#16a34a",
          display: "grid",
          placeItems: "center",
          margin: "0 auto 16px"
        }}>
          <CheckCircle2 size={32} />
        </div>
        <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "8px" }}>Đặt lại mật khẩu thành công!</h2>
        <p style={{ fontSize: "14px", color: "var(--muted)", marginBottom: "24px" }}>
          Mật khẩu mới đã được cập nhật cho tài khoản <b>{accountIdentifier}</b>. Bạn có thể sử dụng ngay để đăng nhập vào VNDMS.
        </p>
        <button
          type="button"
          className="login-submit"
          onClick={onBackToLogin}
          style={{ width: "100%" }}
        >
          <LogIn size={16} /> Quay lại Đăng nhập
        </button>
      </div>
    );
  }

  return (
    <form className="login-form-inner" onSubmit={submit} id="forgot-password-form">
      <header className="auth-form-header">
        <span style={{ background: "#fef3c7", color: "#d97706" }}>
          <KeyRound size={20} />
        </span>
        <div>
          <h2>Quên mật khẩu</h2>
          <p>Nhập thông tin tài khoản để thiết lập mật khẩu mới.</p>
        </div>
      </header>

      {error && (
        <div className="login-error" role="alert">
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      <label className="auth-field-label">
        <span className="label-text">
          Tên đăng nhập hoặc Số điện thoại <b className="req">*</b>
        </span>
        <span className="input-with-icon">
          <UserRound size={16} />
          <Input
            id="forgot-identifier"
            value={accountIdentifier}
            onChange={(e) => setAccountIdentifier(e.target.value)}
            placeholder="Nhập username hoặc số điện thoại"
            required
            autoFocus
          />
        </span>
      </label>

      <label className="auth-field-label">
        <span className="label-text">
          Mật khẩu mới (tối thiểu 6 ký tự) <b className="req">*</b>
        </span>
        <span className="input-with-icon">
          <LockKeyhole size={16} />
          <Input
            id="forgot-new-password"
            type={show ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Nhập mật khẩu mới"
            required
            minLength={6}
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </span>
      </label>

      <label className="auth-field-label">
        <span className="label-text">
          Xác nhận mật khẩu mới <b className="req">*</b>
        </span>
        <span className="input-with-icon">
          <LockKeyhole size={16} />
          <Input
            id="forgot-confirm-password"
            type={show ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Nhập lại mật khẩu mới"
            required
          />
        </span>
        {passwordMismatch && (
          <small style={{ color: "#ef4444", fontSize: "12px", marginTop: "4px" }}>
            Mật khẩu xác nhận không khớp.
          </small>
        )}
      </label>

      <button
        id="forgot-submit-btn"
        className="login-submit"
        type="submit"
        disabled={busy || !valid}
      >
        <KeyRound size={16} />
        {busy ? "Đang xử lý…" : "Cập nhật mật khẩu"}
      </button>

      <div style={{ textAlign: "center", marginTop: "16px" }}>
        <button
          type="button"
          onClick={onBackToLogin}
          style={{
            background: "none",
            border: 0,
            color: "#64748b",
            fontSize: "13.5px",
            fontWeight: 600,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <ArrowLeft size={15} /> Quay lại trang đăng nhập
        </button>
      </div>
    </form>
  );
}

function RegisterForm({ onSuccess }: { onSuccess: (user: AuthUser) => void }) {
  const { register } = useOperationalState();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const passwordMismatch = confirm.length > 0 && password !== confirm;
  const valid =
    displayName.trim().length >= 2 &&
    username.trim().length >= 3 &&
    password.length >= 6 &&
    password === confirm;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setError("");
    setBusy(true);
    const result = await register({
      displayName: displayName.trim(),
      username: username.trim(),
      password,
      role: "citizen",
      geographicScope: {
        level: "national",
        name: "Toàn quốc",
        code: "VN",
      },
      organization: phone.trim() ? `SĐT: ${phone.trim()}` : undefined,
    });
    setBusy(false);
    if (result.ok && result.user) onSuccess(result.user);
    else setError(result.error);
  };

  return (
    <form className="login-form-inner register-form-inner" onSubmit={submit} id="register-form">
      <header className="auth-form-header">
        <span className="register-icon">
          <UserPlus size={20} />
        </span>
        <div>
          <h2>Đăng ký tài khoản công dân</h2>
          <p>Tạo tài khoản để nhận cảnh báo và gửi yêu cầu cứu trợ khẩn cấp.</p>
        </div>
      </header>

      {error && (
        <div className="login-error" role="alert">
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      <label className="auth-field-label">
        <span className="label-text">
          Họ và tên <b className="req">*</b>
        </span>
        <span className="input-with-icon">
          <UserRound size={16} />
          <Input
            id="reg-display-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoComplete="name"
            placeholder="Ví dụ: Nguyễn Văn An"
            required
            autoFocus
          />
        </span>
      </label>

      <label className="auth-field-label">
        <span className="label-text">
          Tên đăng nhập <b className="req">*</b>
        </span>
        <span className="input-with-icon">
          <UserRound size={16} />
          <Input
            id="reg-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            placeholder="Tên đăng nhập (viết liền không dấu)"
            required
          />
        </span>
      </label>

      <label className="auth-field-label">
        <span className="label-text">Số điện thoại liên hệ</span>
        <span className="input-with-icon">
          <Phone size={16} />
          <Input
            id="reg-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            placeholder="VD: 0912 345 678"
          />
        </span>
      </label>

      <label className="auth-field-label">
        <span className="label-text">
          Mật khẩu <b className="req">*</b>
        </span>
        <span className="input-with-icon">
          <LockKeyhole size={16} />
          <Input
            id="reg-password"
            type={showPwd ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="Tối thiểu 6 ký tự"
            required
            minLength={6}
          />
          <button
            type="button"
            onClick={() => setShowPwd(!showPwd)}
            aria-label={showPwd ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          >
            {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </span>
      </label>

      <label className="auth-field-label">
        <span className="label-text">
          Xác nhận mật khẩu <b className="req">*</b>
        </span>
        <span className={`input-with-icon${passwordMismatch ? " input-error" : ""}`}>
          <LockKeyhole size={16} />
          <Input
            id="reg-confirm-password"
            type={showConfirm ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            placeholder="Nhập lại mật khẩu"
            required
          />
          <button
            type="button"
            onClick={() => setShowConfirm(!showConfirm)}
            aria-label={showConfirm ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          >
            {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </span>
        {passwordMismatch && (
          <span className="field-error">Mật khẩu xác nhận không khớp.</span>
        )}
        {!passwordMismatch && password.length >= 6 && confirm === password && (
          <span className="field-ok">
            <CheckCircle2 size={13} /> Mật khẩu khớp.
          </span>
        )}
      </label>

      <button
        id="register-submit-btn"
        className="login-submit"
        type="submit"
        disabled={busy || !valid}
      >
        <UserPlus size={16} />
        {busy ? "Đang đăng ký tài khoản…" : "Đăng ký tài khoản"}
      </button>

      <small className="local-security-note">
        Tài khoản công dân có quyền gửi định vị SOS cứu nạn và tra cứu điểm sơ tán an toàn.
      </small>
    </form>
  );
}

/* ─────────────── Main LoginPage ─────────────── */
export function LoginPage({
  onSuccess,
}: {
  onSuccess: (user: AuthUser) => void;
}) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    localStorage.getItem("vndms-theme") === "dark" ? "dark" : "light",
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("vndms-theme", theme);
  }, [theme]);

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
          <span className="login-brand-logo">
            <img src="/earthIcon.png" alt="VNDMS" width={36} height={36} style={{ objectFit: "contain", borderRadius: "8px" }} />
          </span>
          <div>
            <b>VNDMS</b>
            <small>Hệ thống quản lý, giám sát và phòng chống thiên tai</small>
          </div>
        </div>
        <div className="login-context">
          <span>NỀN TẢNG QUẢN LÝ THIÊN TAI</span>
          <h1>
            {mode === "login"
              ? "Đăng nhập hệ thống"
              : mode === "register"
              ? "Đăng ký tài khoản công dân"
              : "Khôi phục mật khẩu"}
          </h1>
          <p>
            {mode === "login"
              ? "Truy cập các chức năng điều hành, cứu nạn cứu hộ và phòng chống thiên tai theo phân quyền."
              : mode === "register"
              ? "Đăng ký tài khoản để kịp thời theo dõi diễn biến bão lũ, nhận cảnh báo khẩn cấp và gửi tín hiệu cứu nạn SOS khi gặp nguy hiểm."
              : "Thiết lập lại mật khẩu đăng nhập hệ thống VNDMS an toàn và nhanh chóng."}
          </p>
          <ul>
            <li>
              <ShieldCheck size={15} />
              Theo dõi tình hình thiên tai và cảnh báo tức thời
            </li>
            <li>
              <LockKeyhole size={15} />
              Gửi tín hiệu cứu hộ SOS khẩn cấp tới lực lượng tác chiến
            </li>
            <li>
              <UserRound size={15} />
              Tra cứu điểm sơ tán, kho cứu trợ và số hotline khẩn cấp
            </li>
          </ul>
        </div>
        <footer>
          Hệ thống VNDMS — Giám sát & Ứng phó thiên tai Quốc gia.
        </footer>
      </section>

      <section className="login-form-side">
        <div className="login-card-unified">
          {/* Integrated tabs inside the unified card */}
          {mode !== "forgot" ? (
            <div className="login-tabs-bar" role="tablist">
              <button
                id="tab-login"
                role="tab"
                aria-selected={mode === "login"}
                className={`login-tab-btn ${mode === "login" ? "active" : ""}`}
                onClick={() => setMode("login")}
                type="button"
              >
                <LogIn size={15} />
                Đăng nhập
              </button>
              <button
                id="tab-register"
                role="tab"
                aria-selected={mode === "register"}
                className={`login-tab-btn ${mode === "register" ? "active" : ""}`}
                onClick={() => setMode("register")}
                type="button"
              >
                <UserPlus size={15} />
                Đăng ký công dân
              </button>
            </div>
          ) : (
            <div className="login-tabs-bar" style={{ justifyContent: "flex-start", padding: "12px 18px 0" }}>
              <span style={{ fontSize: "14px", fontWeight: 700, color: "#d97706", display: "flex", alignItems: "center", gap: "6px" }}>
                <KeyRound size={16} /> Thiết lập lại mật khẩu
              </span>
            </div>
          )}

          {/* Form content */}
          <div className="login-form-content" style={{ display: mode === "login" ? "block" : "none" }}>
            <LoginForm onSuccess={onSuccess} onForgot={() => setMode("forgot")} />
          </div>
          <div className="login-form-content" style={{ display: mode === "register" ? "block" : "none" }}>
            <RegisterForm onSuccess={onSuccess} />
          </div>
          {mode === "forgot" && (
            <div className="login-form-content" style={{ display: "block" }}>
              <ForgotPasswordForm onBackToLogin={() => setMode("login")} />
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
