import { AlertTriangle } from "lucide-react";
import { getSituationSummary } from "@/application/command-center/commandCenterQueries";
import { useOperationalState } from "@/state/operations/OperationalStateContext";

export function SituationSummary() {
  const store = useOperationalState();
  const situation = getSituationSummary(store);
  return (
    <section className="cc-situation" aria-labelledby="situation-title">
      <div className="cc-situation-context">
        <span className="cc-situation-icon">
          <AlertTriangle size={19} />
        </span>
        <div>
          <span className="cc-kicker">Tình hình hiện tại</span>
          <div className="cc-level">
            <h2 id="situation-title">
              Mức độ tình hình: <b>{situation.level}</b>
            </h2>
            <span>Đang theo dõi sát</span>
          </div>
          <p>{situation.description}</p>
        </div>
      </div>
      <div className="cc-summary-metrics">
        {situation.metrics.map((metric) => (
          <div key={metric.label}>
            <strong className={metric.tone === "red" ? "cc-danger-text" : ""}>
              {metric.value}
            </strong>
            <span>{metric.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
