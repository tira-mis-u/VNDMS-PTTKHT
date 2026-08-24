import { DatabaseZap, Settings } from "lucide-react";
import { PageSectionHeader } from "@/components/ui";

export function SystemConfigurationBlockedPage() {
  return (
    <main className="workspace-content insights-page">
      <PageSectionHeader section="Quản trị" title="Cấu hình" description="Trạng thái khả dụng của chức năng cấu hình hệ thống." icon={Settings} />
      <section className="insights-unavailable configuration-blocked" role="status">
        <DatabaseZap size={22} />
        <div><h2>Cấu hình hệ thống chưa được cung cấp trong môi trường này</h2><p>Chưa có hợp đồng cấu hình và lưu trữ tương ứng.</p><small>Không có biểu mẫu lưu giả, dữ liệu trình duyệt hoặc thao tác cập nhật trong trang này.</small></div>
      </section>
    </main>
  );
}
