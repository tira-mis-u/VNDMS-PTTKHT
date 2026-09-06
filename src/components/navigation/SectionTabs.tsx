import type { LucideIcon } from "lucide-react";

/**
 * THANH TAB PHÂN HỆ
 * ─────────────────────────────────────────────────────────────────────────
 * Dùng để gộp các mục điều hướng cùng một chuỗi nghiệp vụ vào một mục duy
 * nhất trên thanh bên (ví dụ: Yêu cầu cứu trợ – Kho & tồn – Chuyến hàng là ba
 * chặng của cùng một chuỗi cung ứng, không phải ba phân hệ khác nhau).
 *
 * Quy tắc bắt buộc khi dùng:
 *  • Tab nào người dùng không có quyền đọc thì KHÔNG hiển thị (truyền `hidden`).
 *  • Đường dẫn cũ của từng tab được giữ nguyên để deep-link không hỏng.
 *  • Tối đa 4 tab cho một mục; quá 4 thì phải tách lại thành mục riêng.
 */
export interface SectionTabItem {
  label: string;
  path: string;
  icon: LucideIcon;
  badge?: number;
  hidden?: boolean;
}

export function SectionTabs({
  items,
  active,
  navigate,
  ariaLabel,
}: {
  items: SectionTabItem[];
  /** Đường dẫn của tab đang mở. */
  active: string;
  navigate: (path: string) => void;
  ariaLabel: string;
}) {
  const visible = items.filter((item) => !item.hidden);
  if (visible.length < 2) return null; // một tab thì không cần thanh tab
  return (
    <nav className="section-tabs" aria-label={ariaLabel}>
      {visible.map((item) => (
        <button
          key={item.path}
          type="button"
          className={active === item.path ? "active" : ""}
          onClick={() => navigate(item.path)}
          aria-current={active === item.path ? "page" : undefined}
        >
          <item.icon size={15} />
          {item.label}
          {typeof item.badge === "number" && item.badge > 0 ? (
            <span className="section-tab-badge">{item.badge}</span>
          ) : null}
        </button>
      ))}
    </nav>
  );
}
