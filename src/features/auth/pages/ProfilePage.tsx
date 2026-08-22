import { useRef, useState, type ChangeEvent } from "react";
import {
  Building2,
  Camera,
  CheckCircle2,
  Clock3,
  ImagePlus,
  LifeBuoy,
  MapPinned,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import { Avatar, Button } from "@/components/ui";
import { initials, roleLabels } from "@/domain/auth/labels";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { loadProfileAvatar, saveProfileAvatar } from "../profileAvatar";

const MAX_AVATAR_BYTES = 1024 * 1024;

export function ProfilePage() {
  const { currentUser, session } = useOperationalState();
  const user = currentUser!;
  const fileInput = useRef<HTMLInputElement>(null);
  const [avatar, setAvatar] = useState(() => loadProfileAvatar(user.id));
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const sessionExpiresAt = session
    ? new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(session.expiresAt))
    : "Không có thông tin";

  const chooseAvatar = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const acceptedTypes = ["image/png", "image/jpeg", "image/webp"];
    if (!acceptedTypes.includes(file.type) || file.size > MAX_AVATAR_BYTES) {
      setMessage({
        tone: "error",
        text: "Chọn ảnh PNG, JPG hoặc WebP có dung lượng không quá 1 MB.",
      });
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : null;
      if (!dataUrl) return;
      try {
        saveProfileAvatar(user.id, dataUrl);
        setAvatar(dataUrl);
        setMessage({
          tone: "success",
          text: "Ảnh đại diện đã được lưu trên thiết bị này.",
        });
      } catch {
        setMessage({
          tone: "error",
          text: "Không thể lưu ảnh đại diện. Hãy thử ảnh có dung lượng nhỏ hơn.",
        });
      }
    };
    reader.onerror = () =>
      setMessage({
        tone: "error",
        text: "Không thể đọc tệp ảnh đã chọn. Vui lòng thử lại.",
      });
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const resetAvatar = () => {
    try {
      saveProfileAvatar(user.id, null);
      setAvatar(null);
      setMessage({
        tone: "success",
        text: "Ảnh đại diện đã được xóa khỏi thiết bị này.",
      });
    } catch {
      setMessage({
        tone: "error",
        text: "Không thể xóa ảnh đại diện. Vui lòng thử lại.",
      });
    }
  };

  return (
    <main className="profile-page workspace-content">
      <header className="page-header profile-page-header">
        <div>
          <div className="breadcrumbs">
            <UserRound size={15} />
            Tài khoản <span>/</span> <b>Hồ sơ cá nhân</b>
          </div>
          <h1>Hồ sơ cá nhân</h1>
          <p>Xem thông tin tài khoản và quản lý ảnh đại diện của bạn.</p>
        </div>
      </header>

      <section className="profile-hero" aria-labelledby="profile-name">
        <div className="profile-avatar-wrap">
          <Avatar
            initials={initials(user.displayName)}
            src={avatar ?? undefined}
            alt={`Ảnh đại diện của ${user.displayName}`}
          />
          <span className="profile-avatar-camera" aria-hidden="true">
            <Camera size={18} />
          </span>
        </div>
        <div className="profile-hero-identity">
          <div className="profile-status-line">
            <span className="profile-status-active">
              <CheckCircle2 size={15} />
              Tài khoản đang hoạt động
            </span>
          </div>
          <h2 id="profile-name">{user.displayName}</h2>
          <p>{roleLabels[user.role]}</p>
          <div className="profile-hero-badges">
            <span>
              <MapPinned size={16} />
              {user.geographicScope.name}
            </span>
            {user.teamId && (
              <span>
                <LifeBuoy size={16} />
                {user.teamId}
              </span>
            )}
            {user.warehouseId && (
              <span>
                <Building2 size={16} />
                {user.warehouseId}
              </span>
            )}
          </div>
        </div>
        <input
          ref={fileInput}
          className="profile-file-input"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={chooseAvatar}
        />
        <div className="profile-avatar-controls">
          <Button type="button" onClick={() => fileInput.current?.click()}>
            <ImagePlus size={18} />
            Đổi ảnh đại diện
          </Button>
          {avatar && (
            <Button type="button" variant="secondary" onClick={resetAvatar}>
              <Trash2 size={17} />
              Xóa ảnh đại diện
            </Button>
          )}
          <small>PNG, JPG hoặc WebP · tối đa 1 MB · lưu theo tài khoản.</small>
        </div>
      </section>

      {message && (
        <p
          className={`profile-message ${message.tone}`}
          role="status"
          aria-live="polite"
        >
          {message.tone === "success" ? (
            <CheckCircle2 size={17} />
          ) : (
            <ShieldCheck size={17} />
          )}
          {message.text}
        </p>
      )}

      <section
        className="profile-information"
        aria-labelledby="account-info-title"
      >
        <header>
          <div>
            <span>Thông tin được cấp từ phiên đăng nhập</span>
            <h2 id="account-info-title">Thông tin tài khoản</h2>
            <p>
              Các thuộc tính phân quyền chỉ được xem tại đây và không thể chỉnh
              sửa từ hồ sơ cá nhân.
            </p>
          </div>
          <ShieldCheck size={24} />
        </header>
        <dl className="profile-information-grid">
          <div>
            <dt>Họ và tên</dt>
            <dd>{user.displayName}</dd>
          </div>
          <div>
            <dt>Vai trò</dt>
            <dd>{roleLabels[user.role]}</dd>
          </div>
          <div>
            <dt>Phạm vi địa lý</dt>
            <dd>
              <MapPinned size={17} />
              {user.geographicScope.name}
            </dd>
          </div>
          <div>
            <dt>Trạng thái tài khoản</dt>
            <dd className="profile-active-value">
              <CheckCircle2 size={17} />
              Đang hoạt động
            </dd>
          </div>
          {user.teamId && (
            <div>
              <dt>Đội phụ trách</dt>
              <dd>
                <LifeBuoy size={17} />
                {user.teamId}
              </dd>
            </div>
          )}
          {user.warehouseId && (
            <div>
              <dt>Kho phụ trách</dt>
              <dd>
                <Building2 size={17} />
                {user.warehouseId}
              </dd>
            </div>
          )}
          <div>
            <dt>Phiên đăng nhập hết hạn</dt>
            <dd>
              <Clock3 size={17} />
              {sessionExpiresAt}
            </dd>
          </div>
        </dl>
        <footer className="profile-security-note">
          <ShieldCheck size={19} />
          <p>
            Vai trò, quyền, phạm vi và ownership chỉ được thay đổi trong chức
            năng quản trị truy cập bởi tài khoản có thẩm quyền.
          </p>
        </footer>
      </section>
    </main>
  );
}
