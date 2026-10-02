import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { X } from 'lucide-react';

/* ---------------------------------------------------------------- Button -- */

type ButtonVariant = 'primary' | 'secondary' | 'soft' | 'outline' | 'ai' | 'ghost' | 'danger';

export function Button({
  children,
  variant = 'primary',
  icon: Icon,
  className = '',
  type = 'button',
  ...rest
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  icon?: LucideIcon;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={`btn btn-${variant} ${className}`} {...rest}>
      {Icon ? <Icon size={16} strokeWidth={2.3} aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export function IconButton({
  label,
  children,
  className = '',
  ...rest
}: { label: string; children: ReactNode; className?: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" aria-label={label} title={label} className={`icon-btn ${className}`} {...rest}>
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ Pill -- */

export function Pill({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'indigo' | 'green' | 'amber' | 'violet' | 'cyan' | 'red';
  className?: string;
}) {
  return <span className={`pill pill-${tone} ${className}`}>{children}</span>;
}

/* ------------------------------------------------------------ EmptyState -- */

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="analysis-empty">
      <div className="empty-orbit">
        <Icon size={24} aria-hidden="true" />
      </div>
      <h3>{title}</h3>
      {children ? <p>{children}</p> : null}
      {action}
    </div>
  );
}

/* --------------------------------------------------------------- Skeleton -- */

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="skeleton" aria-hidden="true">
      {Array.from({ length: lines }).map((_, index) => (
        <span key={index} style={{ width: `${100 - index * 12}%` }} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ Tabs -- */

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  className = '',
  ariaLabel,
}: {
  tabs: readonly T[];
  active: T;
  onChange: (tab: T) => void;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div className={`tabs ${className}`} role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => (
        <button
          key={tab}
          role="tab"
          aria-selected={active === tab}
          className={active === tab ? 'active' : ''}
          onClick={() => onChange(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- Modal -- */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  labelledBy = 'cm-modal-title',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  labelledBy?: string;
}) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  // Escape must close the dialog even when focus is outside the panel, and
  // focus should move into the dialog when it opens, then back on close.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <h2 id={labelledBy}>{title}</h2>
          <button ref={closeButtonRef} type="button" aria-label="Close dialog" className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Stat -- */

export function StatCard({
  icon: Icon,
  label,
  value,
  note,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  note: string;
  tone: 'indigo' | 'green' | 'amber' | 'cyan' | 'violet';
}) {
  return (
    <div className="stat-card card">
      <div className={`stat-icon ${tone}`}>
        <Icon size={17} aria-hidden="true" />
      </div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}
