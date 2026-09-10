import { useMemo, useState } from "react";
import { FileText, Printer, ShieldCheck } from "lucide-react";
import {
  buildOperationalReport,
  type AnalyticsData,
} from "@/application/analytics/analyticsQueries";
import type {
  AnalyticsPeriod,
  OperationalReportType,
} from "@/domain/analytics/types";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { personName } from "@/data/identity/personnel";
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
  "Báo cáo SOS",
  "Báo cáo phản ánh",
];

/** "ngày 05 tháng 09 năm 2026" — dùng cho quốc hiệu và khối ký của bản in. */
function printDate(now = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `ngày ${pad(now.getDate())} tháng ${pad(now.getMonth() + 1)} năm ${now.getFullYear()}`;
}

export function OperationalReportsPage({
  navigate,
}: {
  navigate: (path: string) => void;
}) {
  const store = useOperationalState();
  const [type, setType] = useState<OperationalReportType>(types[0]);
  const [filter, setFilter] = useState<AnalyticsPeriod>({
    geographicScope: "Toàn bộ Hà Nội",
    referenceTime: store.metadata.asOf,
  });
  const actorId = store.currentUser!.id;
  const report = useMemo(
    () =>
      buildOperationalReport(store as AnalyticsData, type, filter, {
        id: actorId,
        displayName: personName(actorId),
      }),
    [store, type, filter, actorId],
  );

  /**
   * Mở màn hình in của trình duyệt. Trước khi in, đặt document.title theo tên
   * báo cáo để tên tệp PDF mặc định là tên văn bản, sau đó trả lại tiêu đề cũ.
   * Bố cục khổ A4, khối ký và chân trang do stylesheet `@media print` dựng.
   */
  const handlePrint = () => {
    const previousTitle = document.title;
    document.title = `${report.title} — ${printDate()}`;
    const restore = () => {
      document.title = previousTitle;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    window.print();
    // Safari/Firefox không phát afterprint nhất quán: khôi phục sau nhịp in.
    window.setTimeout(restore, 1500);
  };

  return (
    <main className="analytics-page reports-page">
      <AnalyticsHeader
        active="/analytics/reports"
        navigate={navigate}
        title="Báo cáo tác nghiệp"
        description="Bản tổng hợp có truy vết từ dữ liệu vận hành hiện tại; chưa phải văn bản đã ký hoặc phê duyệt."
        actions={
          <div className="report-actions">
            <button
              className="analytics-primary"
              onClick={handlePrint}
              title="Mở màn hình in với đầy đủ bố cục văn bản báo cáo khổ A4"
            >
              <Printer size={14} />
              In báo cáo
            </button>
          </div>
        }
      />

      <section className="report-builder no-print" aria-label="Thiết lập báo cáo">
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
        asOf={store.metadata.asOf}
        source={store.metadata.source}
        />
      </section>

      {report.audit.invalidTimestamps.length > 0 && (
        <div className="report-data-warning" role="status">
          Có {report.audit.invalidTimestamps.length} bản ghi có dấu thời gian không hợp lệ đã bị loại khỏi kỳ báo cáo; hệ thống không tự sửa dữ liệu.
        </div>
      )}

      <article className="operational-report" aria-label={report.title}>
        {/* Quốc hiệu — tiêu ngữ: chỉ hiển thị trên bản in */}
        <div className="report-national-heading print-only" aria-hidden="true">
          <section>
            <b>Ban chỉ huy PCTT &amp; TKCN</b>
            <em>Thành phố Hà Nội</em>
            <i />
            <span>Số: ......./BC-BCH</span>
          </section>
          <section>
            <b>Cộng hòa xã hội chủ nghĩa Việt Nam</b>
            <em>Độc lập - Tự do - Hạnh phúc</em>
            <i />
            <span>{printDate()}</span>
          </section>
        </div>

        <header className="report-cover">
          <div className="report-official-head">
            <div className="report-agency">
              <b>BAN CHỈ HUY PHÒNG, CHỐNG THIÊN TAI</b>
              <span>VÀ TÌM KIẾM CỨU NẠN THÀNH PHỐ HÀ NỘI</span>
            </div>
            <div className="report-document-state">
              <span>BẢN TỔNG HỢP TỪ DỮ LIỆU VẬN HÀNH HIỆN TẠI</span>
              <b>Chưa cấp số · Chưa phê duyệt</b>
            </div>
          </div>
          <h1>{report.title}</h1>
          <p className="report-subject">
            Tình hình và kết quả công tác ứng phó trong phạm vi được phân quyền
          </p>
          <dl className="report-metadata-grid">
            <ReportMeta label="Mã báo cáo" value="Chưa cấp số" />
            <ReportMeta label="Thời điểm lập" value={report.audit.generatedAt} />
            <ReportMeta label="Mốc dữ liệu" value={store.metadata.asOf} />
            <ReportMeta label="Người lập" value={`${report.audit.generatedBy} · ${report.audit.generatedById}`} />
            <ReportMeta label="Kỳ báo cáo" value={report.period} />
            <ReportMeta label="Phạm vi địa bàn" value={report.scope} />
            <ReportMeta label="Phạm vi sự cố" value={report.incidentScope} />
            <ReportMeta
              label="Trạng thái"
              value="Bản tổng hợp tự động, chưa phê duyệt"
            />
            <ReportMeta label="Nguồn dữ liệu" value={report.audit.source} />
          </dl>
        </header>

        <ReportSection number="01" title="Tóm tắt tình hình">
          <p className="report-summary">{report.situationSummary}</p>
          <div className="report-kpi-grid">
            {report.responseStatistics.map((item) => (
              <div key={item.label}>
                <span>{item.label}</span>
                <b>{item.value}</b>
                <Basis value={item.basis} />
              </div>
            ))}
          </div>
        </ReportSection>

        <ReportSection number="02" title="Tình hình chi tiết">
          <div
            className="report-table-wrap"
            role="region"
            aria-label="Bảng tình hình chi tiết"
            tabIndex={0}
          >
            <table className="report-table">
              <thead>
                <tr>
                  <th>Nội dung theo dõi</th>
                  <th>Kết quả hiện tại</th>
                  <th>Cơ sở dữ liệu</th>
                </tr>
              </thead>
              <tbody>
                {report.responseStatistics.map((item) => (
                  <tr key={item.label}>
                    <td>{item.label}</td>
                    <td>{item.value}</td>
                    <td>{item.basis}</td>
                  </tr>
                ))}
                {report.resourceUtilization.map((item, index) => (
                  <tr key={item}>
                    <td>Nguồn lực và năng lực {index + 1}</td>
                    <td>{item}</td>
                    <td>Ghi nhận và dẫn xuất</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ReportSection>

        <ReportSection number="03" title="Vấn đề cần chỉ đạo">
          {report.majorExceptions.length ? (
            <div
              className="report-table-wrap"
              role="region"
              aria-label="Bảng vấn đề cần chỉ đạo"
              tabIndex={0}
            >
              <table className="report-table report-issue-table">
                <thead>
                  <tr>
                    <th>Mức độ</th>
                    <th>Vấn đề</th>
                    <th>Phân hệ phụ trách</th>
                    <th>Trạng thái theo dõi</th>
                    <th>Hồ sơ</th>
                  </tr>
                </thead>
                <tbody>
                  {report.majorExceptions.slice(0, 10).map((item) => (
                    <tr key={`${item.module}-${item.entityId}`}>
                      <td><StatusPill value={item.severity} /></td>
                      <td>
                        <b>{item.entityCode} · {item.title}</b>
                        <span>{item.reason}</span>
                      </td>
                      <td>{item.module}</td>
                      <td>Cần theo dõi</td>
                      <td>
                        <EntityLink path={item.path} navigate={navigate}>
                          Mở hồ sơ
                        </EntityLink>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>Không ghi nhận vấn đề trọng yếu trong kỳ báo cáo.</p>
          )}
        </ReportSection>

        <ReportSection number="04" title="Tình trạng hành động">
          <div className="report-action-columns">
            <div>
              <h3>Đã hoàn thành</h3>
              <ul>
                {report.completedActions.length ? (
                  report.completedActions.map((item) => <li key={item}>{item}</li>)
                ) : (
                  <li>Chưa có hành động hoàn thành trong phạm vi.</li>
                )}
              </ul>
            </div>
            <div>
              <h3>Đang tồn tại</h3>
              <ul>
                {report.outstandingActions.length ? (
                  report.outstandingActions.map((item) => <li key={item}>{item}</li>)
                ) : (
                  <li>Không còn hành động tồn.</li>
                )}
              </ul>
            </div>
          </div>
        </ReportSection>

        <ReportSection number="05" title="Kiến nghị và đề xuất">
          <div className="report-recommendations">
            {report.findings.map((item, index) => (
              <div key={item}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>{item}</p>
                <small>Chưa có quyết định xử lý trong dữ liệu hiện tại</small>
              </div>
            ))}
          </div>
        </ReportSection>

        <ReportSection number="06" title="Kết quả chờ xác nhận">
          <ul className="report-recovery-list">
            {report.pendingConfirmation.length ? (
              report.pendingConfirmation.map((item) => <li key={item}>{item}</li>)
            ) : (
              <li>Không có kết quả nào đang chờ cán bộ xác nhận.</li>
            )}
          </ul>
        </ReportSection>

        <footer className="report-audit">
          <ShieldCheck size={18} aria-hidden="true" />
          <div>
            <b>Thông tin nguồn và đối soát</b>
            <span>Người lập: {report.audit.generatedBy}</span>
            <span>Thời gian cập nhật: {report.audit.generatedAt}</span>
            <span>Nguồn: {report.audit.source}</span>
            <p>{report.audit.dataPolicy}</p>
            <p>
              Báo cáo này là bản tổng hợp chỉ đọc; hệ thống hiện không có quy
              trình ký hoặc phê duyệt báo cáo.
            </p>
          </div>
        </footer>

        {/* Nơi nhận & khối ký: chỉ in ra giấy, không chiếm chỗ trên màn hình */}
        <div className="report-signature-block print-only">
          <section className="recipients">
            <b>Nơi nhận:</b>
            <ul>
              <li>Thường trực Ban chỉ huy PCTT &amp; TKCN Thành phố;</li>
              <li>Các thành viên Ban chỉ huy;</li>
              <li>Ban chỉ huy PCTT &amp; TKCN các quận, huyện, thị xã;</li>
              <li>Lưu: Văn phòng thường trực, hồ sơ tác nghiệp.</li>
            </ul>
          </section>
          <section className="signer">
            <span className="place-date">Hà Nội, {printDate()}</span>
            <b>TM. Ban chỉ huy</b>
            <span>Trưởng ban</span>
            <span className="sign-space" />
            <b>{report.audit.generatedBy}</b>
          </section>
        </div>

        <p className="report-print-footnote print-only">
          Bản in kết xuất từ Hệ thống VNDMS lúc {report.audit.generatedAt} · Mốc dữ liệu {store.metadata.asOf} ·
          Người kết xuất: {report.audit.generatedBy} ({report.audit.generatedById}) · Văn bản chưa cấp số, chưa ký duyệt.
        </p>
      </article>
    </main>
  );
}

function ReportMeta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function ReportSection({
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
