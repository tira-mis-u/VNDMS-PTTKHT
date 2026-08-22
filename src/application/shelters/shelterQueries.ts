import type { EvacuationOperation } from "../../domain/evacuations/types";
import {
  calculateShelterCapacity,
  shelterOperationalRank,
} from "../../domain/shelters/rules";
import type { Shelter } from "../../domain/shelters/types";
export interface ShelterFilters {
  search: string;
  status: string;
  readiness: string;
  area: string;
  capacity: string;
  occupancy: string;
  accessibility: string;
  medical: string;
  evacuation: string;
  availability: string;
  sort: "Ưu tiên vận hành" | "Sức chứa khả dụng" | "Tên A–Z";
}
export function filterAndSortShelters(
  shelters: Shelter[],
  operations: EvacuationOperation[],
  filters: ShelterFilters,
) {
  return shelters
    .filter((shelter) => {
      const q = filters.search.trim().toLowerCase();
      const capacity = calculateShelterCapacity(shelter);
      const active = operations.some(
        (operation) =>
          operation.destinationShelterId === shelter.id &&
          !["Hoàn thành", "Đã hủy"].includes(operation.status),
      );
      return (
        (!q ||
          `${shelter.id} ${shelter.name} ${shelter.address} ${shelter.responsibleOfficer.name}`
            .toLowerCase()
            .includes(q)) &&
        (filters.status === "Tất cả trạng thái" ||
          shelter.status === filters.status) &&
        (filters.readiness === "Tất cả mức sẵn sàng" ||
          shelter.readiness === filters.readiness) &&
        (filters.area === "Tất cả khu vực" ||
          shelter.administrativeArea.startsWith(filters.area)) &&
        (filters.capacity === "Tất cả sức chứa" ||
          (filters.capacity === "Từ 500 chỗ"
            ? shelter.capacity >= 500
            : shelter.capacity < 500)) &&
        (filters.occupancy === "Tất cả mức sử dụng" ||
          (filters.occupancy === "Từ 85%"
            ? capacity.occupancyPercentage >= 85
            : filters.occupancy === "50–84%"
              ? capacity.occupancyPercentage >= 50 &&
                capacity.occupancyPercentage < 85
              : capacity.occupancyPercentage < 50)) &&
        (filters.accessibility === "Tất cả khả năng tiếp cận" ||
          shelter.accessibility === filters.accessibility) &&
        (filters.medical === "Tất cả năng lực y tế" ||
          shelter.medicalCapability === filters.medical) &&
        (filters.evacuation === "Tất cả hoạt động" ||
          (filters.evacuation === "Có hoạt động" ? active : !active)) &&
        (filters.availability === "Tất cả khả dụng" ||
          (filters.availability === "Còn chỗ"
            ? capacity.availableCapacity > 0
            : capacity.availableCapacity === 0))
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
            Number(
              Boolean(
                operations.some(
                  (op) =>
                    op.destinationShelterId === b.id &&
                    !["Hoàn thành", "Đã hủy"].includes(op.status),
                ),
              ),
            ) -
              Number(
                Boolean(
                  operations.some(
                    (op) =>
                      op.destinationShelterId === a.id &&
                      !["Hoàn thành", "Đã hủy"].includes(op.status),
                  ),
                ),
              ),
    );
}
