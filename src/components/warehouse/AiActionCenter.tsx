import { Link } from "@tanstack/react-router";
import { AlertTriangle, Gauge, Route as RouteIcon, ShieldAlert, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./StatusBadge";
import { useWarehouse } from "@/lib/warehouse/store";
import {
  calculateReorderRecommendation,
  detectBottleneck,
  detectLowStock,
  isOrderAtRisk,
  optimizePicking,
} from "@/lib/warehouse/engine";
import { ZONE_PERFORMANCE } from "@/lib/warehouse/data";

interface Recommendation {
  id: string;
  kind: "Critical" | "Warning" | "Optimization" | "Bottleneck";
  title: string;
  problem: string;
  cause: string;
  action: string;
  impact: string;
  cta: string;
  to: string;
}

const KIND_META = {
  Critical: { icon: ShieldAlert, tone: "critical" as const, card: "bg-critical/8 border-critical/20", ring: "bg-critical/15 text-critical" },
  Warning: { icon: TrendingDown, tone: "warning" as const, card: "bg-caution/20 border-caution/35", ring: "bg-caution/40 text-caution-foreground" },
  Optimization: { icon: RouteIcon, tone: "info" as const, card: "bg-info/10 border-info/22", ring: "bg-info/20 text-info" },
  Bottleneck: { icon: Gauge, tone: "caution" as const, card: "bg-secondary/70 border-secondary", ring: "bg-primary/12 text-primary" },
};

export function AiActionCenter({ limit = 4 }: { limit?: number }) {
  const { orders, products, pickTasks } = useWarehouse();
  const recs: Recommendation[] = [];

  const riskOrder =
    orders.find((o) => o.id === "ORD-1024") ?? orders.find((o) => isOrderAtRisk(o, products));
  if (riskOrder) {
    const line = riskOrder.items[0]!;
    const product = products.find((p) => p.id === line.productId);
    const available = product?.available ?? 0;
    recs.push({
      id: "rec-risk",
      kind: "Critical",
      title: `Order ${riskOrder.id} is at risk`,
      problem: `${line.required} units of ${line.productName} are required but only ${available} are available.`,
      cause: `${riskOrder.customer} is a ${riskOrder.customerTier} account with a ${riskOrder.deadlineHours}h delivery deadline, and stock was consumed by earlier demand.`,
      action: `Allocate the available ${Math.min(available, line.required)} units to ${riskOrder.id}, flag the shortage and reserve incoming stock.`,
      impact: "Protects the critical SLA and converts a silent stockout into a tracked shortage.",
      cta: "Review Decision",
      to: "/allocation",
    });
  }

  const lowStock = products
    .filter((p) => detectLowStock(p) !== "Healthy" && p.available > 0)
    .map((p) => ({ p, r: calculateReorderRecommendation(p) }))
    .sort((a, b) => a.r.daysUntilStockout - b.r.daysUntilStockout)[0];
  if (lowStock) {
    recs.push({
      id: "rec-stock",
      kind: "Warning",
      title: `${lowStock.p.id} may reach stockout within ${lowStock.r.daysUntilStockout} day${lowStock.r.daysUntilStockout === 1 ? "" : "s"}`,
      problem: `${lowStock.p.name} has ${lowStock.p.available} units against average demand of ${lowStock.p.avgDailyDemand}/day.`,
      cause: "Demand has been running above the reorder point without replenishment.",
      action: `Raise a purchase order for ${lowStock.r.recommendedQuantity} units.`,
      impact: "Prevents lost fulfilment on a fast-moving SKU.",
      cta: "View Reorder Recommendation",
      to: "/inventory",
    });
  }

  const opt = optimizePicking(pickTasks);
  if (opt) {
    recs.push({
      id: "rec-pick",
      kind: "Optimization",
      title: `Batch pick ${opt.orderIds.length} orders in ${opt.zone}`,
      problem: opt.message,
      cause: "Pickers are travelling the same aisles repeatedly for separate orders.",
      action: `Create a single batch pick task covering ${opt.orderIds.slice(0, 4).join(", ")}…`,
      impact: `Saves an estimated ${opt.timeSavingMinutes} picking minutes today.`,
      cta: "Optimize Picking",
      to: "/picking",
    });
  }

  const bottleneck = detectBottleneck(ZONE_PERFORMANCE);
  if (bottleneck) {
    recs.push({
      id: "rec-bottleneck",
      kind: "Bottleneck",
      title: `Picking ${bottleneck.zone} is ${bottleneck.deltaPercent}% slower than average`,
      problem: `${bottleneck.zone} averages ${bottleneck.avgMinutes} min per pick vs ${bottleneck.warehouseAvg} min warehouse-wide.`,
      cause: "High-demand SKUs are stored far from the packing station in that zone.",
      action: bottleneck.recommendation,
      impact: bottleneck.expectedImprovement,
      cta: "Analyze Bottleneck",
      to: "/analytics",
    });
  }

  return (
    <section className="panel overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
            <AlertTriangle className="size-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold">AI Action Center</h2>
            <p className="text-xs text-muted-foreground">Exception → Decision → Resolution</p>
          </div>
        </div>
        <StatusBadge value={`${recs.length} open recommendations`} tone="primary" dot={false} />
      </header>
      <div className="grid gap-4 p-5 xl:grid-cols-2">
        {recs.slice(0, limit).map((rec) => {
          const meta = KIND_META[rec.kind];
          return (
            <article key={rec.id} className={`rounded-2xl border p-4 transition-shadow hover:shadow-[var(--shadow-card)] ${meta.card}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${meta.ring}`}>
                    <meta.icon className="size-4" />
                  </span>
                  <div>
                    <StatusBadge value={rec.kind} tone={meta.tone} />
                    <h3 className="mt-2 text-sm font-semibold leading-snug">{rec.title}</h3>
                  </div>
                </div>
              </div>
              <dl className="mt-3 space-y-2 text-xs">
                <Row label="Problem" value={rec.problem} />
                <Row label="Why it happened" value={rec.cause} />
                <Row label="Recommended action" value={rec.action} />
                <Row label="Expected impact" value={rec.impact} />
              </dl>
              <Button asChild size="sm" className="mt-4">
                <Link to={rec.to}>{rec.cta}</Link>
              </Button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[124px_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}