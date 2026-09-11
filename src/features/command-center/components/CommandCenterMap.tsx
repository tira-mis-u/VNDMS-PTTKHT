import { MapPinned } from "lucide-react";
import { getUnifiedMapPoints } from "@/application/map/unifiedMapQueries";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { OPERATIONAL_MAP_WORKSPACE_PATH } from "@/app/routes/router";

/**
 * THẺ MỞ BẢN ĐỒ (thay cho bản đồ mini nhúng trong trang Chỉ huy)
 * ─────────────────────────────────────────────────────────────────────────
 * Trang Chỉ huy trả lời "cần làm gì ngay" — bản đồ mini vừa nặng vừa thiếu
 * lớp khí tượng, lại trùng với mục sidebar "Bản đồ tác nghiệp" (1 bản đồ, 1
 * nơi duy nhất). Thẻ gọn này giữ lối vào 1 chạm + đếm điểm đang hiển thị.
 */
export function CommandCenterMap({
  onNavigate,
}: {
  onNavigate: (path: string) => void;
}) {
  const store = useOperationalState();
  const points = getUnifiedMapPoints(store);
  return (
    <button
      type="button"
      className="cc-map-link-card"
      onClick={() => onNavigate(OPERATIONAL_MAP_WORKSPACE_PATH)}
      aria-label="Mở bản đồ tác nghiệp đầy đủ"
    >
      <MapPinned size={18} />
      <span>
        <b>Mở bản đồ tác nghiệp</b>
        <small>{points.length} điểm SOS · sự cố · nhiệm vụ · đội · điểm sơ tán</small>
      </span>
    </button>
  );
}
