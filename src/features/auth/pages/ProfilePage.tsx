import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  Building2,
  Camera,
  CheckCircle2,
  Clock3,
  Edit3,
  ImagePlus,
  LifeBuoy,
  MapPinned,
  Phone,
  Save,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { Avatar, Button, PageSectionHeader, Input } from "@/components/ui";
import { initials, roleLabels } from "@/domain/auth/labels";
import { resolvePersonnel } from "@/data/identity/personnel";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { loadProfileAvatar, saveProfileAvatar } from "../profileAvatar";

const MAX_AVATAR_BYTES = 1024 * 1024;

export function ProfilePage() {
  const store = useOperationalState();
  const user = store.currentUser!;
  const identity = resolvePersonnel(user.id);
  const fileInput = useRef<HTMLInputElement>(null);
  const [avatar, setAvatar] = useState(() => loadProfileAvatar(user.id));
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user.displayName);
  const [phone, setPhone] = useState(
    user.organization?.startsWith("SĐT: ")
      ? user.organization.replace("SĐT: ", "")
      : identity?.contact || "",
  );
  const [scopeName, setScopeName] = useState(user.geographicScope.name);
  const [scopeCode, setScopeCode] = useState(user.geographicScope.code);

  const sessionExpiresAt = store.session
    ? new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(store.session.expiresAt))
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

  const handleSaveProfile = (e: FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setMessage({ tone: "error", text: "Họ và tên không được để trống." });
      return;
    }
    try {
      store.updateSelfProfile({
        displayName: displayName.trim(),
        organization: phone.trim() ? `SĐT: ${phone.trim()}` : undefined,
        geographicScope: {
          level: user.geographicScope.level,
          name: scopeName.trim() || user.geographicScope.name,
          code: scopeCode.trim() || user.geographicScope.code,
        },
      });
      setIsEditing(false);
      setMessage({
        tone: "success",
        text: "Thông tin cá nhân, liên hệ và địa bàn đã được cập nhật thành công!",
      });
    } catch (err) {
      setMessage({
        tone: "error",
        text: err instanceof Error ? err.message : "Có lỗi xảy ra khi cập nhật thông tin.",
      });
    }
  };

  return (
    <main className="profile-page workspace-content">
      <PageSectionHeader
        section="Tài khoản"
        title="Hồ sơ cá nhân"
        description="Xem và chỉnh sửa thông tin cá nhân, số điện thoại liên hệ, địa bàn cư trú và ảnh đại diện."
        icon={UserRound}
        className="profile-page-header"
      />

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
        <Input
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
            <span>Thông tin cá nhân & Địa bàn tác nghiệp</span>
            <h2 id="account-info-title">Thông tin tài khoản</h2>
            <p>
              Bạn có thể cập nhật họ tên hiển thị, số điện thoại liên hệ và địa bàn cư trú bất kỳ lúc nào.
            </p>
          </div>
          {!isEditing ? (
            <Button type="button" onClick={() => setIsEditing(true)}>
              <Edit3 size={16} />
              Chỉnh sửa thông tin
            </Button>
          ) : (
            <Button type="button" variant="secondary" onClick={() => setIsEditing(false)}>
              <X size={16} />
              Hủy chỉnh sửa
            </Button>
          )}
        </header>

        {isEditing ? (
          <form onSubmit={handleSaveProfile} className="profile-edit-form" style={{ padding: "20px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
              <label className="field">
                <span className="label-text">
                  Họ và tên hiển thị <b className="req">*</b>
                </span>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="VD: Nguyễn Văn A"
                  required
                />
              </label>

              <label className="field">
                <span className="label-text">Số điện thoại liên hệ</span>
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="VD: 0912 345 678"
                />
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "16px", marginBottom: "20px" }}>
              <label className="field">
                <span className="label-text">Địa bàn / Khu vực cư trú</span>
                <Input
                  value={scopeName}
                  onChange={(e) => setScopeName(e.target.value)}
                  placeholder="VD: Tây Hồ, Hà Nội"
                />
              </label>

              <label className="field">
                <span className="label-text">Mã định danh địa bàn</span>
                <Input
                  value={scopeCode}
                  onChange={(e) => setScopeCode(e.target.value)}
                  placeholder="VD: HN-TAYHO"
                />
              </label>
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <Button type="button" variant="secondary" onClick={() => setIsEditing(false)}>
                Hủy
              </Button>
              <Button type="submit">
                <Save size={16} />
                Lưu thay đổi
              </Button>
            </div>
          </form>
        ) : (
          <dl className="profile-information-grid">
            <div>
              <dt>Họ và tên</dt>
              <dd>{user.displayName}</dd>
            </div>
            <div>
              <dt>Tên đăng nhập</dt>
              <dd>@{user.username}</dd>
            </div>
            <div>
              <dt>Vai trò</dt>
              <dd>{roleLabels[user.role]}</dd>
            </div>
            <div>
              <dt>Số điện thoại liên hệ</dt>
              <dd>
                <Phone size={15} />
                {user.organization?.replace("SĐT: ", "") || identity?.contact || "Chưa cập nhật"}
              </dd>
            </div>
            <div>
              <dt>Phạm vi địa lý</dt>
              <dd>
                <MapPinned size={17} />
                {user.geographicScope.name} ({user.geographicScope.code})
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
        )}

        <footer className="profile-security-note">
          <ShieldCheck size={19} />
          <p>
            Thông tin liên hệ và địa bàn được sử dụng để lực lượng cứu hộ xác định vị trí và liên lạc hỗ trợ khi bạn gửi yêu cầu SOS.
          </p>
        </footer>
      </section>
    </main>
  );
}
