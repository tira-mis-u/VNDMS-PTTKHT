import { Select as UiSelect } from "@/components/ui/Select";
import { useState, type ReactNode } from "react";
import { AlertTriangle, X } from "lucide-react";
import type { Shelter } from "@/domain/shelters/types";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { DialogBackdrop, Button, Input, Textarea } from "@/components/ui";
export type ShelterDialog = "capacity" | "occupancy" | "resources" | null;
function Frame({
  title,
  children,
  footer,
  onClose,
}: {
  title: string;
  children: ReactNode;
  footer: ReactNode;
  onClose: () => void;
}) {
  return (
    <>
      <DialogBackdrop onClick={onClose} />
      <div className="incident-form-dialog shelter-form-dialog">
        <header>
          <h2>{title}</h2>
          <button onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="incident-form-body">{children}</div>
        <footer>{footer}</footer>
      </div>
    </>
  );
}
function ErrorText({ value }: { value: string }) {
  return value ? (
    <p className="team-form-error">
      <AlertTriangle size={14} />
      {value}
    </p>
  ) : null;
}
export function ShelterActionDialogs({
  mode,
  shelter,
  onClose,
}: {
  mode: ShelterDialog;
  shelter: Shelter;
  onClose: () => void;
}) {
  if (!mode) return null;
  if (mode === "capacity")
    return <Capacity shelter={shelter} onClose={onClose} />;
  if (mode === "occupancy")
    return <Occupancy shelter={shelter} onClose={onClose} />;
  return <Resources shelter={shelter} onClose={onClose} />;
}
function Capacity({
  shelter,
  onClose,
}: {
  shelter: Shelter;
  onClose: () => void;
}) {
  const { updateShelterCapacity } = useOperationalState();
  const [capacity, setCapacity] = useState(String(shelter.capacity));
  const [reserved, setReserved] = useState(String(shelter.reservedCapacity));
  const [error, setError] = useState("");
  const submit = () => {
    try {
      updateShelterCapacity(shelter.id, Number(capacity), Number(reserved));
      onClose();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Không thể cập nhật sức chứa.",
      );
    }
  };
  return (
    <Frame
      title="Cập nhật sức chứa"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={submit}>Lưu sức chứa</Button>
        </>
      }
    >
      <label className="field">
        <span>Sức chứa danh định</span>
        <Input
          type="number"
          value={capacity}
          onChange={(event) => setCapacity(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Chỗ đang dự phòng</span>
        <Input
          type="number"
          value={reserved}
          onChange={(event) => setReserved(event.target.value)}
        />
      </label>
      <ErrorText value={error} />
    </Frame>
  );
}
function Occupancy({
  shelter,
  onClose,
}: {
  shelter: Shelter;
  onClose: () => void;
}) {
  const { updateShelterOccupancy } = useOperationalState();
  const [value, setValue] = useState(String(shelter.currentOccupancy));
  const [error, setError] = useState("");
  const submit = () => {
    try {
      updateShelterOccupancy(shelter.id, Number(value));
      onClose();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Không thể cập nhật số người.",
      );
    }
  };
  return (
    <Frame
      title="Cập nhật số người tiếp nhận"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={submit}>Cập nhật</Button>
        </>
      }
    >
      <label className="field field-full">
        <span>Số người hiện có tại điểm</span>
        <Input
          type="number"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
      <p className="form-hint">
        Tình trạng gần đầy hoặc quá tải được tính lại từ dữ liệu sau khi lưu.
      </p>
      <ErrorText value={error} />
    </Frame>
  );
}
function Resources({
  shelter,
  onClose,
}: {
  shelter: Shelter;
  onClose: () => void;
}) {
  const { updateShelterResources } = useOperationalState();
  const [form, setForm] = useState({
    waterAvailability: shelter.waterAvailability,
    foodAvailability: shelter.foodAvailability,
    powerAvailability: shelter.powerAvailability,
    sanitationStatus: shelter.sanitationStatus,
    readiness: shelter.readiness,
    accessibility: shelter.accessibility,
    notes: shelter.notes,
  });
  const [error, setError] = useState("");
  const set = (key: string, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const submit = () => {
    try {
      updateShelterResources(shelter.id, form);
      onClose();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Không thể cập nhật nguồn lực.",
      );
    }
  };
  return (
    <Frame
      title="Cập nhật điều kiện vận hành"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={submit}>Lưu điều kiện</Button>
        </>
      }
    >
      {(
        [
          "waterAvailability",
          "foodAvailability",
          "powerAvailability",
          "sanitationStatus",
        ] as const
      ).map((key, index) => (
        <label className="field" key={key}>
          <span>
            {["Nước sạch", "Lương thực", "Nguồn điện", "Vệ sinh"][index]}
          </span>
          <UiSelect
            value={form[key]}
            onChange={(event) => set(key, event.target.value)}
          >
            <option>Đầy đủ</option>
            <option>Hạn chế</option>
            <option>Thiếu</option>
          </UiSelect>
        </label>
      ))}
      <label className="field">
        <span>Mức sẵn sàng</span>
        <UiSelect
          value={form.readiness}
          onChange={(event) => set("readiness", event.target.value)}
        >
          <option>Sẵn sàng</option>
          <option>Hạn chế</option>
          <option>Không sẵn sàng</option>
        </UiSelect>
      </label>
      <label className="field">
        <span>Khả năng tiếp cận</span>
        <UiSelect
          value={form.accessibility}
          onChange={(event) => set("accessibility", event.target.value)}
        >
          <option>Tiếp cận bình thường</option>
          <option>Tiếp cận hạn chế</option>
          <option>Không thể tiếp cận</option>
        </UiSelect>
      </label>
      <label className="field field-full">
        <span>Ghi chú vận hành</span>
        <Textarea
          rows={3}
          value={form.notes}
          onChange={(event) => set("notes", event.target.value)}
        />
      </label>
      <ErrorText value={error} />
    </Frame>
  );
}
