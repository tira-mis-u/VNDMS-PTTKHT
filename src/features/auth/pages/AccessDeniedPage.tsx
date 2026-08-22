import { ArrowLeft, ShieldX } from "lucide-react";
export function AccessDeniedPage({
  navigate,
  reason = "Bạn không có quyền truy cập chức năng này.",
}: {
  navigate: (path: string) => void;
  reason?: string;
}) {
  return (
    <main className="access-denied-page">
      <ShieldX size={28} />
      <h1>Không được phép truy cập</h1>
      <p>{reason}</p>
      <button onClick={() => navigate("/")}>
        <ArrowLeft size={15} />
        Về Trung tâm điều hành
      </button>
    </main>
  );
}
