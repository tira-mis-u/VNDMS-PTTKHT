import {
  BellRing,
  ClipboardPlus,
  LifeBuoy,
  ListPlus,
  Radio,
} from "lucide-react";

const actions = [
  { label: "Tạo sự cố", icon: ClipboardPlus },
  { label: "Giao nhiệm vụ", icon: ListPlus },
  { label: "Gửi cảnh báo", icon: BellRing },
  { label: "Điều phối đội", icon: LifeBuoy },
  { label: "Xử lý SOS", icon: Radio },
];

export function QuickActions({
  onAction,
}: {
  onAction: (label: string) => void;
}) {
  return (
    <section className="cc-quick-actions">
      <span>Thao tác nhanh</span>
      <div>
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button key={action.label} onClick={() => onAction(action.label)}>
              <Icon size={15} />
              {action.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
