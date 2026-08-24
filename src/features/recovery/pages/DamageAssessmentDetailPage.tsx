import { lazy, Suspense, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  MapPin,
  Paperclip,
  Plus,
  RotateCcw,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import type { DamageItem } from "@/domain/recovery/types";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { DialogBackdrop, Badge, Button, EmptyState, Input, Textarea } from "@/components/ui";
const RecoveryOperationalMap = lazy(
  () => import("../components/RecoveryOperationalMap"),
);
const money = (value: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
export function DamageAssessmentDetailPage({
  assessmentId,
  navigate,
}: {
  assessmentId: string;
  navigate: (path: string) => void;
}) {
  const store = useOperationalState();
  const value = store.damageAssessments.find(
    (item) => item.id === assessmentId,
  );
  const [dialog, setDialog] = useState<
    "verify" | "reject" | "item" | "evidence" | null
  >(null);
  const [error, setError] = useState("");
  if (!value)
    return (
      <div className="workspace-content">
        <EmptyState
          title="Không tìm thấy hồ sơ đánh giá"
          description={assessmentId}
          action={
            <Button onClick={() => navigate("/recovery/assessments")}>
              Về danh sách
            </Button>
          }
        />
      </div>
    );
  const incident = store.incidents.find((item) => item.id === value.incidentId);
  const projects = store.recoveryProjects.filter((item) =>
    item.assessmentIds.includes(value.id),
  );
  const events = store.recoveryEvents
    .filter(
      (item) => item.entityType === "assessment" && item.entityId === value.id,
    )
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const act = (action: () => void) => {
    try {
      setError("");
      action();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Không thể thực hiện thao tác.",
      );
    }
  };
  return (
    <div className="workspace-content assessment-detail">
      <div className="detail-topline">
        <button
          className="back-link"
          onClick={() => navigate("/recovery/assessments")}
        >
          <ArrowLeft size={15} />
          Đánh giá thiệt hại
        </button>
        <div className="detail-actions">
          {value.status === "Nháp" && store.can("damage_assessment_edit") && (
            <>
              <Button variant="secondary" onClick={() => setDialog("item")}>
                <Plus size={14} />
                Hạng mục
              </Button>
              <Button variant="secondary" onClick={() => setDialog("evidence")}>
                <Paperclip size={14} />
                Căn cứ
              </Button>
            </>
          )}
          {value.status === "Nháp" && store.can("damage_assessment_submit") && (
            <Button
              onClick={() => act(() => store.submitDamageAssessment(value.id))}
            >
              <Send size={14} />
              Gửi thẩm định
            </Button>
          )}
          {value.status === "Đã gửi" &&
            store.can("damage_assessment_verify") && (
              <Button
                onClick={() =>
                  act(() => store.reviewDamageAssessment(value.id))
                }
              >
                <ClipboardCheck size={14} />
                Bắt đầu thẩm định
              </Button>
            )}
          {value.status === "Đang thẩm định" &&
            store.can("damage_assessment_reject") && (
              <Button variant="secondary" onClick={() => setDialog("reject")}>
                Từ chối
              </Button>
            )}
          {value.status === "Đang thẩm định" &&
            store.can("damage_assessment_verify") && (
              <Button onClick={() => setDialog("verify")}>
                <ShieldCheck size={14} />
                Xác minh
              </Button>
            )}
          {["Đã xác minh", "Từ chối"].includes(value.status) &&
            store.can("damage_assessment_edit") && (
              <Button
                variant="secondary"
                onClick={() =>
                  act(() => {
                    const id = store.createDamageRevision(value.id);
                    navigate(`/recovery/assessments/${id}`);
                  })
                }
              >
                <RotateCcw size={14} />
                Tạo bản điều chỉnh
              </Button>
            )}
        </div>
      </div>
      {error && (
        <div className="execution-error">
          <AlertTriangle size={15} />
          {error}
        </div>
      )}
      <header className="assessment-detail-header">
        <span className="recovery-emblem">
          <FileCheck2 size={23} />
        </span>
        <div>
          <div>
            <span>{value.code}</span>
            <Badge
              tone={
                value.status === "Đã xác minh"
                  ? "green"
                  : value.status === "Từ chối"
                    ? "red"
                    : value.status === "Đang thẩm định"
                      ? "amber"
                      : "blue"
              }
            >
              {value.status}
            </Badge>
            <Badge
              tone={
                value.severity === "Nghiêm trọng" ||
                value.severity === "Phá hủy"
                  ? "red"
                  : "amber"
              }
            >
              {value.severity}
            </Badge>
          </div>
          <h1>{value.area}</h1>
          <p>
            {value.assessmentType} · bản điều chỉnh {value.revision}
            {value.revisionOf ? ` từ ${value.revisionOf}` : ""}
          </p>
        </div>
        <div className="assessment-loss">
          <small>Thiệt hại ước tính</small>
          <b>{money(value.estimatedLoss)}</b>
        </div>
      </header>
      <div className="assessment-detail-grid">
        <main>
          <section className="detail-section">
            <div className="section-heading">
              <div>
                <h2>Tổng quan tác động</h2>
                <p>{value.summary}</p>
              </div>
            </div>
            <div className="damage-impact-grid">
              <Impact
                label="Dân số ảnh hưởng"
                value={value.affectedPopulation.toLocaleString("vi-VN")}
              />
              <Impact
                label="Hộ dân"
                value={value.affectedHouseholds.toLocaleString("vi-VN")}
              />
              <Impact
                label="Công trình"
                value={String(value.damagedBuildings)}
              />
              <Impact
                label="Hạ tầng"
                value={String(value.damagedInfrastructure)}
              />
              <Impact label="Tuyến đường" value={String(value.damagedRoads)} />
              <Impact
                label="Nông nghiệp"
                value={String(value.damagedAgriculture)}
              />
              <Impact label="Tiện ích" value={String(value.damagedUtilities)} />
            </div>
          </section>
          <section className="detail-section">
            <div className="section-heading">
              <div>
                <h2>Hạng mục thiệt hại</h2>
                <p>Số lượng, mức độ, chi phí và vị trí bị ảnh hưởng</p>
              </div>
            </div>
            <div className="damage-item-table">
              <div>
                <b>Hạng mục</b>
                <b>Số lượng</b>
                <b>Mức độ</b>
                <b>Khu vực</b>
                <b>Chi phí ước tính</b>
              </div>
              {value.items.map((item) => (
                <div key={item.id}>
                  <span>
                    <b>{item.category}</b>
                    <small>{item.description}</small>
                  </span>
                  <span>
                    {item.quantity} {item.unit}
                  </span>
                  <Badge
                    tone={
                      item.damageLevel === "Phá hủy" ||
                      item.damageLevel === "Nghiêm trọng"
                        ? "red"
                        : item.damageLevel === "Trung bình"
                          ? "amber"
                          : "neutral"
                    }
                  >
                    {item.damageLevel}
                  </Badge>
                  <span>{item.affectedArea}</span>
                  <strong>{money(item.estimatedCost)}</strong>
                </div>
              ))}
            </div>
          </section>
          <section className="detail-section">
            <div className="section-heading">
              <div>
                <h2>Căn cứ và xác minh</h2>
                <p>Nguồn, thời điểm, trạng thái và ghi chú</p>
              </div>
            </div>
            <div className="evidence-list">
              {value.evidence.map((item) => (
                <article key={item.id}>
                  <span className="evidence-icon">
                    <Paperclip size={15} />
                  </span>
                  <div>
                    <b>{item.name}</b>
                    <small>
                      {item.source} · {item.timestamp}
                    </small>
                    <p>{item.note}</p>
                  </div>
                  <Badge
                    tone={
                      item.verificationStatus === "Đã xác minh"
                        ? "green"
                        : item.verificationStatus === "Không hợp lệ"
                          ? "red"
                          : "amber"
                    }
                  >
                    {item.verificationStatus}
                  </Badge>
                </article>
              ))}
            </div>
            {value.verification && (
              <div
                className={`verification-record ${value.verification.decision === "Từ chối" ? "rejected" : ""}`}
              >
                <ShieldCheck size={17} />
                <div>
                  <b>
                    {value.verification.decision} bởi {value.verification.actor}
                  </b>
                  <p>{value.verification.note}</p>
                  <small>
                    {value.verification.timestamp} ·{" "}
                    {value.verification.evidence.length} căn cứ
                  </small>
                </div>
              </div>
            )}
          </section>
          <section className="detail-section">
            <div className="section-heading">
              <div>
                <h2>Bản đồ thiệt hại và khôi phục</h2>
                <p>Đánh giá, vùng ảnh hưởng, sự cố và dự án liên quan</p>
              </div>
            </div>
            <Suspense
              fallback={
                <div className="incident-map-fallback">
                  <span className="spinner" />
                  Đang khởi tạo bản đồ…
                </div>
              }
            >
              <RecoveryOperationalMap
                assessments={[value]}
                projects={projects}
                incident={incident}
              />
            </Suspense>
          </section>
        </main>
        <aside>
          <section className="detail-section">
            <h2>Hồ sơ đánh giá</h2>
            <dl className="relief-facts">
              <div>
                <dt>Sự cố</dt>
                <dd>
                  <button
                    onClick={() => navigate(`/incidents/${value.incidentId}`)}
                  >
                    {value.incidentId}
                  </button>
                </dd>
              </div>
              <div>
                <dt>Cán bộ đánh giá</dt>
                <dd>{value.assessor}</dd>
              </div>
              <div>
                <dt>Thời điểm</dt>
                <dd>{value.assessedAt}</dd>
              </div>
              <div>
                <dt>Phạm vi</dt>
                <dd>
                  <MapPin size={12} />
                  {value.geographicScope}
                </dd>
              </div>
              <div>
                <dt>Xác minh</dt>
                <dd>{value.verifiedAt ?? "Chưa xác minh"}</dd>
              </div>
            </dl>
          </section>
          <section className="detail-section">
            <h2>Dự án dựa trên đánh giá</h2>
            <div className="recovery-related-list">
              {projects.map((item) => (
                <button
                  key={item.id}
                  onClick={() => navigate(`/recovery/projects/${item.id}`)}
                >
                  <span>
                    <b>{item.code}</b>
                    <small>{item.name}</small>
                  </span>
                  <Badge tone="blue">{item.status}</Badge>
                </button>
              ))}
              {!projects.length && (
                <p className="section-empty">
                  Chưa có dự án khôi phục liên kết.
                </p>
              )}
            </div>
          </section>
          <section className="detail-section">
            <h2>Nhật ký diễn biến</h2>
            <div className="detail-timeline">
              {events.map((event) => (
                <div key={event.id}>
                  <span />
                  <div>
                    <b>{event.message}</b>
                    <small>
                      {event.timestamp} · {event.actor}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
      {dialog && (
        <AssessmentDialog
          mode={dialog}
          assessmentId={value.id}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
function Impact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}
function AssessmentDialog({
  mode,
  assessmentId,
  onClose,
}: {
  mode: "verify" | "reject" | "item" | "evidence";
  assessmentId: string;
  onClose: () => void;
}) {
  const store = useOperationalState();
  const value = store.damageAssessments.find(
    (item) => item.id === assessmentId,
  )!;
  const [note, setNote] = useState("");
  const [cost, setCost] = useState(0);
  const [error, setError] = useState("");
  const run = () => {
    try {
      if (mode === "verify")
        store.verifyDamageAssessment(
          assessmentId,
          value.evidence.map((item) => item.id),
          note,
        );
      if (mode === "reject") store.rejectDamageAssessment(assessmentId, note);
      if (mode === "item") {
        const coordinates = value.location.coordinates;
        const item: DamageItem = {
          id: `DI-${Date.now()}`,
          category: "Hạ tầng",
          description: note,
          quantity: 1,
          unit: "hạng mục",
          damageLevel: "Trung bình",
          estimatedCost: cost,
          affectedArea: value.area,
          location: { name: value.area, coordinates },
          evidence: [],
          notes: "Bổ sung từ biên bản hiện trường.",
        };
        store.addDamageItem(assessmentId, item);
      }
      if (mode === "evidence")
        store.attachDamageEvidence(assessmentId, {
          id: `EVD-${Date.now()}`,
          name: note,
          source: "Ứng dụng hiện trường",
          timestamp: "21/08/2026 10:45",
          verificationStatus: "Chưa xác minh",
          note: "Bằng chứng bổ sung trong đánh giá.",
        });
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể lưu.");
    }
  };
  const title =
    mode === "verify"
      ? "Xác minh đánh giá"
      : mode === "reject"
        ? "Từ chối đánh giá"
        : mode === "item"
          ? "Thêm hạng mục thiệt hại"
          : "Gắn bằng chứng";
  return (
    <>
      <DialogBackdrop onClick={onClose} />
      <div className="incident-form-dialog recovery-dialog">
        <header>
          <h2>{title}</h2>
          <button onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="incident-form-body">
          <label className="field field-full">
            <span>
              {mode === "item"
                ? "Mô tả hạng mục"
                : mode === "evidence"
                  ? "Tên bằng chứng"
                  : mode === "reject"
                    ? "Lý do từ chối"
                    : "Ghi chú xác minh"}
            </span>
            <Textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          {mode === "item" && (
            <label className="field field-full">
              <span>Chi phí ước tính</span>
              <Input
                type="number"
                value={cost}
                onChange={(e) => setCost(Number(e.target.value))}
              />
            </label>
          )}
          {mode === "verify" && !value.evidence.length && (
            <p className="team-form-error">
              <AlertTriangle size={14} />
              Cần gắn căn cứ trước khi xác minh.
            </p>
          )}
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
          <Button
            disabled={!note || (mode === "verify" && !value.evidence.length)}
            onClick={run}
          >
            {mode === "verify" ? (
              <>
                <CheckCircle2 size={14} />
                Xác minh
              </>
            ) : (
              "Lưu"
            )}
          </Button>
        </footer>
      </div>
    </>
  );
}
