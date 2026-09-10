import { Building2, Home, Waves } from "lucide-react";
import { SectionTabs } from "./SectionTabs";
import { SITUATION_WORKSPACE_PATH } from "@/app/routes/router";

/**
 * Điểm sơ tán là danh mục tra cứu dùng chung (V2 đã gỡ phân hệ Sơ tán).
 * Giữ thanh tab một mục để bố cục trang danh sách không dịch chuyển.
 */
export function ShelterSectionTabs({
  active,
  navigate,
}: {
  active: string;
  navigate: (path: string) => void;
}) {
  return (
    <SectionTabs
      ariaLabel="Danh mục điểm sơ tán"
      active={active}
      navigate={navigate}
      items={[{ label: "Điểm sơ tán", path: "/shelters", icon: Building2 }]}
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
