import { OperationalMapExplorer } from "../components/OperationalMapExplorer";

/**
 * Trang Bản đồ tác nghiệp nội bộ — wrapper mỏng trên OperationalMapExplorer
 * (bản đồ dùng chung với Cổng công dân, dữ liệu đã lọc theo quyền).
 */
export function OperationalMapWorkspacePage({
  navigate,
  focus,
}: {
  navigate: (path: string) => void;
  focus: string | null;
}) {
  return <OperationalMapExplorer navigate={navigate} focus={focus} />;
}
