import type { SosRequest } from "../../domain/sos/types";
import {
  calculateShelterCapacity,
  shelterOperationalRank,
} from "../../domain/shelters/rules";
import type { Shelter } from "../../domain/shelters/types";
/**
 * Bộ lọc trang Điểm sơ tán — chỉ giữ các chiều lọc độc lập, không suy ra
 * được từ nhau: trạng thái vận hành (đã bao gồm đầy/còn chỗ, đóng/mở,
 * tiếp cận được hay không), khu vực, năng lực y tế, SOS điều phối.
 * Các dropdown trùng lắp đã bỏ: mức sẵn sàng, sức chứa, mức sử dụng (%),
 * khả năng tiếp cận, còn chỗ (xem lịch sử git).
 */
export interface ShelterFilters {
  search: string;
  status: string;
  area: string;
  medical: string;
  /** SOS đang được điều phối tới điểm (canonical SosRequest.shelterDestinationId). */
  routedSos: string;
  sort: "Ưu tiên vận hành" | "Sức chứa khả dụng" | "Tên A–Z";
}
const OPEN_SOS_EXCLUDED = ["Đã đóng", "Từ chối", "Hủy"];

/** SOS còn mở đang được điều phối tới điểm sơ tán. */
export function routedSosForShelter(sosRequests: SosRequest[], shelterId: string) {
  return sosRequests.filter(
    (item) =>
      item.shelterDestinationId === shelterId &&
      !OPEN_SOS_EXCLUDED.includes(item.status),
  );
}

export function filterAndSortShelters(
  shelters: Shelter[],
  sosRequests: SosRequest[],
  filters: ShelterFilters,
) {
  const hasRouted = (shelterId: string) =>
    routedSosForShelter(sosRequests, shelterId).length > 0;
  return shelters
    .filter((shelter) => {
      const q = filters.search.trim().toLowerCase();
      const active = hasRouted(shelter.id);
      return (
        (!q ||
          `${shelter.id} ${shelter.name} ${shelter.address} ${shelter.responsibleOfficer.name}`
            .toLowerCase()
            .includes(q)) &&
        (filters.status === "Tất cả trạng thái" ||
          shelter.status === filters.status ||
          (filters.status === "Ngưng tiếp nhận" &&
            (shelter.status === "Tạm đóng" ||
              shelter.status === "Không thể tiếp cận"))) &&
        (filters.area === "Tất cả khu vực" ||
          shelter.administrativeArea.startsWith(filters.area)) &&
        (filters.medical === "Tất cả năng lực y tế" ||
          shelter.medicalCapability === filters.medical) &&
        (filters.routedSos === "Tất cả SOS điều phối" ||
          (filters.routedSos === "Có SOS điều phối" ? active : !active))
      );
    })
    .sort((a, b) =>
      filters.sort === "Tên A–Z"
        ? a.name.localeCompare(b.name)
        : filters.sort === "Sức chứa khả dụng"
          ? calculateShelterCapacity(b).availableCapacity -
            calculateShelterCapacity(a).availableCapacity
          : shelterOperationalRank[a.status] -
              shelterOperationalRank[b.status] ||
            Number(hasRouted(b.id)) - Number(hasRouted(a.id)),
    );
}
