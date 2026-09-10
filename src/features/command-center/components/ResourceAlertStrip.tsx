import { ChevronRight, TriangleAlert } from "lucide-react";
import { getCommandCenterResourceExceptions } from "@/application/command-center/commandCenterQueries";
import { useOperationalState } from "@/state/operations/OperationalStateContext";

/**
 * DẢI CẢNH BÁO NGUỒN LỰC (thay cho bảng "Nguồn lực cần chú ý" cũ)
 * ─────────────────────────────────────────────────────────────────────────
 * Bảng cũ chiếm nguyên một cột với thanh tiến độ cho từng kho/đội/điểm sơ tán
 * — phần lớn là tra cứu, không phải việc phải làm ngay. Ở phòng chỉ huy chỉ
 * cần biết: hiện có mấy nguồn lực vượt ngưỡng và ba cái nặng nhất là gì; muốn
 * xem chi tiết thì bấm sang trang chuyên môn.
 */
export function ResourceAlertStrip({ onNavigate }: { onNavigate: (path: string) => void }) {
  const store = useOperationalState();
  const items = getCommandCenterResourceExceptions(store);
  if (!items.length) return null;

  const go = (item: (typeof items)[number]) => {
    if (item.kind === "sos") onNavigate(`/sos/${item.id}`);
    else if (item.kind === "shelter") onNavigate("/shelters");
    else onNavigate(`/teams/${item.id}`);
  };

  return (
    <section className="cc-resource-strip" aria-label="Cảnh báo nguồn lực">
      <span className="cc-resource-strip-title">
        <TriangleAlert size={14} />
        Nguồn lực vượt ngưỡng
        <b>{items.length}</b>
      </span>
      <div className="cc-resource-strip-items">
        {items.slice(0, 3).map((item) => (
          <button
            key={`${item.kind}-${item.id}-${item.name}`}
            className={`cc-resource-chip tone-${item.tone}`}
            onClick={() => go(item)}
            title={`${item.owner} · ${item.state}`}
          >
            <b>{item.name}</b>
            <span>{item.display}</span>
          </button>
        ))}
        {items.length > 3 && (
          <button className="cc-resource-more" onClick={() => onNavigate("/teams")}>
            +{items.length - 3} mục khác <ChevronRight size={13} />
          </button>
        )}
      </div>
    </section>
  );
}
