import { useMemo, useState } from "react";
import { FileDown, FileText, Printer, ShieldCheck } from "lucide-react";
import {
  buildOperationalReport,
  type AnalyticsData,
} from "@/application/analytics/analyticsQueries";
import type {
  AnalyticsPeriod,
  OperationalReportType,
} from "@/domain/analytics/types";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import {
  AnalyticsFilters,
  AnalyticsHeader,
  Basis,
  EntityLink,
  StatusPill,
} from "../components/AnalyticsCommon";
const types: OperationalReportType[] = [
  "Báo cáo tình hình tác chiến",
  "Báo cáo sự cố",
  "Báo cáo cứu hộ",
  "Báo cáo sơ tán",
  "Báo cáo cứu trợ",
  "Báo cáo phục hồi",
];
export function OperationalReportsPage({
  navigate,
}: {
  navigate: (path: string) => void;
}) {
  const store = useOperationalState();
  const [type, setType] = useState<OperationalReportType>(types[0]);
  const [filter, setFilter] = useState<AnalyticsPeriod>({
    geographicScope: "Toàn bộ Hà Nội",
    referenceTime: "21/08/2026 10:45",
  });
  const report = useMemo(
    () => buildOperationalReport(store as AnalyticsData, type, filter),
    [store, type, filter],
  );
  return (
    <main className="analytics-page reports-page">
      <AnalyticsHeader
        active="/analytics/reports"
        navigate={navigate}
        title="Báo cáo tác nghiệp"
        description="Lập báo cáo có truy vết, tối ưu cho in/PDF từ trình duyệt; export adapter được cô lập để mở rộng sau."
        actions={
          <div className="report-actions">
            <button
              className="analytics-secondary"
              disabled
              title="Ranh giới export dự kiến cho phiên bản sau"
            >
              <FileDown size={14} />
              Xuất tệp
            </button>
            <button
              className="analytics-primary"
              onClick={() => window.print()}
            >
              <Printer size={14} />
              In / Lưu PDF
            </button>
          </div>
        }
      />
      <div className="report-builder no-print">
        <div className="report-types">
          <span>Loại báo cáo</span>
          {types.map((item) => (
            <button
              key={item}
              className={type === item ? "active" : ""}
              onClick={() => setType(item)}
            >
              <FileText size={15} />
              {item}
            </button>
          ))}
        </div>
        <AnalyticsFilters
          value={filter}
          onChange={setFilter}
          incidents={store.incidents}
        />
      </div>
      <article className="operational-report">
        <header className="report-cover">
          <div className="report-masthead">
            <b className="report-nation">
              CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
            </b>
            <span className="report-motto">Độc lập - Tự do - Hạnh phúc</span>
            <small className="report-system">
              Hệ thống quản lý, giám sát và phòng chống thiên tai — VNDMS
            </small>
          </div>
          <h1>{report.title}</h1>
          <dl>
            <div>
              <dt>Kỳ báo cáo</dt>
              <dd>{report.period}</dd>
            </div>
            <div>
              <dt>Phạm vi địa lý</dt>
              <dd>{report.scope}</dd>
            </div>
            <div>
              <dt>Phạm vi sự cố</dt>
              <dd>{report.incidentScope}</dd>
            </div>
          </dl>
        </header>
        <ReportBlock number="01" title="Tóm tắt tình hình">
          <p className="report-summary">{report.situationSummary}</p>
        </ReportBlock>
        <div className="report-columns">
          <ReportBlock number="02" title="Phát hiện tác nghiệp chính">
            <ol>
              {report.findings.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </ReportBlock>
          <ReportBlock number="03" title="Thống kê đáp ứng">
            <div className="report-stat-list">
              {report.responseStatistics.map((item) => (
                <div key={item.label}>
                  <span>
                    {item.label}
                    <Basis value={item.basis} />
                  </span>
                  <b>{item.value}</b>
                </div>
              ))}
            </div>
          </ReportBlock>
        </div>
        <ReportBlock number="04" title="Sử dụng nguồn lực">
          <ul>
            {report.resourceUtilization.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </ReportBlock>
        <ReportBlock number="05" title="Ngoại lệ trọng yếu">
          <div className="report-exceptions">
            {report.majorExceptions.slice(0, 10).map((item) => (
              <div key={`${item.module}-${item.entityId}`}>
                <StatusPill value={item.severity} />
                <div>
                  <b>
                    {item.entityCode} · {item.title}
                  </b>
                  <p>{item.reason}</p>
                </div>
                <EntityLink path={item.path} navigate={navigate}>
                  Mở hồ sơ
                </EntityLink>
              </div>
            ))}
            {!report.majorExceptions.length && (
              <p>Không ghi nhận ngoại lệ trọng yếu trong kỳ.</p>
            )}
          </div>
        </ReportBlock>
        <div className="report-columns">
          <ReportBlock number="06" title="Hành động đã hoàn thành">
            <ul>
              {report.completedActions.length ? (
                report.completedActions.map((item) => (
                  <li key={item}>{item}</li>
                ))
              ) : (
                <li>Chưa có hành động hoàn thành trong phạm vi.</li>
              )}
            </ul>
          </ReportBlock>
          <ReportBlock number="07" title="Hành động còn tồn">
            <ul>
              {report.outstandingActions.length ? (
                report.outstandingActions.map((item) => (
                  <li key={item}>{item}</li>
                ))
              ) : (
                <li>Không còn hành động tồn.</li>
              )}
            </ul>
          </ReportBlock>
        </div>
        <ReportBlock number="08" title="Tình trạng phục hồi">
          <ul>
            {report.recoveryStatus.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </ReportBlock>
        <footer className="report-audit">
          <ShieldCheck size={18} />
          <div>
            <b>Thông tin kiểm toán báo cáo</b>
            <span>
              Tạo lúc {report.audit.generatedAt} · Người lập:{" "}
              {report.audit.generatedBy}
            </span>
            <span>Nguồn: {report.audit.source}</span>
            <p>{report.audit.dataPolicy}</p>
          </div>
        </footer>
      </article>
    </main>
  );
}
function ReportBlock({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="report-block">
      <h2>
        <span>{number}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}
