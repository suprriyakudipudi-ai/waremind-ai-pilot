import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string | undefined;
  actions?: ReactNode | undefined;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: string | undefined;
  description?: string | undefined;
  actions?: ReactNode | undefined;
  children: ReactNode;
  className?: string | undefined;
  bodyClassName?: string | undefined;
}) {
  return (
    <section className={cn("panel", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            {title && <h2 className="text-sm font-semibold text-foreground">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-12 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}

export function Metric({
  label,
  value,
  hint,
  tone = "default",
  icon,
  delta,
  deltaDirection = "up",
}: {
  label: string;
  value: string | number;
  hint?: string | undefined;
  tone?: "default" | "success" | "warning" | "critical" | "info" | undefined;
  icon?: ReactNode | undefined;
  delta?: string | undefined;
  deltaDirection?: "up" | "down" | "flat" | undefined;
}) {
  const toneCard: Record<string, string> = {
    default: "bg-secondary/60 border-secondary",
    success: "bg-success/12 border-success/25",
    warning: "bg-caution/25 border-caution/40",
    critical: "bg-critical/10 border-critical/25",
    info: "bg-info/12 border-info/25",
  };
  const toneRing: Record<string, string> = {
    default: "bg-primary/12 text-primary",
    success: "bg-success/20 text-success",
    warning: "bg-caution/40 text-caution-foreground",
    critical: "bg-critical/15 text-critical",
    info: "bg-info/20 text-info",
  };
  const toneText: Record<string, string> = {
    default: "text-primary",
    success: "text-success",
    warning: "text-caution-foreground",
    critical: "text-critical",
    info: "text-info",
  };
  return (
    <div
      className={cn(
        "rounded-2xl border p-4 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-raised)]",
        toneCard[tone],
      )}
    >
      <div className="flex items-center gap-3">
        {icon && (
          <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", toneRing[tone])}>{icon}</span>
        )}
        <div className="min-w-0">
          <p className={cn("truncate text-2xl font-semibold leading-tight", toneText[tone])}>{value}</p>
          <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
        </div>
      </div>
      {(delta || hint) && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          {delta && (
            <span className={cn("inline-flex items-center gap-1 font-medium", toneText[tone])}>
              <span aria-hidden>{deltaDirection === "down" ? "↘" : deltaDirection === "flat" ? "→" : "↗"}</span>
              {delta}
            </span>
          )}
          {hint}
        </p>
      )}
    </div>
  );
}
