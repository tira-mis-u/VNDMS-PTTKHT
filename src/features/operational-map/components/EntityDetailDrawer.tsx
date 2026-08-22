import { useEffect, useRef } from "react";
import { ArrowUpRight, X } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import type { UnifiedMapDetail } from "@/application/map/unifiedMapQueries";

export function EntityDetailDrawer({
  detail,
  onClose,
  onOpenDetail,
}: {
  detail: UnifiedMapDetail;
  onClose: () => void;
  onOpenDetail: (path: string) => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detail.ref.id, onClose]);

  return (
    <aside
      className="om-drawer"
      role="dialog"
      aria-modal="false"
      aria-label={`Chi tiết ${detail.kindLabel} ${detail.ref.id}`}
    >
      <header className="om-drawer-head">
        <div>
          <span className="om-drawer-kind">{detail.kindLabel}</span>
          <h3>{detail.title}</h3>
          <p>{detail.subtitle}</p>
        </div>
        <button
          ref={closeRef}
          type="button"
          className="om-drawer-close"
          onClick={onClose}
          aria-label="Đóng chi tiết"
        >
          <X size={17} />
        </button>
      </header>
      <div className="om-drawer-body">
        <dl>
          <div>
            <dt>Mã</dt>
            <dd>{detail.ref.id}</dd>
          </div>
          <div>
            <dt>Trạng thái</dt>
            <dd>
              <Badge tone={detail.statusBadge.tone}>
                {detail.statusBadge.label}
              </Badge>
            </dd>
          </div>
          {detail.rows.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <footer className="om-drawer-actions">
        <Button onClick={() => onOpenDetail(detail.detailPath)}>
          Mở trang chi tiết
          <ArrowUpRight size={15} />
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Đóng
        </Button>
      </footer>
    </aside>
  );
}
