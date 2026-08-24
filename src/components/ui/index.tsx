import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";
import { forwardRef } from "react";
export { PageSectionHeader } from "./PageSectionHeader";
import { ChevronRight } from "lucide-react";

export function DialogBackdrop({
  onClick,
}: Pick<ButtonHTMLAttributes<HTMLButtonElement>, "onClick">) {
  return (
    <button
      type="button"
      className="dialog-backdrop"
      aria-label="Đóng hộp thoại"
      onClick={onClick}
    />
  );
}

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

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function Input({ className = "", ...props }, ref) {
  return (
    <input ref={ref} className={`ui-input ${className}`.trim()} {...props} />
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className = "", ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={`ui-textarea ${className}`.trim()}
      {...props}
    />
  );
});

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
