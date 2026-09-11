import { useState, type FormEvent } from "react";
import {
  AlertCircle,
  LocateFixed,
  MessageSquareWarning,
  Radio,
  Send,
  X,
} from "lucide-react";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { Badge, Button, Input, Textarea, DialogBackdrop } from "@/components/ui";
import { Select as UiSelect } from "@/components/ui/Select";
import type { SosSeverity } from "@/domain/sos/types";
import type { CitizenReportCategory } from "@/domain/reports/types";
import { citizenReportCategories } from "@/domain/reports/types";
import type { CitizenLocationSource } from "./useCitizenLocation";

/**
 * Biểu mẫu SOS chi tiết + biểu mẫu phản ánh của người dân — dùng chung cho
 * Trang chủ (nút "+ Nhập chi tiết cứu hộ nâng cao") và trang Yêu cầu của tôi.
 */
export function SosCreationModal({
  location,
  locationSource,
  onRequestGps,
  onClose,
  onSuccess,
}: {
  location: [number, number] | null;
  locationSource: CitizenLocationSource;
  onRequestGps: () => void;
  onClose: () => void;
  onSuccess: (id: string) => void;
}) {
  const store = useOperationalState();
  const user = store.currentUser!;
  const [name, setName] = useState(user.displayName || "");
  const [phone, setPhone] = useState(
    user.organization?.replace("SĐT: ", "") || "",
  );
  const [address, setAddress] = useState(
    user.geographicScope.name || "",
  );
  const [peopleCount, setPeopleCount] = useState(2);
  const [elderly, setElderly] = useState(0);
  const [children, setChildren] = useState(0);
  const [injured, setInjured] = useState(0);
  const [severity, setSeverity] = useState<SosSeverity>("Đe dọa tính mạng");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !address.trim() || !description.trim()) {
      setError("Vui lòng điền đầy đủ các thông tin có dấu *");
      return;
    }
    if (!location) {
      setError(
        "Chưa có vị trí. Hãy bấm “Lấy vị trí GPS” hoặc đóng biểu mẫu rồi sang mục Bản đồ tác nghiệp để đánh dấu vị trí — hệ thống không gửi tọa độ mặc định.",
      );
      return;
    }
    setError("");
    setBusy(true);

    try {
      const id = store.createSos({
        reporter: {
          name: name.trim(),
          contact: phone.trim(),
          source: "Người dân",
        },
        location: {
          name: address.trim(),
          address: address.trim(),
          administrativeArea: user.geographicScope.name || "Hà Nội",
          coordinates: location,
          accessCondition: "Tiếp cận bình thường",
          floodDepth: "Chưa đo",
        },
        description: description.trim(),
        peopleAtRisk: Number(peopleCount) || 1,
        elderlyCount: Number(elderly) || 0,
        childrenCount: Number(children) || 0,
        injuredCount: Number(injured) || 0,
        missingCount: 0,
        disabledCount: 0,
        severity,
        communicationStatus: "Kết nối",
        gpsCaptured: locationSource === "gps",
      });
      setBusy(false);
      onSuccess(id);
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra khi gửi yêu cầu SOS.");
    }
  };

  return (
    <>
      <DialogBackdrop onClick={onClose} />
      <div className="citizen-sos-modal" role="dialog" aria-modal="true">
        <header className="citizen-sos-modal-header">
          <h3>
            <Radio size={20} />
            GỬI YÊU CẦU CỨU HỘ KHẨN CẤP (SOS)
          </h3>
          <button onClick={onClose} type="button" aria-label="Đóng">
            <X size={18} />
          </button>
        </header>

        <form onSubmit={submit} className="citizen-sos-modal-body">
          {error && (
            <div className="login-error" role="alert">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <label className="field">
              <span className="label-text">
                Họ và tên người cần cứu hộ <b className="req">*</b>
              </span>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Nguyễn Văn A"
                required
                autoFocus
              />
            </label>

            <label className="field">
              <span className="label-text">
                Số điện thoại liên hệ <b className="req">*</b>
              </span>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="VD: 0912 345 678"
                required
              />
            </label>
          </div>

          <label className="field">
            <span className="label-text">
              Địa chỉ / Vị trí chính xác đang gặp nguy hiểm <b className="req">*</b>
            </span>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="VD: Số 45 ngõ 124 đường Âu Cơ, Tây Hồ, Hà Nội"
              required
            />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
            <label className="field">
              <span className="label-text">Tổng số người</span>
              <Input
                type="number"
                min={1}
                value={peopleCount}
                onChange={(e) => setPeopleCount(Number(e.target.value))}
              />
            </label>

            <label className="field">
              <span className="label-text">Người già</span>
              <Input
                type="number"
                min={0}
                value={elderly}
                onChange={(e) => setElderly(Number(e.target.value))}
              />
            </label>

            <label className="field">
              <span className="label-text">Trẻ nhỏ</span>
              <Input
                type="number"
                min={0}
                value={children}
                onChange={(e) => setChildren(Number(e.target.value))}
              />
            </label>

            <label className="field">
              <span className="label-text">Bị thương</span>
              <Input
                type="number"
                min={0}
                value={injured}
                onChange={(e) => setInjured(Number(e.target.value))}
              />
            </label>
          </div>

          <div className="field">
            <span className="label-text">Vị trí gửi kèm</span>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <Badge tone={location ? (locationSource === "gps" ? "green" : "amber") : "red"}>
                {location
                  ? locationSource === "gps"
                    ? `GPS thiết bị · ${location[1].toFixed(5)}, ${location[0].toFixed(5)}`
                    : `Đánh dấu trên bản đồ · ${location[1].toFixed(5)}, ${location[0].toFixed(5)}`
                  : "Chưa có vị trí"}
              </Badge>
              <Button type="button" variant="secondary" onClick={onRequestGps} style={{ height: "30px", fontSize: "12.5px" }}>
                <LocateFixed size={14} /> Lấy vị trí GPS
              </Button>
            </div>
          </div>

          <label className="field">
            <span className="label-text">Mức độ nguy cấp</span>
            <UiSelect
              value={severity}
              onChange={(e) => setSeverity(e.target.value as SosSeverity)}
            >
              <option value="Đe dọa tính mạng">Khẩn cấp — Đe dọa tính mạng (Nước ngập cao, cô lập, nguy hiểm)</option>
              <option value="Nghiêm trọng">Nghiêm trọng — Cần cứu hộ sớm</option>
              <option value="Đáng chú ý">Đáng chú ý — Cần hỗ trợ di dời hoặc thiếu nhu yếu phẩm</option>
              <option value="Thông thường">Thông thường — Cần hỗ trợ hậu cần</option>
            </UiSelect>
          </label>

          <label className="field">
            <span className="label-text">
              Mô tả tình trạng hiện tại <b className="req">*</b>
            </span>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="VD: Nước lũ đã ngập lên tầng 1 cao hơn 1.5m, mất điện, có 1 người già khó di chuyển và 1 trẻ nhỏ, cần xuồng cứu hộ gấp..."
              required
            />
          </label>

          <div className="citizen-sos-modal-footer">
            <Button type="button" variant="secondary" onClick={onClose}>
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={busy || !description.trim()}
              style={{ backgroundColor: "#dc2626", borderColor: "#dc2626" }}
            >
              <Send size={16} />
              {busy ? "Đang phát tín hiệu SOS…" : "Xác nhận gửi SOS cứu nạn"}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}

export function CitizenReportModal({
  location,
  locationSource,
  onClose,
  onSuccess,
}: {
  location: [number, number] | null;
  locationSource: CitizenLocationSource;
  onClose: () => void;
  onSuccess: (id: string) => void;
}) {
  const store = useOperationalState();
  const user = store.currentUser!;
  const [category, setCategory] = useState<CitizenReportCategory>("Ngập lụt");
  const [address, setAddress] = useState(user.geographicScope.name || "");
  const [contact, setContact] = useState(user.phone || "");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    try {
      const id = store.createCitizenReport({
        reporterName: user.displayName,
        contact: contact.trim() || "Chưa cập nhật",
        category,
        description,
        location: {
          address,
          administrativeArea: user.geographicScope.name || "Hà Nội",
          // null khi không có GPS/không đánh dấu — không dùng tọa độ mặc định
          coordinates: location,
        },
      });
      onSuccess(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể gửi phản ánh.");
    }
  };

  return (
    <>
      <DialogBackdrop onClick={onClose} />
      <div className="citizen-sos-modal" role="dialog" aria-modal="true">
        <header className="citizen-sos-modal-header">
          <h3>
            <MessageSquareWarning size={20} />
            GỬI PHẢN ÁNH HIỆN TRƯỜNG
          </h3>
          <button onClick={onClose} type="button" aria-label="Đóng">
            <X size={18} />
          </button>
        </header>
        <form onSubmit={submit} className="citizen-sos-modal-body">
          {error && (
            <div className="login-error" role="alert">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <label className="field">
              <span className="label-text">Loại sự việc</span>
              <UiSelect
                value={category}
                onChange={(e) => setCategory(e.target.value as CitizenReportCategory)}
              >
                {citizenReportCategories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </UiSelect>
            </label>
            <label className="field">
              <span className="label-text">Số điện thoại liên hệ</span>
              <Input type="tel" value={contact} onChange={(e) => setContact(e.target.value)} />
            </label>
          </div>
          <label className="field">
            <span className="label-text">
              Địa chỉ / vị trí sự việc <b className="req">*</b>
            </span>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="VD: Ngã tư Âu Cơ – Lạc Long Quân, Tây Hồ, Hà Nội"
              required
            />
          </label>
          <div className="field">
            <span className="label-text">Tọa độ kèm theo</span>
            <Badge tone={location ? (locationSource === "gps" ? "green" : "amber") : "neutral"}>
              {location
                ? `${locationSource === "gps" ? "GPS thiết bị" : "Đánh dấu trên bản đồ"} · ${location[1].toFixed(5)}, ${location[0].toFixed(5)}`
                : "Không có tọa độ — cán bộ sẽ xác định theo địa chỉ"}
            </Badge>
          </div>
          <label className="field">
            <span className="label-text">
              Mô tả sự việc <b className="req">*</b>
            </span>
            <Textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="VD: Đường ngập khoảng 40cm, xe máy không qua được; cây xà cừ đổ chắn nửa lòng đường…"
              required
            />
          </label>
          <div className="citizen-sos-modal-footer">
            <Button type="button" variant="secondary" onClick={onClose}>
              Hủy
            </Button>
            <Button type="submit" disabled={!description.trim() || !address.trim()}>
              <Send size={16} />
              Gửi phản ánh
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
