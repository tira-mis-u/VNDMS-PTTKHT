import { useMemo } from "react";
import { Maximize2 } from "lucide-react";
import { UnifiedMapCanvas } from "@/features/operational-map/components/UnifiedMapCanvas";
import {
  getUnifiedMapPoints,
  getUnifiedMapRoutes,
  type UnifiedMapKind,
} from "@/application/map/unifiedMapQueries";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { OPERATIONAL_MAP_WORKSPACE_PATH } from "@/app/routes/router";

/**
 * BẢN ĐỒ TRONG TRUNG TÂM ĐIỀU HÀNH
 * ─────────────────────────────────────────────────────────────────────────
 * Trước đây đây là một bản đồ **riêng** (640 dòng): ký hiệu khác, bộ lọc lớp
 * khác, popup khác và chỉ hiển thị 5 loại đối tượng — trong khi "Bản đồ tác
 * nghiệp" hiển thị 9 loại kèm bão, gió, nhiệt độ. Hai bản đồ khác nhau trong
 * cùng một hệ thống nghĩa là hai "sự thật" khác nhau về cùng một tình huống:
 * người trực nhìn bản đồ nhỏ tưởng đã thấy hết, thực ra thiếu tuyến sơ tán,
 * kho vật tư, dự án phục hồi và toàn bộ lớp khí tượng.
 *
 * Nay Trung tâm điều hành nhúng CHÍNH bản đồ tác nghiệp ở chế độ gọn: cùng
 * một thành phần, cùng ký hiệu, cùng dữ liệu — chỉ bỏ thanh mốc dự báo và bộ
 * lọc (dành cho màn hình đầy đủ). Bấm "Mở bản đồ đầy đủ" để sang trang chính.
 */
export function CommandCenterMap({
  onNavigate,
}: {
  onNavigate: (path: string) => void;
}) {
  const store = useOperationalState();
  const {
    incidents,
    sosRequests,
    tasks,
    teams,
    shelters,
    evacuationOperations,
    reliefRequests,
    warehouses,
    recoveryProjects,
  } = store;

  const points = useMemo(
    () => getUnifiedMapPoints(store),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      incidents,
      sosRequests,
      tasks,
      teams,
      shelters,
      evacuationOperations,
      reliefRequests,
      warehouses,
      recoveryProjects,
    ],
  );
  const routes = useMemo(
    () => getUnifiedMapRoutes(store),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [evacuationOperations],
  );

  const detailPath = (ref: { kind: UnifiedMapKind; id: string }) => {
    switch (ref.kind) {
      case "incident":
        return `/incidents/${ref.id}`;
      case "sos":
        return `/sos/${ref.id}`;
      case "task":
        return `/tasks/${ref.id}`;
      case "team":
        return `/teams/${ref.id}`;
      case "shelter":
        return "/shelters";
      case "evacuation":
        return "/evacuations";
      case "relief":
        return `/relief/requests/${ref.id}`;
      case "warehouse":
        return `/relief/warehouses/${ref.id}`;
      default:
        return OPERATIONAL_MAP_WORKSPACE_PATH;
    }
  };

  return (
    <section className="card cc-map-section" aria-label="Bản đồ tình hình">
      <div className="cc-map-head">
        <div>
          <b>Bản đồ tình hình</b>
          <small>
            {points.length} đối tượng trong phạm vi quyền · cùng nguồn và cùng ký hiệu với Bản đồ
            tác nghiệp
          </small>
        </div>
        <button type="button" onClick={() => onNavigate(OPERATIONAL_MAP_WORKSPACE_PATH)}>
          <Maximize2 size={14} /> Mở bản đồ đầy đủ
        </button>
      </div>
      <div className="cc-map-frame">
        <UnifiedMapCanvas
          points={points}
          routes={routes}
          focusKey={0}
          focusTarget={null}
          compact
          onSelect={(ref) => onNavigate(detailPath(ref))}
        />
      </div>
    </section>
  );
}
