import { Archive, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui";
import { findNavigationItem } from "@/components/navigation/navigationConfig";
export function PlaceholderPage({ title }: { title: string }) {
  const navigation = findNavigationItem(title);
  const Icon = navigation?.item.icon ?? Archive;
  return (
    <div className="workspace-content">
      <div className="page-header">
        <div>
          <div className="breadcrumbs">
            <span>{navigation?.group.label ?? "VNDMS"}</span>
            <ChevronRight size={13} />
            <b>{title}</b>
          </div>
          <h1>{title}</h1>
          <p>Không gian nghiệp vụ trong nền tảng quản lý và điều hành</p>
        </div>
      </div>
      <div className="placeholder-page">
        <span>
          <Icon size={24} />
        </span>
        <h2>Module {title} đang được chuẩn bị</h2>
        <p>
          Application shell đã sẵn sàng để phát triển quy trình, dữ liệu và phân
          quyền cho module này ở giai đoạn tiếp theo.
        </p>
        <Button variant="secondary">Xem định hướng module</Button>
      </div>
    </div>
  );
}
