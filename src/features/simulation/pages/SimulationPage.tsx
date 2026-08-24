import { PageSectionHeader } from "@/components/ui";
import { Select as UiSelect } from "@/components/ui/Select";
import {
  Activity,
  AlertTriangle,
  Clock3,
  Droplets,
  Gauge,
  MapPin,
  Pause,
  Play,
  RefreshCcw,
  Route,
  SkipForward,
  Waves,
} from "lucide-react";
import type {
  SimulationSpeed,
  SimulationStage,
} from "@/domain/simulation/types";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { SimulationOperationalMap } from "../components/SimulationOperationalMap";
const stages: SimulationStage[] = [
  "Bình thường",
  "Cảnh báo",
  "Nguy hiểm",
  "Ứng phó",
  "Sơ tán",
  "Cứu hộ",
  "Ổn định",
  "Phục hồi",
];
export function SimulationPage({
  navigate,
}: {
  navigate: (path: string) => void;
}) {
  const store = useOperationalState();
  const sim = store.simulation;
  const canControl = store.can("simulation_control");
  if (!store.can("simulation_view"))
    return (
      <main className="simulation-page">
        <div className="simulation-denied">
          <AlertTriangle size={18} />
          <h1>Không có quyền xem mô phỏng</h1>
          <p>Vai trò hiện tại không được cấp quyền xem mô phỏng.</p>
        </div>
      </main>
    );
  const progress = sim.maxTick ? Math.round((sim.tick / sim.maxTick) * 100) : 0;
  return (
    <main className="simulation-page">
      <div className="simulation-banner">
        <AlertTriangle size={15} />
        <b>DỮ LIỆU MÔ PHỎNG</b>
        <span>
          Không phải dữ liệu quan trắc thời gian thực · Mọi thay đổi được áp
          dụng vào kịch bản xác định trước và có thể đặt lại.
        </span>
      </div>
      <PageSectionHeader
        section="Mô phỏng ứng phó thiên tai"
        title="Lũ Sông Hồng — Hà Nội"
        description="Kịch bản tác nghiệp xuyên suốt, đồng bộ thay đổi giữa các phân hệ trên nguồn dữ liệu nghiệp vụ thống nhất của VNDMS."
        icon={Waves}
        className="simulation-header"
        actions={
          <dl>
            <div><dt>Mã kịch bản</dt><dd>20240901</dd></div>
            <div><dt>Trạng thái</dt><dd><Status value={sim.status} /></dd></div>
            <div><dt>Thời gian mô phỏng</dt><dd>{sim.simulationTime}</dd></div>
            <div><dt>Bước mô phỏng</dt><dd>{sim.tick} / {sim.maxTick}</dd></div>
          </dl>
        }
      />
      <section className="simulation-controls">
        <div className="simulation-control-buttons">
          <button
            className="primary"
            onClick={store.playSimulation}
            disabled={
              !canControl ||
              sim.status === "Đang chạy" ||
              sim.status === "Hoàn thành"
            }
          >
            <Play size={15} />
            Chạy
          </button>
          <button
            onClick={store.pauseSimulation}
            disabled={!canControl || sim.status !== "Đang chạy"}
          >
            <Pause size={15} />
            Tạm dừng
          </button>
          <button
            onClick={store.stepSimulation}
            disabled={
              !canControl ||
              sim.status === "Đang chạy" ||
              sim.status === "Hoàn thành"
            }
          >
            <SkipForward size={15} />
            Tiến 1 bước
          </button>
          <button onClick={store.resetSimulation} disabled={!canControl}>
            <RefreshCcw size={15} />
            Đặt lại ban đầu
          </button>
        </div>
        <label>
          Tốc độ
          <UiSelect
            value={sim.speed}
            onChange={(event) =>
              store.setSimulationSpeed(
                Number(event.target.value) as SimulationSpeed,
              )
            }
            disabled={!canControl}
          >
            <option value={0.5}>0,5×</option>
            <option value={1}>1×</option>
            <option value={2}>2×</option>
            <option value={4}>4×</option>
          </UiSelect>
        </label>
        <div className="simulation-progress">
          <span style={{ width: `${progress}%` }} />
          <b>{progress}%</b>
        </div>
      </section>
      <section className="simulation-stage" tabIndex={0} aria-label="Không gian mô phỏng">
        <div>
          {stages.map((stage, index) => {
            const current = stages.indexOf(sim.stage);
            return (
              <div
                key={stage}
                className={`${index < current ? "complete" : ""} ${index === current ? "active" : ""}`}
              >
                <span>{index + 1}</span>
                <b>{stage}</b>
              </div>
            );
          })}
        </div>
      </section>
      <div className="simulation-layout">
        <div>
          <section className="simulation-panel">
            <header>
              <div>
                <h2>Điều kiện kịch bản</h2>
                <p>
                  Các giá trị thủy văn đơn giản hóa, được gắn nhãn mô phỏng.
                </p>
              </div>
              <span className="simulated-tag">Mô phỏng</span>
            </header>
            <div className="simulation-condition-grid">
              <Condition
                icon={<Droplets size={16} />}
                label="Lượng mưa"
                value={`${sim.rainfall} mm/10 phút`}
                note="Giá trị kịch bản"
              />
              <Condition
                icon={<Waves size={16} />}
                label="Mực nước Sông Hồng"
                value={`${sim.riverLevel.toFixed(2)} m`}
                note={`Ngưỡng hiện tại: ${sim.warningLevel}`}
              />
              <Condition
                icon={<Activity size={16} />}
                label="Tốc độ mực nước"
                value={`${sim.riverLevelRate > 0 ? "+" : ""}${sim.riverLevelRate.toFixed(2)} m/bước`}
                note="So với bước trước"
              />
              <Condition
                icon={<Gauge size={16} />}
                label="Mức rủi ro"
                value={sim.riskLevel}
                note={`${sim.affectedAreas.length} khu vực ảnh hưởng`}
              />
              <Condition
                icon={<Route size={16} />}
                label="Đường hạn chế"
                value={String(sim.blockedRoads.length)}
                note={sim.blockedRoads[0] ?? "Chưa ghi nhận"}
              />
              <Condition
                icon={<MapPin size={16} />}
                label="Hiểm họa đang hoạt động"
                value={String(sim.activeHazards.length)}
                note={sim.activeHazards[0] ?? "Mức nền ổn định"}
              />
            </div>
            <div className="simulation-thresholds">
              {sim.thresholds.map((item) => (
                <div
                  key={item.code}
                  className={sim.riverLevel >= item.level ? "exceeded" : ""}
                >
                  <span>{item.code}</span>
                  <b>{item.level.toFixed(1)} m</b>
                  <em>
                    {sim.riverLevel >= item.level ? "Đã vượt" : "Chưa vượt"}
                  </em>
                </div>
              ))}
            </div>
          </section>
          <section className="simulation-panel">
            <header>
              <div>
                <h2>Lan truyền vào hệ thống tác nghiệp</h2>
                <p>
                  Thay đổi đã được áp dụng vào hồ sơ nghiệp vụ chính thức;
                  chọn để mở hồ sơ.
                </p>
              </div>
              <span>{sim.generatedOperationalEvents.length} thay đổi</span>
            </header>
            <div className="simulation-propagation">
              {sim.triggeredEvents
                .filter((item) => item.mutation !== "none")
                .map((item) => (
                  <button
                    key={item.id}
                    onClick={() => item.entityPath && navigate(item.entityPath)}
                    disabled={!item.entityPath}
                  >
                    <span className="propagation-tick">T{item.tick}</span>
                    <div>
                      <b>
                        {item.entityType} · {item.entityId}
                      </b>
                      <p>{item.consequence}</p>
                    </div>
                    <Status value={item.status} />
                  </button>
                ))}
              {!sim.generatedOperationalEvents.length && (
                <p className="simulation-empty">
                  Chưa có thay đổi nghiệp vụ. Chọn “Tiến 1 bước” để bắt đầu kịch bản.
                </p>
              )}
            </div>
          </section>
        </div>
        <section className="simulation-panel map-panel">
          <header>
            <div>
              <h2>Bản đồ kịch bản & tác nghiệp</h2>
              <p>
                Bản đồ tác nghiệp; lớp mô phỏng được phân biệt với điểm dữ liệu nghiệp vụ chính thức.
              </p>
            </div>
            <span className="simulated-tag">Mô phỏng</span>
          </header>
          <SimulationOperationalMap
            simulation={sim}
            incidents={store.incidents}
            teams={store.teams}
            shelters={store.shelters}
            evacuations={store.evacuationOperations}
            sosRequests={store.sosRequests}
          />
        </section>
      </div>
      <section className="simulation-panel log-panel">
        <header>
          <div>
            <h2>Nhật ký sự kiện mô phỏng</h2>
            <p>
              Thứ tự được xác định trước theo từng bước; mã ổn định bảo đảm không lặp tác động.
            </p>
          </div>
          <span>
            <Clock3 size={14} />
            {sim.triggeredEvents.length} sự kiện
          </span>
        </header>
        <div
          className="simulation-log-table"
          tabIndex={0}
          aria-label="Nhật ký sự kiện mô phỏng"
        >
          <table>
            <thead>
              <tr>
                <th>Bước</th>
                <th>Thời gian mô phỏng</th>
                <th>Loại</th>
                <th>Sự kiện & nguyên nhân</th>
                <th>Hệ quả</th>
                <th>Đối tượng</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {sim.triggeredEvents.map((item) => (
                <tr key={item.id}>
                  <td>
                    <b>T{item.tick}</b>
                    <small>{item.id}</small>
                  </td>
                  <td>{item.simulationTime}</td>
                  <td>
                    <span
                      className={`simulation-kind ${item.kind === "Mô phỏng" ? "model" : "mutation"}`}
                    >
                      {item.kind}
                    </span>
                  </td>
                  <td>
                    <b>{item.title}</b>
                    <small>{item.reason}</small>
                  </td>
                  <td>{item.consequence}</td>
                  <td>
                    {item.entityPath ? (
                      <button onClick={() => navigate(item.entityPath!)}>
                        {item.entityId}
                      </button>
                    ) : (
                      (item.entityId ?? "—")
                    )}
                  </td>
                  <td>
                    <Status value={item.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!sim.triggeredEvents.length && (
            <p className="simulation-empty">
              Nhật ký sẽ xuất hiện khi bộ mô phỏng tiến tới bước đầu tiên.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
function Condition({
  icon,
  label,
  value,
  note,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <article className="simulation-condition">
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        <b>{value}</b>
        <p>{note}</p>
      </div>
    </article>
  );
}
function Status({ value }: { value: string }) {
  const tone =
    value === "Đang chạy" || value === "Đã áp dụng"
      ? "green"
      : value === "Tạm dừng"
        ? "amber"
        : value === "Hoàn thành"
          ? "blue"
          : "neutral";
  return <span className={`simulation-status ${tone}`}>{value}</span>;
}
