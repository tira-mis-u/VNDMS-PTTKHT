import { Building2, ClipboardCheck, Boxes, Home, Truck, Waves } from "lucide-react";
import { SectionTabs } from "./SectionTabs";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { hasPermission } from "@/lib/permissions/permissions";
import {
  RECONSTRUCTION_WORKSPACE_PATH,
  SITUATION_WORKSPACE_PATH,
} from "@/app/routes/router";

/** Sơ tán ↔ Điểm sơ tán: lập lệnh sơ tán luôn cần sức chứa còn trống của điểm đến. */
export function EvacuationSectionTabs({
  active,
  navigate,
}: {
  active: string;
  navigate: (path: string) => void;
}) {
  const role = useOperationalState().currentUser?.role;
  return (
    <SectionTabs
      ariaLabel="Phân hệ sơ tán"
      active={active}
      navigate={navigate}
      items={[
        {
          label: "Hoạt động sơ tán",
          path: "/evacuations",
          icon: Truck,
          hidden: !role || !hasPermission(role, "evacuation_view"),
        },
        {
          label: "Điểm sơ tán",
          path: "/shelters",
          icon: Building2,
          hidden: !role || !hasPermission(role, "shelter_view"),
        },
      ]}
    />
  );
}

/** Thẩm định thiệt hại ↔ Dự án tái thiết: hai chặng của cùng một hồ sơ khắc phục. */
export function RecoverySectionTabs({
  active,
  navigate,
}: {
  active: string;
  navigate: (path: string) => void;
}) {
  const role = useOperationalState().currentUser?.role;
  return (
    <SectionTabs
      ariaLabel="Phân hệ phục hồi"
      active={active}
      navigate={navigate}
      items={[
        {
          label: "Đánh giá thiệt hại",
          path: "/recovery",
          icon: ClipboardCheck,
          hidden: !role || !hasPermission(role, "damage_assessment_view"),
        },
        {
          label: "Dự án tái thiết",
          path: RECONSTRUCTION_WORKSPACE_PATH,
          icon: Boxes,
          hidden: !role || !hasPermission(role, "recovery_project_view"),
        },
      ]}
    />
  );
}

/** Trung tâm điều hành ↔ Tình hình thiên tai (khí tượng – thuỷ văn – sự kiện). */
export function CommandSectionTabs({
  active,
  navigate,
}: {
  active: string;
  navigate: (path: string) => void;
}) {
  return (
    <SectionTabs
      ariaLabel="Phân hệ điều hành"
      active={active}
      navigate={navigate}
      items={[
        { label: "Chỉ huy", path: "/", icon: Home },
        { label: "Tình hình thiên tai", path: SITUATION_WORKSPACE_PATH, icon: Waves },
      ]}
    />
  );
}
