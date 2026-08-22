import { ArrowLeft, SearchX } from "lucide-react";
import { Button } from "@/components/ui";

export function NotFoundPage({
  navigate,
}: {
  navigate: (path: string) => void;
}) {
  return (
    <div className="workspace-content">
      <div className="empty-state route-state" role="status">
        <SearchX size={28} aria-hidden="true" />
        <h1>Không tìm thấy trang</h1>
        <p>
          Đường dẫn không tồn tại hoặc chức năng đã được chuyển sang địa chỉ
          khác.
        </p>
        <Button onClick={() => navigate("/")}>
          <ArrowLeft size={15} />
          Về Trung tâm điều hành
        </Button>
      </div>
    </div>
  );
}
