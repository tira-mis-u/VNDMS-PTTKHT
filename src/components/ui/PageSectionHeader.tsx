import type { ComponentType, ReactNode } from "react";

export type PageSectionHeaderProps = {
  section: string;
  title: ReactNode;
  description?: ReactNode;
  icon: ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
  actions?: ReactNode;
  className?: string;
};

/**
 * Quy ước header cấp trang duy nhất cho các module trong sidebar.
 * `section` là tên phân hệ, không phải breadcrumb điều hướng giả.
 */
export function PageSectionHeader({
  section,
  title,
  description,
  icon: Icon,
  actions,
  className = "",
}: PageSectionHeaderProps) {
  return (
    <header className={`page-section-header ${className}`.trim()}>
      <div className="page-section-header-copy">
        <span className="page-section-eyebrow">
          <Icon size={15} aria-hidden={true} />
          {section}
        </span>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="page-section-actions">{actions}</div> : null}
    </header>
  );
}
