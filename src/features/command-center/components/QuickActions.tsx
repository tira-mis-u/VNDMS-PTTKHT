import { ClipboardCheck, ClipboardPlus, LifeBuoy, ListPlus, Radio } from "lucide-react";
import { useOperationalState } from "@/state/operations/OperationalStateContext";

/**
 * Bốn thao tác thật sự bắt đầu từ phòng chỉ huy.
 *
 * Đã BỎ nút "Gửi cảnh báo": nó không gửi gì cả — hộp thoại phía sau là
 * "xác nhận tiếp nhận cảnh báo" (chính hộp thoại đó ghi "Hệ thống không phát
 * cảnh báo thủ công"). Một nút mang tên "Gửi cảnh báo" mà không phát được bản
 * tin nào là loại nhãn dối nguy hiểm nhất trong hệ thống PCTT. Việc xác nhận
 * cảnh báo vốn đã nằm ngay trong bảng "Cảnh báo tác nghiệp" bên dưới.
 */
/**
 * Mỗi thao tác gắn với quyền thực thi tương ứng: vai trò không có quyền thì
 * nút biến mất thay vì bấm vào rồi bị chặn. `path` dành cho thao tác đã có
 * biểu mẫu ở phân hệ khác (mở thẳng nơi làm việc thật, không dựng hộp thoại
 * giả trong phòng chỉ huy).
 */
const actions = [
  { label: "Tạo sự cố", icon: ClipboardPlus, permission: "create" },
  { label: "Giao nhiệm vụ", icon: ListPlus, permission: "task_assign" },
  { label: "Điều phối đội", icon: LifeBuoy, permission: "team_assign" },
  { label: "Xử lý SOS", icon: Radio, permission: "sos_triage" },
  {
    label: "Ghi nhận thiệt hại",
    icon: ClipboardCheck,
    permission: "damage_assessment_create",
    path: "/recovery",
  },
] as const;

export function QuickActions({
  onAction,
  onNavigate,
}: {
  onAction: (label: string) => void;
  onNavigate: (path: string) => void;
}) {
  const store = useOperationalState();
  // Chỉ hiện thao tác mà người đang trực thực sự có quyền thực hiện. Trước đây
  // mọi vai trò đều thấy đủ 5 nút, bấm vào thì bị chặn — đó là nút chết.
  const allowed = actions.filter((action) => store.can(action.permission as never));
  if (!allowed.length) return null;
  return (
    <section className="cc-quick-actions">
      <span>Thao tác nhanh</span>
      <div>
        {allowed.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              onClick={() =>
                "path" in action ? onNavigate(action.path) : onAction(action.label)
              }
            >
              <Icon size={15} />
              {action.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
