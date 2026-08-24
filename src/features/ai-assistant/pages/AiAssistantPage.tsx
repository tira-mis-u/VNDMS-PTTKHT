import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Database,
  ExternalLink,
  FileSearch,
  Info,
  Play,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { Badge, Button, PageSectionHeader, Textarea } from "@/components/ui";
import type {
  AiActionProposal,
  AiActionResult,
  AiContext,
  AiEvidence,
  AiGroundingSnapshot,
  AiResponse,
  AiStatementClass,
} from "@/domain/ai/types";
import { groundOperationalQuestion } from "@/application/ai/aiGrounding";
import { executeGroundedAction } from "@/application/ai/aiActions";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
const starters = [
  "Điều gì cần xử lý ngay?",
  "Đội cứu hộ nào đang sẵn sàng?",
  "Có nhiệm vụ nào đang quá hạn?",
  "Có SOS P1 nào chưa được điều phối?",
  "Kho nào đang thiếu vật tư?",
];
const categoryLabel: Record<AiStatementClass, string> = {
  FACT: "SỰ KIỆN",
  INFERENCE: "SUY LUẬN",
  RECOMMENDATION: "KHUYẾN NGHỊ",
  UNKNOWN: "CHƯA XÁC ĐỊNH",
};
const categoryIcon: Record<AiStatementClass, typeof Info> = {
  FACT: Database,
  INFERENCE: FileSearch,
  RECOMMENDATION: ClipboardCheck,
  UNKNOWN: AlertTriangle,
};
function initialContext(): AiContext | undefined {
  const params = new URLSearchParams(window.location.search);
  const entityType = params.get("context") as AiContext["entityType"];
  const entityId = params.get("id") ?? undefined;
  return entityType && entityId ? { entityType, entityId } : undefined;
}
export function AiAssistantPage({
  navigate,
}: {
  navigate: (path: string) => void;
}) {
  const store = useOperationalState();
  const context = useMemo(() => initialContext(), []);
  const snapshot: AiGroundingSnapshot = {
    incidents: store.incidents,
    tasks: store.tasks,
    teams: store.teams,
    shelters: store.shelters,
    evacuationOperations: store.evacuationOperations,
    sosRequests: store.sosRequests,
    warehouses: store.warehouses,
    inventory: store.inventory,
    reliefRequests: store.reliefRequests,
    reservations: store.reservations,
    playbooks: store.playbooks,
    playbookExecutions: store.playbookExecutions,
    damageAssessments: store.damageAssessments,
    recoveryProjects: store.recoveryProjects,
    simulation: store.simulation,
  };
  const makeResponse = (question: string) =>
    groundOperationalQuestion({
      question,
      user: store.currentUser,
      snapshot,
      context,
      alerts: store.alerts,
    });
  const [responses, setResponses] = useState<AiResponse[]>(() =>
    context?.entityId ? [makeResponse(`Phân tích ${context.entityId}`)] : [],
  );
  const [input, setInput] = useState("");
  const [selected, setSelected] = useState<AiResponse | null>(
    () => responses[0] ?? null,
  );
  const [pending, setPending] = useState<{
    response: AiResponse;
    action: AiActionProposal;
  } | null>(null);
  const [result, setResult] = useState<AiActionResult | null>(null);
  const ask = (question: string) => {
    const value = question.trim();
    if (!value) return;
    const response = makeResponse(value);
    setResponses((current) => [...current, response]);
    setSelected(response);
    setInput("");
    setResult(null);
  };
  const execute = () => {
    if (!pending) return;
    const actionResult = executeGroundedAction(
      {
        proposal: pending.action,
        confirmed: true,
        user: store.currentUser,
        snapshot,
      },
      {
        assignTask: store.assignTaskTeam,
        dispatchSos: store.createRescueTaskFromSos,
        startTask: (id) => store.transitionTask(id, "Đang thực hiện"),
        redirectEvacuation: store.redirectEvacuation,
        createTask: store.createTask,
      },
    );
    setResult(actionResult);
    setPending(null);
  };
  return (
    <div className="workspace-content ai-workspace">
      <PageSectionHeader
        section="Hỗ trợ quyết định tác nghiệp"
        title="Trợ lý điều hành VNDMS"
        description="Trao đổi về tình hình tác nghiệp, kiểm tra bằng chứng và xác nhận hành động ngay trong một không gian hội thoại thống nhất."
        icon={Bot}
        className="ai-page-header"
        actions={
          <div className="ai-header-state">
            <ShieldCheck size={16} />
            <span>
              <small>Người dùng và phạm vi</small>
              <b>
                {store.currentUser?.displayName} ·{" "}
                {store.currentUser?.geographicScope.name}
              </b>
            </span>
          </div>
        }
      />
      {store.simulation.status !== "Sẵn sàng" || store.simulation.tick > 0 ? (
        <div className="ai-simulation-notice">
          <Info size={16} />
          <div>
            <b>Dữ liệu hiện tại có trạng thái mô phỏng.</b>
            <span>
              Đây là dữ liệu mô phỏng theo kịch bản xác định trước, không phải dữ liệu cảm biến
              thực tế.
            </span>
          </div>
        </div>
      ) : null}
      <div className="ai-layout">
        <main className="ai-conversation">
          <section className="ai-context-strip">
            <span>
              <Sparkles size={15} />
              <b>Ngữ cảnh làm việc</b>
            </span>
            {context?.entityId ? (
              <button onClick={() => ask(`Phân tích ${context.entityId}`)}>
                {context.entityType
                  ? evidenceEntityLabels[context.entityType]
                  : "Dữ liệu tác nghiệp"} · {context.entityId}
                <ChevronRight size={14} />
              </button>
            ) : (
              <span>Toàn bộ phạm vi được phân quyền</span>
            )}
          </section>
          {!responses.length && (
            <section className="ai-welcome">
              <span className="ai-welcome-icon">
                <Bot size={22} />
              </span>
              <div>
                <h2>Bắt đầu đánh giá tác nghiệp</h2>
                <p>
                  Trợ lý chỉ sử dụng dữ liệu nghiệp vụ hiện có trong phạm vi được phân quyền. Thông tin thiếu sẽ được đánh dấu “Chưa xác định”.
                </p>
              </div>
              <div className="ai-starters">
                {starters.map((item) => (
                  <button key={item} onClick={() => ask(item)}>
                    {item}
                    <ChevronRight size={14} />
                  </button>
                ))}
              </div>
            </section>
          )}
          {responses.map((response) => (
            <article
              className="ai-response"
              key={response.id + response.question}
            >
              <div className="ai-question-row">
                <span>{store.currentUser?.displayName}</span>
                <strong>{response.question}</strong>
              </div>
              <div className="ai-answer-head">
                <span className="ai-assistant-mark">
                  <Bot size={17} />
                </span>
                <div>
                  <small>Kết luận tác nghiệp</small>
                  <h2>{response.conclusion}</h2>
                  <span>{response.generatedAt}</span>
                </div>
                {response.evidence.length > 0 && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setSelected(response)}
                  >
                    <Database size={14} />
                    {response.evidence.length} bằng chứng
                  </Button>
                )}
              </div>
              {response.simulationNotice && (
                <p className="ai-inline-limit">
                  <Info size={14} />
                  {response.simulationNotice}
                </p>
              )}
              <div className="ai-statement-list">
                {response.statements.map((statement) => {
                  const Icon = categoryIcon[statement.classification];
                  return (
                    <section
                      className={`ai-statement ai-${statement.classification.toLowerCase()}`}
                      key={statement.id}
                    >
                      <div>
                        <Icon size={15} />
                        <b>{categoryLabel[statement.classification]}</b>
                      </div>
                      <p>{statement.text}</p>
                      {statement.evidenceIds.length > 0 && (
                        <button onClick={() => setSelected(response)}>
                          <ExternalLink size={13} />
                          Kiểm tra {statement.evidenceIds.length} bằng chứng
                        </button>
                      )}
                    </section>
                  );
                })}
              </div>
              {response.actions.length > 0 && (
                <div className="ai-actions">
                  <div>
                    <ClipboardCheck size={16} />
                    <span>
                      <b>Hành động có thể xác nhận</b>
                      <small>Không hành động nào được thực thi tự động.</small>
                    </span>
                  </div>
                  {response.actions.map((action) => (
                    <div className="ai-action-row" key={action.id}>
                      <span>
                        <b>{action.label}</b>
                        <small>{action.reason}</small>
                      </span>
                      {store.can(
                        action.permission,
                        action.resourceScope,
                        action.payload.teamId,
                      ) ? (
                        <Button
                          size="sm"
                          onClick={() => setPending({ response, action })}
                        >
                          <Play size={14} />
                          Thực thi
                        </Button>
                      ) : (
                        <span className="ai-action-denied">
                          Bạn không có quyền thực hiện thao tác này.
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}
          {result && (
            <div className="ai-execution-result">
              {result.status === "executed" ? (
                <CheckCircle2 size={17} />
              ) : (
                <AlertTriangle size={17} />
              )}
              <div>
                <b>Kết quả thực thi</b>
                <p>{result.message}</p>
                <small>
                  {result.status === "executed"
                    ? "Dữ liệu nghiệp vụ và nhật ký xử lý đã được cập nhật qua quy trình an toàn."
                    : "Không có thay đổi nào được hoàn tất; cần đọc lại trạng thái trước khi thử lại."}
                </small>
              </div>
            </div>
          )}
          <form
            className="ai-composer"
            onSubmit={(event) => {
              event.preventDefault();
              ask(input);
            }}
          >
            <label htmlFor="ai-question">Câu hỏi tác nghiệp</label>
            <div>
              <Textarea
                id="ai-question"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Nhập câu hỏi về sự cố, nhiệm vụ, đội, SOS, sơ tán hoặc nguồn lực…"
                rows={2}
              />
              <Button type="submit" disabled={!input.trim()}>
                <Send size={16} />
                Phân tích
              </Button>
            </div>
            <small>
              Không sử dụng nguồn ngoài. Mọi sự kiện đều có bằng chứng từ trạng
              thái VNDMS.
            </small>
          </form>
        </main>
        <aside className="ai-evidence-panel">
          <div className="ai-panel-title">
            <div>
              <Database size={17} />
              <span>
                <b>Bằng chứng</b>
                <small>Nguồn dữ liệu và trường liên quan</small>
              </span>
            </div>
            {selected && <Badge tone="blue">{selected.evidence.length}</Badge>}
          </div>
          {selected ? (
            <div className="ai-evidence-list">
              {selected.evidence.map((item) => (
                <EvidenceCard
                  key={item.id}
                  evidence={item}
                  navigate={navigate}
                />
              ))}
            </div>
          ) : (
            <div className="ai-panel-empty">
              <Database size={22} />
              <b>Chưa chọn câu trả lời</b>
              <p>Bằng chứng của câu trả lời sẽ hiển thị tại đây để kiểm tra.</p>
            </div>
          )}
          <div className="ai-limitations">
            <b>Giới hạn</b>
            <p>
              Không suy đoán dữ liệu định vị, cảm biến, giao thông hoặc thông tin
              bên ngoài chưa có trong trạng thái chuẩn.
            </p>
          </div>
        </aside>
      </div>
      {pending && (
        <div className="ai-dialog-backdrop" role="presentation">
          <div
            className="ai-confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-confirm-title"
          >
            <header>
              <div>
                <span>Xác nhận hành động tác nghiệp</span>
                <h2 id="ai-confirm-title">{pending.action.label}</h2>
              </div>
              <button onClick={() => setPending(null)} aria-label="Đóng">
                <X size={19} />
              </button>
            </header>
            <section>
              <h3>Hành động và lý do</h3>
              <p>{pending.action.reason}</p>
            </section>
            <section>
              <h3>Hiện trạng đã đọc lại</h3>
              <ul>
                {pending.action.currentState.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
            <section>
              <h3>Dữ liệu nền và nguồn lực ảnh hưởng</h3>
              <p>{pending.action.affectedResources.join(" · ")}</p>
              <small>
                Người thực hiện: {store.currentUser?.displayName} ·{" "}
                {store.currentUser?.geographicScope.name}
              </small>
            </section>
            <div className="ai-confirm-warning">
              <AlertTriangle size={16} />
              <span>
                Trợ lý sẽ gửi yêu cầu qua quy trình cập nhật an toàn. Hành động
                không thể thực hiện nếu quyền hoặc trạng thái đã thay đổi.
              </span>
            </div>
            <footer>
              <Button variant="secondary" onClick={() => setPending(null)}>
                Hủy
              </Button>
              <Button onClick={execute}>
                <ShieldCheck size={15} />
                Xác nhận thực thi
              </Button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
const evidenceFieldLabels: Record<string, string> = {
  actionBasis: "Căn cứ đề xuất",
  "status / tick": "Trạng thái và bước mô phỏng",
  "severity / status": "Mức độ và trạng thái",
  reference: "Tham chiếu nghiệp vụ",
  severity: "Mức độ",
  status: "Trạng thái",
  "location.name": "Khu vực",
  progress: "Tiến độ",
  dueAt: "Hạn xử lý",
  teamId: "Đội phụ trách",
  availability: "Khả năng điều phối",
  region: "Địa bàn",
  capacity: "Sức chứa",
  currentOccupancy: "Số người đang lưu trú",
  reservedCapacity: "Số chỗ đã giữ",
  availableCapacity: "Số chỗ còn lại",
  priority: "Mức ưu tiên",
  verificationStatus: "Tình trạng xác minh",
  assignedTeamId: "Đội được phân công",
  peopleAtRisk: "Số người gặp nguy hiểm",
  affectedPeople: "Người bị ảnh hưởng",
  evacuatedPopulation: "Số người đã sơ tán",
  estimatedPopulation: "Số người dự kiến sơ tán",
  "route.status": "Tình trạng tuyến",
  quantityOnHand: "Số lượng hiện có",
  quantityReserved: "Số lượng đã phân bổ",
  reorderLevel: "Ngưỡng bổ sung",
  currentStep: "Bước hiện tại",
  spentBudget: "Kinh phí đã chi",
  approvedBudget: "Kinh phí được duyệt",
  count: "Số lượng",
  "priority / assignment": "Ưu tiên và phân công",
};

const evidenceEntityLabels: Record<AiEvidence["entityType"], string> = {
  Incident: "Sự cố",
  Task: "Nhiệm vụ",
  Team: "Đội cứu hộ",
  Shelter: "Điểm sơ tán",
  Evacuation: "Hoạt động sơ tán",
  SOS: "Yêu cầu SOS",
  ReliefRequest: "Yêu cầu cứu trợ",
  Warehouse: "Kho vật tư",
  Inventory: "Tồn kho",
  Shipment: "Chuyến hàng",
  Playbook: "Kế hoạch ứng phó",
  PlaybookExecution: "Đợt thực hiện kế hoạch ứng phó",
  DamageAssessment: "Đánh giá thiệt hại",
  Recovery: "Dự án phục hồi",
  Simulation: "Mô phỏng",
  Analytics: "Số liệu phân tích",
  OperationalAlert: "Cảnh báo tác nghiệp",
};

function EvidenceCard({
  evidence,
  navigate,
}: {
  evidence: AiEvidence;
  navigate: (path: string) => void;
}) {
  const path: Partial<Record<AiEvidence["entityType"], string>> = {
    Incident: "/incidents/",
    Task: "/tasks/",
    Team: "/teams/",
    Shelter: "/shelters/",
    SOS: "/sos/",
    ReliefRequest: "/relief/requests/",
    Warehouse: "/relief/warehouses/",
    Recovery: "/recovery/projects/",
  };
  return (
    <article className="ai-evidence-card">
      <div>
        <Badge tone={evidence.valueKind === "recorded" ? "green" : "blue"}>
          {evidence.valueKind === "recorded" ? "Đã ghi nhận" : "Dẫn xuất"}
        </Badge>
        <small>{evidence.id}</small>
      </div>
      <h3>
        {evidenceEntityLabels[evidence.entityType]} · {evidence.entityId}
      </h3>
      <dl>
        <dt>Thông tin</dt>
        <dd>{evidenceFieldLabels[evidence.field] ?? "Dữ liệu liên quan"}</dd>
        <dt>Giá trị</dt>
        <dd>{evidence.value}</dd>
        <dt>Nguồn</dt>
        <dd>{evidence.source}</dd>
        {evidence.timestamp && (
          <>
            <dt>Thời điểm</dt>
            <dd>{evidence.timestamp}</dd>
          </>
        )}
      </dl>
      {path[evidence.entityType] && evidence.entityId !== "TỔNG-HỢP" && (
        <button
          onClick={() =>
            navigate(`${path[evidence.entityType]}${evidence.entityId}`)
          }
        >
          Mở thực thể
          <ExternalLink size={13} />
        </button>
      )}
    </article>
  );
}
