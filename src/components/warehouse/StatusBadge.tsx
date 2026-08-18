import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "caution" | "critical" | "info" | "neutral" | "primary";

const toneClass: Record<Tone, string> = {
  success: "bg-success/12 text-success border-success/25",
  warning: "bg-warning/12 text-warning border-warning/25",
  caution: "bg-caution/18 text-caution-foreground border-caution/40",
  critical: "bg-critical/12 text-critical border-critical/25",
  info: "bg-info/12 text-info border-info/25",
  neutral: "bg-muted text-muted-foreground border-border",
  primary: "bg-primary/10 text-primary border-primary/25",
};

const MAP: Record<string, Tone> = {
  // stock
  Healthy: "success",
  "Low Stock": "warning",
  Critical: "critical",
  "Out of Stock": "critical",
  // priority
  High: "warning",
  Medium: "caution",
  Low: "neutral",
  // order status
  Created: "neutral",
  Pending: "neutral",
  Allocated: "info",
  Picking: "info",
  Packing: "info",
  "Quality Check": "primary",
  "Ready to Dispatch": "primary",
  Dispatched: "success",
  Completed: "success",
  Exception: "critical",
  // task status
  Waiting: "neutral",
  Assigned: "info",
  "In Progress": "info",
  Delayed: "warning",
  // exception status
  Open: "critical",
  "In Review": "warning",
  Resolved: "success",
  Escalated: "critical",
  "At Risk": "warning",
  "On Hold": "warning",
};

export function StatusBadge({
  value,
  tone,
  className,
  dot = true,
}: {
  value: string;
  tone?: Tone | undefined;
  className?: string | undefined;
  dot?: boolean | undefined;
}) {
  const resolved = tone ?? MAP[value] ?? "neutral";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
        toneClass[resolved],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {value}
    </span>
  );
}