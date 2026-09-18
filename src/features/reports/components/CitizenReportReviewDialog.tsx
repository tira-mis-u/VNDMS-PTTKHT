import { Select as UiSelect } from "@/components/ui/Select";
import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import type { CitizenReport, CitizenReportStatus } from "@/domain/reports/types";
import { citizenReportReviewDecisions } from "@/domain/reports/rules";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { DialogBackdrop, Button, Input, Textarea } from "@/components/ui";

type Decision = Exclude<CitizenReportStatus, "Mới">;

/**
 * Hộp thoại cán bộ đánh giá phản ánh (Hợp lệ / Không hợp lệ / Trùng).
 * Dùng lại khung `incident-form-dialog` + `field` sẵn có, không thêm CSS mới.
 */
export function CitizenReportReviewDialog({
  report,
  onClose,
}: {
  report: CitizenReport;
  onClose: () => void;
}) {
  const { reviewCitizenReport } = useOperationalState();
  const [decision, setDecision] = useState<Decision>("Hợp lệ");
  const [note, setNote] = useState("");
  const [duplicateOfId, setDuplicateOfId] = useState("");
  const [error, setError] = useState("");
  const submit = () => {
    try {
      reviewCitizenReport(
        report.id,
        decision,
        note,
        decision === "Trùng" ? duplicateOfId.trim() || null : null,
      );
      onClose();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không thể đánh giá phản ánh.",
      );
    }
  };
  return (
    <>
      <DialogBackdrop onClick={onClose} />
      <div className="incident-form-dialog sos-form-dialog" role="dialog" aria-modal="true">
        <header>
          <h2>Đánh giá phản ánh {report.code}</h2>
          <button onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="incident-form-body">
          <label className="field field-full">
            <span>Kết luận</span>
            <UiSelect
              value={decision}
              onChange={(event) => setDecision(event.target.value as Decision)}
            >
              {citizenReportReviewDecisions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </UiSelect>
          </label>
          {decision === "Trùng" && (
            <label className="field field-full">
              <span>
                Mã phản ánh/SOS gốc <b>*</b>
              </span>
              <Input
                value={duplicateOfId}
                onChange={(event) => setDuplicateOfId(event.target.value)}
                placeholder="VD: RPT-0001 hoặc SOS-0102"
              />
            </label>
          )}
          <label className="field field-full">
            <span>
              Ghi chú {decision !== "Hợp lệ" && <b>*</b>}
            </span>
            <Textarea
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={
                decision === "Hợp lệ"
                  ? "Tùy chọn: hướng xử lý tiếp theo"
                  : "Bắt buộc: lý do kết luận"
              }
            />
          </label>
          <p className="form-hint">
            Kết luận được ghi vào hồ sơ phản ánh và người gửi sẽ thấy trạng thái
            mới trong Cổng công dân. Phản ánh hợp lệ có thể được dùng để tạo sự cố
            hoặc SOS theo quy trình hiện có.
          </p>
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
          <Button onClick={submit}>Lưu kết luận</Button>
        </footer>
      </div>
    </>
  );
}
