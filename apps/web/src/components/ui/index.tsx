// src/components/ui/index.tsx
import React from "react";
import { cn } from "@/lib/utils";
import { Loader2, X } from "lucide-react";

// ─── Button ─────────────────────────────────────────────────
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "gold" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
}

export function Button({
  variant = "gold",
  size = "md",
  loading,
  icon,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]";

  const variants = {
    gold: "bg-gold-600 hover:bg-gold-500 text-white shadow-lg shadow-gold-900/20",
    outline: "border border-gold-600/60 text-gold-400 hover:bg-gold-600/10",
    ghost: "text-[var(--text-secondary)] hover:text-white hover:bg-dark-50/60",
    danger: "bg-red-600/20 border border-red-500/30 text-red-400 hover:bg-red-600/30",
  };

  const sizes = {
    sm: "px-4 py-2 text-xs",
    md: "px-5 py-2.5 text-sm",
    lg: "px-6 py-3.5 text-sm",
  };

  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : icon}
      {children}
    </button>
  );
}

// ─── Input ───────────────────────────────────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftIcon, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
              {leftIcon}
            </span>
          )}
          <input
            id={inputId}
            ref={ref}
            className={cn(
              "input-field",
              leftIcon && "pl-10",
              error && "border-red-500/60 focus:border-red-500 focus:ring-red-500/20",
              className
            )}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        {hint && !error && (
          <p className="text-xs text-[var(--text-muted)]">{hint}</p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

// ─── Select ──────────────────────────────────────────────────
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export function Select({
  label,
  error,
  options,
  placeholder,
  className,
  ...props
}: SelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
          {label}
        </label>
      )}
      <select
        className={cn(
          "input-field appearance-none cursor-pointer",
          error && "border-red-500/60",
          className
        )}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-dark-200">
            {o.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

// ─── Textarea ────────────────────────────────────────────────
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className, ...props }: TextareaProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
          {label}
        </label>
      )}
      <textarea
        className={cn("input-field resize-none min-h-[80px]", error && "border-red-500/60", className)}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

// ─── Badge ───────────────────────────────────────────────────
interface BadgeProps {
  children: React.ReactNode;
  variant?: "gold" | "green" | "red" | "blue" | "purple" | "gray" | "yellow";
  className?: string;
}

export function Badge({ children, variant = "gray", className }: BadgeProps) {
  const variants = {
    gold: "bg-gold-600/15 text-gold-400 border-gold-600/25",
    green: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
    red: "bg-red-500/15 text-red-400 border-red-500/25",
    blue: "bg-blue-500/15 text-blue-400 border-blue-500/25",
    purple: "bg-purple-500/15 text-purple-400 border-purple-500/25",
    gray: "bg-dark-50/80 text-[var(--text-secondary)] border-dark-50",
    yellow: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
  };

  return (
    <span className={cn("badge border", variants[variant], className)}>
      {children}
    </span>
  );
}

// ─── Spinner ─────────────────────────────────────────────────
export function Spinner({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <Loader2
      size={size}
      className={cn("animate-spin text-gold-500", className)}
    />
  );
}

// ─── Empty State ─────────────────────────────────────────────
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-fade-in">
      {icon && (
        <div className="w-16 h-16 rounded-2xl bg-dark-200 border border-dark-50 flex items-center justify-center mb-4 text-[var(--text-muted)]">
          {icon}
        </div>
      )}
      <h3 className="text-base font-medium text-white mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-[var(--text-muted)] max-w-xs mb-4">
          {description}
        </p>
      )}
      {action}
    </div>
  );
}

// ─── Modal ───────────────────────────────────────────────────
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

export function Modal({ isOpen, onClose, title, children, size = "md" }: ModalProps) {
  if (!isOpen) return null;

  const sizes = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-2xl",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" />

      {/* Content */}
      <div
        className={cn(
          "relative w-full bg-dark-300 border border-dark-50 rounded-2xl shadow-2xl",
          "animate-slide-up",
          sizes[size]
        )}
      >
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-dark-50">
            <h2 className="font-display font-semibold text-white">{title}</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-dark-50/60 transition-all"
            >
              <X size={16} />
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Stats Card ──────────────────────────────────────────────
interface StatsCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: { value: number; label: string };
  className?: string;
}

export function StatsCard({ label, value, icon, trend, className }: StatsCardProps) {
  return (
    <div className={cn("card-elevated p-4", className)}>
      <div className="flex items-start justify-between mb-2">
        <p className="section-label">{label}</p>
        {icon && (
          <div className="p-2 rounded-lg bg-gold-600/10 text-gold-500">
            {icon}
          </div>
        )}
      </div>
      <p className="text-2xl font-display font-semibold text-white">{value}</p>
      {trend && (
        <p
          className={cn(
            "text-xs mt-1",
            trend.value >= 0 ? "text-emerald-400" : "text-red-400"
          )}
        >
          {trend.value >= 0 ? "+" : ""}
          {trend.value}% {trend.label}
        </p>
      )}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────
export function SkeletonCard() {
  return (
    <div className="card p-4 space-y-3">
      <div className="skeleton h-4 w-3/4" />
      <div className="skeleton h-3 w-1/2" />
      <div className="skeleton h-3 w-2/3" />
    </div>
  );
}