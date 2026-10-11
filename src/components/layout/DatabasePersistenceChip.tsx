import { useState, useEffect } from "react";
import { Database, AlertTriangle, CheckCircle2, Copy, Check } from "lucide-react";
import { useOperationalState } from "@/state/operations/OperationalStateContext";

export function DatabasePersistenceChip() {
  const store = useOperationalState();
  const [modalOpen, setModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toastError, setToastError] = useState<string | null>(null);

  useEffect(() => {
    if (store.persistenceError && store.persistenceError.startsWith("Lỗi lưu")) {
      setToastError(store.persistenceError);
      const timer = setTimeout(() => setToastError(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [store.persistenceError]);

  const isLive = store.persistenceMode === "supabase";

  const handleCopyPath = () => {
    navigator.clipboard.writeText("supabase/migrations/20261011_vndms_persistence.sql");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {toastError && (
        <div
          role="alert"
          style={{
            position: "fixed",
            top: "68px",
            right: "24px",
            zIndex: 9999,
            maxWidth: "440px",
            background: "var(--color-surface, #ffffff)",
            border: "1px solid #ef4444",
            borderLeft: "4px solid #ef4444",
            color: "var(--color-text, #1e293b)",
            borderRadius: "8px",
            padding: "12px 16px",
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.15)",
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
          }}
        >
          <AlertTriangle size={18} style={{ color: "#ef4444", flexShrink: 0, marginTop: "2px" }} />
          <div style={{ flex: 1, fontSize: "0.88rem" }}>
            <div style={{ fontWeight: 600, color: "#dc2626" }}>Lỗi lưu trữ Supabase</div>
            <div style={{ marginTop: "3px", color: "var(--color-text-muted, #64748b)" }}>{toastError}</div>
          </div>
          <button
            type="button"
            onClick={() => setToastError(null)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#94a3b8",
              fontSize: "1.1rem",
              lineHeight: 1,
              padding: "0 4px",
            }}
            aria-label="Đóng"
          >
            ×
          </button>
        </div>
      )}
      <button
        type="button"
        className={`data-freshness ${isLive ? "tone-live" : "tone-stale"}`}
        style={{
          cursor: "pointer",
          border: isLive ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(245, 158, 11, 0.4)",
          background: isLive ? "rgba(16, 185, 129, 0.08)" : "rgba(245, 158, 11, 0.12)",
          color: isLive ? "var(--color-success, #10b981)" : "var(--color-warning, #f59e0b)",
        }}
        onClick={() => setModalOpen(true)}
        title={
          isLive
            ? "Cơ sở dữ liệu đám mây: Đã kết nối và đồng bộ."
            : `Cơ sở dữ liệu: ${store.persistenceError ?? "Cần kiểm tra trạng thái cấu trúc dữ liệu"}. Bấm để xem hướng dẫn.`
        }
        role="status"
      >
        {isLive ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
        <span>{isLive ? "CSDL: Đã kết nối" : "CSDL: Cần khởi tạo"}</span>
      </button>

      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
          onClick={() => setModalOpen(false)}
        >
          <div
            style={{
              background: "var(--color-surface, #ffffff)",
              color: "var(--color-text, #1e293b)",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "520px",
              width: "90%",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <Database size={24} color={isLive ? "#10b981" : "#f59e0b"} />
              <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 600 }}>
                {isLive ? "Kết nối Cơ sở dữ liệu Đám mây Hoạt động" : "Trạng thái Khởi tạo Cơ sở dữ liệu"}
              </h3>
            </div>

            <p style={{ margin: "0 0 12px 0", fontSize: "0.95rem", lineHeight: 1.5 }}>
              {isLive ? (
                "Hệ thống đang lưu trữ và đồng bộ dữ liệu tác nghiệp trực tiếp với cơ sở dữ liệu đám mây."
              ) : (
                <>
                  Hệ thống đã kết nối tới máy chủ dữ liệu, nhưng các bảng tác nghiệp nâng cao chưa được khởi tạo trên cơ sở dữ liệu.
                  <br />
                  <strong>Chi tiết:</strong> {store.persistenceError}
                </>
              )}
            </p>

            {!isLive && (
              <div
                style={{
                  background: "var(--color-surface-hover, #f1f5f9)",
                  border: "1px solid var(--color-border, #cbd5e1)",
                  borderRadius: "8px",
                  padding: "12px",
                  marginBottom: "16px",
                  fontSize: "0.88rem",
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: "6px" }}>Các bước hoàn tất khởi tạo cấu trúc dữ liệu:</div>
                <ol style={{ margin: 0, paddingLeft: "20px", lineHeight: 1.6 }}>
                  <li>Mở <strong>Giao diện Quản trị CSDL &gt; Trình soạn thảo SQL (SQL Editor)</strong>.</li>
                  <li>Mở file cấu trúc cơ sở dữ liệu trong dự án:</li>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginTop: "6px",
                      marginBottom: "6px",
                      background: "rgba(0,0,0,0.06)",
                      padding: "6px 10px",
                      borderRadius: "6px",
                      fontFamily: "monospace",
                      fontSize: "0.82rem",
                    }}
                  >
                    <span>supabase/migrations/20261011_vndms_persistence.sql</span>
                    <button
                      type="button"
                      onClick={handleCopyPath}
                      style={{
                        marginLeft: "auto",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                      }}
                      title="Sao chép đường dẫn"
                    >
                      {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                    </button>
                  </div>
                  <li>Dán toàn bộ nội dung SQL và nhấn <strong>Thực thi (Run)</strong>.</li>
                  <li>Tải lại trang VNDMS để chuyển sang chế độ <strong>đồng bộ đám mây trực tiếp</strong> hoàn toàn.</li>
                </ol>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setModalOpen(false)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  background: "#2563eb",
                  color: "#ffffff",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
