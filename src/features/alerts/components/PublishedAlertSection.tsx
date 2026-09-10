import { Select as UiSelect } from "@/components/ui/Select";
import { useState } from "react";
import { AlertTriangle, Megaphone, X } from "lucide-react";
import type { PublishedAlert } from "@/domain/published-alerts/types";
import {
  alertSeverityLabels,
  alertSeverityTones,
  type AlertSeverity,
} from "@/domain/alerts/types";
import type { PublishedAlertDraftInput } from "@/application/published-alerts/publishedAlertUseCases";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import {
  Badge,
  Button,
  DialogBackdrop,
  EmptyState,
  Input,
  Textarea,
} from "@/components/ui";

const statusTone = (status: PublishedAlert["status"]) =>
  status === "Đã công bố" ? "green" : status === "Nháp" ? "amber" : "neutral";

/**
 * Cảnh báo CÔNG BỐ tới người dân (nháp → công bố → cập nhật/thu hồi).
 * Công dân/đơn vị chỉ thấy bản đã công bố (lọc ở authorizedOperationalView).
 * Tái dùng CSS `alert-list`/`alert-row` của Trung tâm cảnh báo.
 */
export function PublishedAlertSection({
  compact = false,
}: {
  /** Chế độ công dân: không có nút biên tập, tiêu đề ngắn gọn. */
  compact?: boolean;
}) {
  const store = useOperationalState();
  const alerts = store.publishedAlerts;
  const canManage = store.can("published_alert_manage");
  const [dialog, setDialog] = useState<
    | { mode: "draft" }
    | { mode: "edit"; alert: PublishedAlert }
    | { mode: "withdraw"; alert: PublishedAlert }
    | null
  >(null);
  const [error, setError] = useState("");
  const run = (action: () => unknown) => {
    try {
      setError("");
      action();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể thực hiện thao tác.");
    }
  };
  const rows = [...alerts].sort((a, b) => {
    const rank = (s: PublishedAlert["status"]) =>
      s === "Đã công bố" ? 0 : s === "Nháp" ? 1 : 2;
    return rank(a.status) - rank(b.status) || b.updatedAt.localeCompare(a.updatedAt);
  });
  return (
    <section className="content-section alert-queue" aria-label="Cảnh báo công bố tới người dân">
      <div className="incident-result-bar">
        <span>
          <Megaphone size={14} /> <b>{rows.length}</b>{" "}
          {compact ? "cảnh báo đang công bố" : "bản tin cảnh báo công bố tới người dân"}
        </span>
        {canManage && !compact && (
          <Button size="sm" onClick={() => setDialog({ mode: "draft" })}>
            Soạn cảnh báo mới
          </Button>
        )}
      </div>
      {error && (
        <div className="alert-error" role="alert">
          {error}
        </div>
      )}
      {rows.length === 0 ? (
        <EmptyState
          title="Chưa có cảnh báo công bố"
          description={
            compact
              ? "Hiện không có bản tin cảnh báo nào đang có hiệu lực trên địa bàn."
              : "Soạn nháp và công bố để người dân nhìn thấy trong Cổng công dân."
          }
        />
      ) : (
        <div className="alert-list">
          {rows.map((alert) => (
            <article
              key={alert.id}
              className={`alert-row alert-severity-${alert.severity} ${
                alert.status === "Đã công bố" ? "alert-unread" : ""
              }`}
            >
              <div className="alert-row-main">
                <div className="alert-row-head">
                  <Badge tone={alertSeverityTones[alert.severity]}>
                    {alertSeverityLabels[alert.severity]}
                  </Badge>
                  <Badge tone={statusTone(alert.status)}>{alert.status}</Badge>
                  <span className="alert-row-category">{alert.areaName}</span>
                  <span className="alert-row-condition">
                    {alert.code}
                    {alert.revision > 1 ? ` · bản ${alert.revision}` : ""}
                  </span>
                  <time>{alert.publishedAt ?? alert.updatedAt}</time>
                </div>
                <h3>{alert.title}</h3>
                <p>{alert.content}</p>
                <div className="alert-row-meta">
                  <span>
                    Ban hành: <b>{alert.createdBy}</b>
                  </span>
                  {alert.publishedAt && (
                    <span>
                      Công bố: <b>{alert.publishedAt}</b>
                    </span>
                  )}
                  {alert.withdrawnAt && (
                    <span>
                      Thu hồi: <b>{alert.withdrawnAt}</b>
                    </span>
                  )}
                </div>
              </div>
              {canManage && !compact && (
                <div className="alert-row-actions">
                  {alert.status === "Nháp" && (
                    <Button size="sm" onClick={() => run(() => store.publishAlert(alert.id))}>
                      Công bố
                    </Button>
                  )}
                  {alert.status !== "Đã thu hồi" && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setDialog({ mode: "edit", alert })}
                    >
                      {alert.status === "Đã công bố" ? "Cập nhật bản tin" : "Sửa nháp"}
                    </Button>
                  )}
                  {alert.status === "Đã công bố" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDialog({ mode: "withdraw", alert })}
                    >
                      Thu hồi
                    </Button>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      {dialog && dialog.mode !== "withdraw" && (
        <PublishedAlertEditor
          initial={dialog.mode === "edit" ? dialog.alert : null}
          onClose={() => setDialog(null)}
          onSubmit={(input) => {
            if (dialog.mode === "edit") store.updatePublishedAlert(dialog.alert.id, input);
            else store.draftPublishedAlert(input);
          }}
        />
      )}
      {dialog && dialog.mode === "withdraw" && (
        <WithdrawDialog
          alert={dialog.alert}
          onClose={() => setDialog(null)}
          onSubmit={(reason) => store.withdrawPublishedAlert(dialog.alert.id, reason)}
        />
      )}
    </section>
  );
}

function Frame({
  title,
  children,
  footer,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  footer: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <>
      <DialogBackdrop onClick={onClose} />
      <div className="incident-form-dialog sos-form-dialog">
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

function PublishedAlertEditor({
  initial,
  onClose,
  onSubmit,
}: {
  initial: PublishedAlert | null;
  onClose: () => void;
  onSubmit: (input: PublishedAlertDraftInput) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [severity, setSeverity] = useState<AlertSeverity>(initial?.severity ?? "high");
  const [areaName, setAreaName] = useState(initial?.areaName ?? "");
  const [error, setError] = useState("");
  const submit = () => {
    try {
      onSubmit({ title, content, severity, areaName });
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể lưu cảnh báo.");
    }
  };
  return (
    <Frame
      title={
        initial
          ? initial.status === "Đã công bố"
            ? `Cập nhật bản tin ${initial.code}`
            : `Sửa nháp ${initial.code}`
          : "Soạn cảnh báo công bố"
      }
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={submit}>{initial ? "Lưu thay đổi" : "Lưu nháp"}</Button>
        </>
      }
    >
      <label className="field field-full">
        <span>
          Tiêu đề <b>*</b>
        </span>
        <Input value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>
      <label className="field">
        <span>Mức độ</span>
        <UiSelect
          value={severity}
          onChange={(event) => setSeverity(event.target.value as AlertSeverity)}
        >
          {(Object.keys(alertSeverityLabels) as AlertSeverity[]).map((key) => (
            <option key={key} value={key}>
              {alertSeverityLabels[key]}
            </option>
          ))}
        </UiSelect>
      </label>
      <label className="field">
        <span>
          Khu vực áp dụng <b>*</b>
        </span>
        <Input
          value={areaName}
          onChange={(event) => setAreaName(event.target.value)}
          placeholder="VD: Hà Nội; Lào Cai, Yên Bái"
        />
      </label>
      <label className="field field-full">
        <span>
          Nội dung <b>*</b>
        </span>
        <Textarea rows={5} value={content} onChange={(event) => setContent(event.target.value)} />
      </label>
      <p className="form-hint">
        {initial?.status === "Đã công bố"
          ? "Lưu thay đổi sẽ tạo bản tin mới (tăng số bản) và người dân thấy nội dung cập nhật ngay."
          : "Nháp chưa hiển thị với người dân cho tới khi bấm Công bố."}
      </p>
      {error && (
        <p className="team-form-error">
          <AlertTriangle size={14} />
          {error}
        </p>
      )}
    </Frame>
  );
}

function WithdrawDialog({
  alert,
  onClose,
  onSubmit,
}: {
  alert: PublishedAlert;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  return (
    <Frame
      title={`Thu hồi cảnh báo ${alert.code}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button
            onClick={() => {
              try {
                onSubmit(reason);
                onClose();
              } catch (cause) {
                setError(cause instanceof Error ? cause.message : "Không thể thu hồi.");
              }
            }}
          >
            Xác nhận thu hồi
          </Button>
        </>
      }
    >
      <div className="sos-confirm danger">
        <AlertTriangle size={18} />
        <p>Bản tin sẽ không còn hiển thị với người dân. Lý do thu hồi được ghi vào nhật ký.</p>
      </div>
      <label className="field field-full">
        <span>
          Lý do thu hồi <b>*</b>
        </span>
        <Textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
      </label>
      {error && (
        <p className="team-form-error">
          <AlertTriangle size={14} />
          {error}
        </p>
      )}
    </Frame>
  );
}
