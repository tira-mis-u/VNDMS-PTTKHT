import { PackageOpen, Truck, Warehouse } from "lucide-react";
import { SectionTabs } from "@/components/navigation/SectionTabs";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { hasPermission } from "@/lib/permissions/permissions";

/**
 * Ba chặng của cùng một chuỗi cung ứng cứu trợ, gộp vào một mục điều hướng
 * "Cứu trợ" thay vì ba mục rời rạc. Tab nào người dùng không có quyền đọc thì
 * tự ẩn (ví dụ thủ kho chỉ thấy Kho & tồn).
 */
export function ReliefSectionTabs({
  active,
  navigate,
}: {
  active: string;
  navigate: (path: string) => void;
}) {
  const store = useOperationalState();
  const role = store.currentUser?.role;
  const openShipments = store.shipments.filter((item) => item.status !== "Hoàn tất").length;

  return (
    <SectionTabs
      ariaLabel="Phân hệ cứu trợ"
      active={active}
      navigate={navigate}
      items={[
        {
          label: "Yêu cầu cứu trợ",
          path: "/relief/requests",
          icon: PackageOpen,
          hidden: !role || !hasPermission(role, "relief_view"),
        },
        {
          label: "Kho & tồn",
          path: "/relief/warehouses",
          icon: Warehouse,
          hidden: !role || !hasPermission(role, "warehouse_view"),
        },
        {
          label: "Chuyến hàng",
          path: "/relief/shipments",
          icon: Truck,
          badge: openShipments,
          hidden: !role || !hasPermission(role, "shipment_view"),
        },
      ]}
    />
  );
}
