import type {
  ResourceAvailability,
  Shelter,
  ShelterAccessibility,
  ShelterReadiness,
} from "../../domain/shelters/types";
import {
  canOpenShelter,
  deriveShelterStatus,
} from "../../domain/shelters/rules";
export interface ShelterResourceInput {
  waterAvailability: ResourceAvailability;
  foodAvailability: ResourceAvailability;
  powerAvailability: ResourceAvailability;
  sanitationStatus: ResourceAvailability;
  readiness: ShelterReadiness;
  accessibility: ShelterAccessibility;
  notes: string;
}
export function updateShelterCapacity(
  shelter: Shelter,
  capacity: number,
  reservedCapacity: number,
  timestamp: string,
): Shelter {
  if (!Number.isInteger(capacity) || capacity <= 0 || reservedCapacity < 0)
    throw new Error("Sức chứa hoặc số chỗ dự phòng không hợp lệ.");
  const next = { ...shelter, capacity, reservedCapacity, updatedAt: timestamp };
  return {
    ...next,
    status: deriveShelterStatus(next, shelter.status, shelter.accessibility),
  };
}
export function updateShelterOccupancy(
  shelter: Shelter,
  occupancy: number,
  timestamp: string,
): Shelter {
  if (!Number.isInteger(occupancy) || occupancy < 0)
    throw new Error("Số người tiếp nhận không hợp lệ.");
  const next = {
    ...shelter,
    currentOccupancy: occupancy,
    updatedAt: timestamp,
  };
  return {
    ...next,
    status: deriveShelterStatus(next, shelter.status, shelter.accessibility),
  };
}
export function openShelter(shelter: Shelter, timestamp: string): Shelter {
  if (!canOpenShelter(shelter.readiness, shelter.accessibility))
    throw new Error("Điểm sơ tán chưa đủ điều kiện để mở tiếp nhận.");
  const base = {
    ...shelter,
    status: "Sẵn sàng" as const,
    openingTime: shelter.openingTime ?? timestamp,
    closingTime: null,
    updatedAt: timestamp,
  };
  return {
    ...base,
    status: deriveShelterStatus(base, base.status, base.accessibility),
  };
}
export function closeShelter(shelter: Shelter, timestamp: string): Shelter {
  if (shelter.activeEvacuationOperationIds.length)
    throw new Error("Không thể đóng điểm khi còn hoạt động sơ tán đang mở.");
  return {
    ...shelter,
    status: "Tạm đóng",
    closingTime: timestamp,
    updatedAt: timestamp,
  };
}
export function updateShelterResources(
  shelter: Shelter,
  input: ShelterResourceInput,
  timestamp: string,
): Shelter {
  const next = { ...shelter, ...input, updatedAt: timestamp };
  return {
    ...next,
    status: deriveShelterStatus(next, shelter.status, input.accessibility),
  };
}
