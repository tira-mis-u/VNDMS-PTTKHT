import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ChevronRight } from "lucide-react";

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "icon";
}) {
  return (
    <button
      className={`btn btn-${variant} btn-${size} ${className}`}
      {...props}
    />
  );
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "red" | "amber" | "green" | "blue";
  children: ReactNode;
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function StatusDot({
  tone = "green",
}: {
  tone?: "red" | "amber" | "green" | "blue";
}) {
  return (
    <span className={`status-dot status-dot-${tone}`} aria-hidden="true" />
  );
}

export function Progress({
  value,
  tone = "blue",
}: {
  value: number;
  tone?: "blue" | "green" | "amber";
}) {
  return (
    <div className="progress-track">
      <span
        className={`progress-fill progress-${tone}`}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

export function Avatar({
  initials,
  small = false,
  src,
  alt = "",
}: {
  initials: string;
  small?: boolean;
  src?: string;
  alt?: string;
}) {
  return (
    <span className={`avatar ${small ? "avatar-small" : ""}`}>
      {src ? <img src={src} alt={alt} /> : initials}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <b>{title}</b>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: ReactNode;
  helper: string;
  icon: ReactNode;
}) {
  return (
    <div className="stat-card">
      <span className="stat-card-icon">{icon}</span>
      <div>
        <small>{label}</small>
        <b>{value}</b>
        <p>{helper}</p>
      </div>
    </div>
  );
}

export function SectionHeader({
  title,
  description,
  action,
  onAction,
}: {
  title: string;
  description?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action && (
        <button className="text-action" onClick={onAction}>
          {action}
          <ChevronRight size={15} />
        </button>
      )}
    </div>
  );
}
