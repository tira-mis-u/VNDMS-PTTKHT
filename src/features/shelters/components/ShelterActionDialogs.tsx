import { useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, X } from "lucide-react";
import type { Shelter } from "@/domain/shelters/types";
import type {
  EvacuationOperation,
  EvacuationStatus,
  RouteStatus,
} from "@/domain/evacuations/types";
import { getEvacuationTransitions } from "@/domain/evacuations/rules";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { Button } from "@/components/ui";
export type ShelterDialog =
  | "capacity"
  | "occupancy"
  | "resources"
  | "create-evacuation"
  | "operation"
  | "redirect"
  | null;
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
      <button className="dialog-backdrop" onClick={onClose} />
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
  operation,
  onClose,
}: {
  mode: ShelterDialog;
  shelter: Shelter;
  operation?: EvacuationOperation;
  onClose: () => void;
}) {
  if (!mode) return null;
  if (mode === "capacity")
    return <Capacity shelter={shelter} onClose={onClose} />;
  if (mode === "occupancy")
    return <Occupancy shelter={shelter} onClose={onClose} />;
  if (mode === "resources")
    return <Resources shelter={shelter} onClose={onClose} />;
  if (mode === "create-evacuation")
    return <CreateEvacuation shelter={shelter} onClose={onClose} />;
  if (mode === "redirect" && operation)
    return <Redirect operation={operation} onClose={onClose} />;
  if (mode === "operation" && operation)
    return <OperationActions operation={operation} onClose={onClose} />;
  return null;
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
        <input
          type="number"
          value={capacity}
          onChange={(event) => setCapacity(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Chỗ đang dự phòng</span>
        <input
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
        <input
          type="number"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
      <p className="form-hint">
        Trạng thái gần đầy/quá tải được tính lại từ state sau khi lưu.
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
          <select
            value={form[key]}
            onChange={(event) => set(key, event.target.value)}
          >
            <option>Đầy đủ</option>
            <option>Hạn chế</option>
            <option>Thiếu</option>
          </select>
        </label>
      ))}
      <label className="field">
        <span>Mức sẵn sàng</span>
        <select
          value={form.readiness}
          onChange={(event) => set("readiness", event.target.value)}
        >
          <option>Sẵn sàng</option>
          <option>Hạn chế</option>
          <option>Không sẵn sàng</option>
        </select>
      </label>
      <label className="field">
        <span>Khả năng tiếp cận</span>
        <select
          value={form.accessibility}
          onChange={(event) => set("accessibility", event.target.value)}
        >
          <option>Tiếp cận bình thường</option>
          <option>Tiếp cận hạn chế</option>
          <option>Không thể tiếp cận</option>
        </select>
      </label>
      <label className="field field-full">
        <span>Ghi chú vận hành</span>
        <textarea
          rows={3}
          value={form.notes}
          onChange={(event) => set("notes", event.target.value)}
        />
      </label>
      <ErrorText value={error} />
    </Frame>
  );
}
function CreateEvacuation({
  shelter,
  onClose,
}: {
  shelter: Shelter;
  onClose: () => void;
}) {
  const { incidents, createEvacuation } = useOperationalState();
  const open = incidents.filter((item) => item.status !== "Đã đóng");
  const [incidentId, setIncident] = useState(open[0]?.id ?? "");
  const incident = open.find((item) => item.id === incidentId);
  const [sourceArea, setArea] = useState(incident?.affectedArea ?? "");
  const [population, setPopulation] = useState("100");
  const [priority, setPriority] = useState<
    "Khẩn cấp" | "Cao" | "Trung bình" | "Thấp"
  >("Cao");
  const [expected, setExpected] = useState("21/08/2026 13:00");
  const [error, setError] = useState("");
  const submit = () => {
    try {
      if (!incident) throw new Error("Phải chọn sự cố.");
      createEvacuation({
        incidentId,
        sourceArea,
        sourceCoordinates: incident.location.coordinates,
        destinationShelterId: shelter.id,
        estimatedPopulation: Number(population),
        priority,
        expectedCompletion: expected,
      });
      onClose();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không thể tạo hoạt động.",
      );
    }
  };
  return (
    <Frame
      title="Điều phối dân cư đến điểm"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={submit}>Tạo hoạt động</Button>
        </>
      }
    >
      <label className="field field-full">
        <span>Sự cố</span>
        <select
          value={incidentId}
          onChange={(event) => {
            setIncident(event.target.value);
            const selected = open.find(
              (item) => item.id === event.target.value,
            );
            if (selected) setArea(selected.affectedArea);
          }}
        >
          {open.map((item) => (
            <option key={item.id} value={item.id}>
              {item.id} — {item.title}
            </option>
          ))}
        </select>
      </label>
      <label className="field field-full">
        <span>Khu vực nguồn</span>
        <input
          value={sourceArea}
          onChange={(event) => setArea(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Dân số dự kiến</span>
        <input
          type="number"
          value={population}
          onChange={(event) => setPopulation(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Ưu tiên</span>
        <select
          value={priority}
          onChange={(event) =>
            setPriority(event.target.value as typeof priority)
          }
        >
          <option>Khẩn cấp</option>
          <option>Cao</option>
          <option>Trung bình</option>
          <option>Thấp</option>
        </select>
      </label>
      <label className="field field-full">
        <span>Hoàn thành dự kiến</span>
        <input
          value={expected}
          onChange={(event) => setExpected(event.target.value)}
        />
      </label>
      <ErrorText value={error} />
    </Frame>
  );
}
function OperationActions({
  operation,
  onClose,
}: {
  operation: EvacuationOperation;
  onClose: () => void;
}) {
  const {
    teams,
    assignEvacuationTeam,
    transitionEvacuation,
    updateEvacuationProgress,
    updateEvacuationRoute,
  } = useOperationalState();
  const available = teams.filter(
    (team) =>
      !team.currentTask &&
      !team.currentEvacuationOperation &&
      team.status === "Sẵn sàng",
  );
  const [teamId, setTeam] = useState(
    operation.assignedTeamId ?? available[0]?.id ?? "",
  );
  const [evacuated, setEvacuated] = useState(
    String(operation.evacuatedPopulation),
  );
  const [status, setStatus] = useState<EvacuationStatus>(operation.status);
  const [routeStatus, setRoute] = useState<RouteStatus>(operation.route.status);
  const [error, setError] = useState("");
  const submit = () => {
    const changes = [
      teamId !== operation.assignedTeamId,
      Number(evacuated) !== operation.evacuatedPopulation,
      routeStatus !== operation.route.status,
      status !== operation.status,
    ].filter(Boolean).length;
    if (changes > 1) {
      setError(
        "Mỗi lần lưu chỉ thực hiện một thay đổi nghiệp vụ để bảo đảm thứ tự lifecycle.",
      );
      return;
    }
    try {
      if (teamId && teamId !== operation.assignedTeamId)
        assignEvacuationTeam(operation.id, teamId);
      else if (Number(evacuated) !== operation.evacuatedPopulation)
        updateEvacuationProgress(operation.id, Number(evacuated));
      else if (routeStatus !== operation.route.status)
        updateEvacuationRoute(operation.id, routeStatus);
      else if (status !== operation.status)
        transitionEvacuation(operation.id, status);
      onClose();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Không thể cập nhật hoạt động.",
      );
    }
  };
  return (
    <Frame
      title={`Cập nhật ${operation.id}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={submit}>Lưu hoạt động</Button>
        </>
      }
    >
      <label className="field">
        <span>Đội phụ trách</span>
        <select
          value={teamId}
          onChange={(event) => setTeam(event.target.value)}
        >
          <option value="">Chưa gán đội</option>
          {operation.assignedTeamId && (
            <option value={operation.assignedTeamId}>
              {operation.assignedTeamId}
            </option>
          )}
          {available.map((team) => (
            <option key={team.id} value={team.id}>
              {team.id} — {team.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Đã sơ tán</span>
        <input
          type="number"
          value={evacuated}
          onChange={(event) => setEvacuated(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Chuyển trạng thái</span>
        <select
          value={status}
          onChange={(event) =>
            setStatus(event.target.value as EvacuationStatus)
          }
        >
          <option>{operation.status}</option>
          {getEvacuationTransitions(operation.status).map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Trạng thái tuyến</span>
        <select
          value={routeStatus}
          onChange={(event) => setRoute(event.target.value as RouteStatus)}
        >
          <option>Thông suốt</option>
          <option>Hạn chế</option>
          <option>Bị chặn</option>
          <option>Đang dùng tuyến thay thế</option>
        </select>
      </label>
      <ErrorText value={error} />
    </Frame>
  );
}
function Redirect({
  operation,
  onClose,
}: {
  operation: EvacuationOperation;
  onClose: () => void;
}) {
  const { shelters, redirectEvacuation } = useOperationalState();
  const candidates = useMemo(
    () =>
      shelters.filter(
        (shelter) =>
          shelter.id !== operation.destinationShelterId &&
          !["Quá tải", "Tạm đóng", "Không thể tiếp cận"].includes(
            shelter.status,
          ),
      ),
    [shelters, operation.destinationShelterId],
  );
  const [id, setId] = useState(candidates[0]?.id ?? "");
  const [error, setError] = useState("");
  const submit = () => {
    try {
      redirectEvacuation(operation.id, id);
      onClose();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không thể chuyển hướng.",
      );
    }
  };
  return (
    <Frame
      title="Chuyển hướng điểm tiếp nhận"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button disabled={!id} onClick={submit}>
            Xác nhận chuyển hướng
          </Button>
        </>
      }
    >
      <label className="field field-full">
        <span>Điểm sơ tán thay thế</span>
        <select value={id} onChange={(event) => setId(event.target.value)}>
          {candidates.map((shelter) => (
            <option key={shelter.id} value={shelter.id}>
              {shelter.id} — {shelter.name}
            </option>
          ))}
        </select>
      </label>
      <p className="form-hint">
        Sức chứa dự phòng còn lại sẽ được chuyển từ điểm cũ sang điểm mới.
      </p>
      <ErrorText value={error} />
    </Frame>
  );
}
