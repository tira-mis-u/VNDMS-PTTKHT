import type {
  Shelter,
  ShelterAccessibility,
  ShelterCapacitySnapshot,
  ShelterReadiness,
  ShelterStatus,
} from "./types";

export const shelterOperationalRank: Record<ShelterStatus, number> = {
  "Quá tải": 0,
  "Gần đầy": 1,
  "Không thể tiếp cận": 2,
  "Đang tiếp nhận": 3,
  "Tạm đóng": 4,
  "Sẵn sàng": 5,
};
export function calculateShelterCapacity(
  shelter: Pick<Shelter, "capacity" | "currentOccupancy" | "reservedCapacity">,
): ShelterCapacitySnapshot {
  const availableCapacity = Math.max(
    0,
    shelter.capacity - shelter.currentOccupancy - shelter.reservedCapacity,
  );
  const occupancyPercentage =
    shelter.capacity > 0
      ? Math.round((shelter.currentOccupancy / shelter.capacity) * 100)
      : 0;
  const committedPercentage =
    shelter.capacity > 0
      ? Math.round(
          ((shelter.currentOccupancy + shelter.reservedCapacity) /
            shelter.capacity) *
            100,
        )
      : 0;
  return {
    availableCapacity,
    occupancyPercentage,
    isNearCapacity:
      committedPercentage >= 85 && shelter.currentOccupancy < shelter.capacity,
    isOverloaded: shelter.currentOccupancy >= shelter.capacity,
  };
}
export function deriveShelterStatus(
  input: Pick<Shelter, "capacity" | "currentOccupancy" | "reservedCapacity">,
  currentStatus: ShelterStatus,
  accessibility: ShelterAccessibility,
): ShelterStatus {
  if (currentStatus === "Tạm đóng") return "Tạm đóng";
  if (accessibility === "Không thể tiếp cận") return "Không thể tiếp cận";
  const capacity = calculateShelterCapacity(input);
  if (capacity.isOverloaded) return "Quá tải";
  if (capacity.isNearCapacity) return "Gần đầy";
  return input.currentOccupancy > 0 ? "Đang tiếp nhận" : "Sẵn sàng";
}
export function assertShelterCanReceive(shelter: Shelter, people: number) {
  const capacity = calculateShelterCapacity(shelter);
  if (shelter.status === "Tạm đóng" || shelter.readiness === "Không sẵn sàng")
    throw new Error(`Điểm sơ tán ${shelter.id} hiện không mở tiếp nhận.`);
  if (shelter.accessibility === "Không thể tiếp cận")
    throw new Error(`Không thể tiếp cận điểm sơ tán ${shelter.id}.`);
  if (people <= 0) throw new Error("Số người sơ tán phải lớn hơn 0.");
  if (people > capacity.availableCapacity)
    throw new Error(`Điểm sơ tán ${shelter.id} không đủ sức chứa khả dụng.`);
}
export function canOpenShelter(
  readiness: ShelterReadiness,
  accessibility: ShelterAccessibility,
) {
  return (
    readiness !== "Không sẵn sàng" && accessibility !== "Không thể tiếp cận"
  );
}
