import { Select as UiSelect } from "@/components/ui/Select";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpenCheck,
  CheckCircle2,
  ChevronRight,
  Clock3,
  GitBranch,
  MapPin,
  Play,
  ShieldCheck,
  X,
} from "lucide-react";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { DialogBackdrop, Badge, Button, EmptyState, Input, Textarea } from "@/components/ui";
export function PlaybookDetailPage({
  playbookId,
  navigate,
}: {
  playbookId: string;
  navigate: (path: string) => void;
}) {
  const store = useOperationalState();
  const playbook = store.playbooks.find((item) => item.id === playbookId);
  const [activate, setActivate] = useState(false);
  const [edit, setEdit] = useState(false);
  if (!playbook)
    return (
      <div className="workspace-content">
        <EmptyState
          title="Không tìm thấy phương án điều phối"
          description={playbookId}
          action={
            <Button onClick={() => navigate("/playbooks")}>Về danh sách</Button>
          }
        />
      </div>
    );
  const execution = store.playbookExecutions.find(
    (item) =>
      item.playbookId === playbook.id &&
      ["Đang hoạt động", "Tạm dừng"].includes(item.status),
  );
  return (
    <div className="workspace-content playbook-detail">
      <div className="detail-topline">
        <button className="back-link" onClick={() => navigate("/playbooks")}>
          <ArrowLeft size={15} />
          Phương án ứng phó
        </button>
        <div className="detail-actions">
          {store.can("playbook_edit") && playbook.status !== "Lưu trữ" && (
            <Button variant="secondary" onClick={() => setEdit(true)}>
              Chỉnh sửa
            </Button>
          )}
          {store.can("playbook_publish") && playbook.status === "Nháp" && (
            <Button onClick={() => store.publishPlaybook(playbook.id)}>
              Xuất bản
            </Button>
          )}
          {store.can("playbook_edit") && playbook.status !== "Lưu trữ" && (
            <Button
              variant="ghost"
              onClick={() => store.archivePlaybook(playbook.id)}
            >
              Lưu trữ
            </Button>
          )}
          {execution ? (
            <Button
              onClick={() => navigate(`/playbooks/${playbook.id}/execute`)}
            >
              <Play size={15} />
              Mở đợt thực hiện
            </Button>
          ) : (
            store.can("playbook_activate") && (
              <Button
                disabled={playbook.status !== "Đã xuất bản"}
                onClick={() => setActivate(true)}
              >
                <Play size={15} />
                Kích hoạt
              </Button>
            )
          )}
        </div>
      </div>
      <header className="playbook-detail-header">
        <span className="playbook-emblem">
          <BookOpenCheck size={24} />
        </span>
        <div>
          <div>
            <span>{playbook.code}</span>
            <Badge
              tone={
                playbook.status === "Đã xuất bản"
                  ? "green"
                  : playbook.status === "Nháp"
                    ? "amber"
                    : "neutral"
              }
            >
              {playbook.status}
            </Badge>
            <Badge tone="blue">v{playbook.version}</Badge>
          </div>
          <h1>{playbook.name}</h1>
          <p>{playbook.description}</p>
        </div>
      </header>
      <div className="playbook-detail-grid">
        <main>
          <section className="detail-section">
            <div className="section-heading">
              <div>
                <h2>Chuỗi bước tác chiến</h2>
                <p>Thứ tự, bước bắt buộc, tiên quyết và tiêu chí hoàn thành</p>
              </div>
            </div>
            <div className="playbook-sequence">
              {[...playbook.steps]
                .sort((a, b) => a.order - b.order)
                .map((step) => (
                  <article key={step.id}>
                    <span className="step-number">{step.order}</span>
                    <div className="step-template-main">
                      <div>
                        <Badge tone={step.required ? "blue" : "neutral"}>
                          {step.required ? "Bắt buộc" : "Tùy chọn"}
                        </Badge>
                        <small>{step.type}</small>
                      </div>
                      <h3>{step.name}</h3>
                      <p>{step.description}</p>
                      <dl>
                        <div>
                          <dt>Mục tiêu</dt>
                          <dd>{step.objective}</dd>
                        </div>
                        <div>
                          <dt>Phụ trách</dt>
                          <dd>
                            {step.responsibleRole}
                            {step.responsibleTeamType
                              ? ` · ${step.responsibleTeamType}`
                              : ""}
                          </dd>
                        </div>
                        <div>
                          <dt>Tiên quyết</dt>
                          <dd>
                            {step.prerequisites.length
                              ? step.prerequisites.join(", ")
                              : "Không có"}
                          </dd>
                        </div>
                        <div>
                          <dt>Tiêu chí hoàn thành</dt>
                          <dd>{step.completionCriteria.join(" · ")}</dd>
                        </div>
                      </dl>
                    </div>
                    <span className="step-duration">
                      <Clock3 size={12} />
                      {step.estimatedDuration}
                    </span>
                  </article>
                ))}
            </div>
          </section>
        </main>
        <aside>
          <section className="detail-section">
            <h2>Điều kiện kích hoạt</h2>
            <ul className="trigger-list">
              {playbook.triggerConditions.map((item) => (
                <li key={item}>
                  <CheckCircle2 size={14} />
                  {item}
                </li>
              ))}
            </ul>
          </section>
          <section className="detail-section">
            <h2>Phạm vi và sở hữu</h2>
            <dl className="relief-facts">
              <div>
                <dt>Loại thiên tai</dt>
                <dd>{playbook.disasterType}</dd>
              </div>
              <div>
                <dt>Ngưỡng mức độ</dt>
                <dd>{playbook.severityThreshold}</dd>
              </div>
              <div>
                <dt>Phạm vi</dt>
                <dd>
                  <MapPin size={12} />
                  {playbook.geographicScope}
                </dd>
              </div>
              <div>
                <dt>Chủ sở hữu</dt>
                <dd>{playbook.owner.name}</dd>
              </div>
              <div>
                <dt>Đơn vị</dt>
                <dd>{playbook.owner.organization}</dd>
              </div>
              <div>
                <dt>Thời gian dự kiến</dt>
                <dd>{playbook.estimatedDuration}</dd>
              </div>
              <div>
                <dt>Cập nhật</dt>
                <dd>{playbook.updatedAt}</dd>
              </div>
            </dl>
          </section>
          <section className="detail-section">
            <h2>Quan hệ thực thi</h2>
            <div className="playbook-relation">
              <GitBranch size={18} />
              <p>
                Mẫu phương án được quản lý độc lập. Mỗi lần kích hoạt tạo một
                đợt thực hiện gắn với đúng một sự cố.
              </p>
            </div>
            {execution && (
              <button
                className="active-execution-link"
                onClick={() => navigate(`/playbooks/${playbook.id}/execute`)}
              >
                <span>
                  <b>{execution.id}</b>
                  <small>
                    {execution.incidentId} · {execution.status}
                  </small>
                </span>
                <ChevronRight size={15} />
              </button>
            )}
          </section>
        </aside>
      </div>
      {activate && (
        <ActivationDialog
          playbookId={playbook.id}
          onClose={() => setActivate(false)}
          navigate={navigate}
        />
      )}{" "}
      {edit && (
        <EditDialog playbookId={playbook.id} onClose={() => setEdit(false)} />
      )}
    </div>
  );
}
function ActivationDialog({
  playbookId,
  onClose,
  navigate,
}: {
  playbookId: string;
  onClose: () => void;
  navigate: (path: string) => void;
}) {
  const { incidents, activatePlaybook } = useOperationalState();
  const [id, setId] = useState(
    incidents.find((item) => item.status !== "Đã đóng")?.id ?? "",
  );
  const [error, setError] = useState("");
  const run = () => {
    try {
      activatePlaybook(playbookId, id);
      onClose();
      navigate(`/playbooks/${playbookId}/execute`);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Không thể kích hoạt phương án ứng phó.",
      );
    }
  };
  return (
    <>
      <DialogBackdrop onClick={onClose} />
      <div className="incident-form-dialog playbook-dialog">
        <header>
          <h2>Kích hoạt phương án điều phối</h2>
          <button onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="incident-form-body">
          <div className="playbook-warning">
            <ShieldCheck size={17} />
            <p>
              Đợt thực hiện mới sẽ liên kết trực tiếp với sự cố và các hồ sơ
              vận hành hiện có.
            </p>
          </div>
          <label className="field field-full">
            <span>Sự cố</span>
            <UiSelect value={id} onChange={(event) => setId(event.target.value)}>
              {incidents
                .filter((item) => item.status !== "Đã đóng")
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.id} — {item.title}
                  </option>
                ))}
            </UiSelect>
          </label>
          {error && (
            <p className="team-form-error">
              <AlertTriangle size={14} />
              {error}
            </p>
          )}
        </div>
        <footer>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={run}>Kích hoạt</Button>
        </footer>
      </div>
    </>
  );
}
function EditDialog({
  playbookId,
  onClose,
}: {
  playbookId: string;
  onClose: () => void;
}) {
  const { playbooks, updatePlaybook } = useOperationalState();
  const playbook = playbooks.find((item) => item.id === playbookId)!;
  const [name, setName] = useState(playbook.name);
  const [description, setDescription] = useState(playbook.description);
  return (
    <>
      <DialogBackdrop onClick={onClose} />
      <div className="incident-form-dialog playbook-dialog">
        <header>
          <h2>Chỉnh sửa phương án điều phối</h2>
          <button onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="incident-form-body">
          <label className="field field-full">
            <span>Tên phương án điều phối</span>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="field field-full">
            <span>Mô tả</span>
            <Textarea
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
        </div>
        <footer>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button
            onClick={() => {
              updatePlaybook(playbookId, { name, description });
              onClose();
            }}
          >
            Lưu
          </Button>
        </footer>
      </div>
    </>
  );
}
