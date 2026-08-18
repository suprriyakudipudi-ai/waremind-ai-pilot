import { createFileRoute } from "@tanstack/react-router";
import { Activity, Gauge, PackageCheck, Timer, TrendingUp } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Metric, PageHeader, Panel } from "@/components/warehouse/Primitives";
import { StatusBadge } from "@/components/warehouse/StatusBadge";
import { FULFILLMENT_TREND, ZONE_PERFORMANCE } from "@/lib/warehouse/data";
import { detectBottleneck, formatCurrency, orderValue } from "@/lib/warehouse/engine";
import { useWarehouse } from "@/lib/warehouse/store";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Warehouse Analytics | WareMind AI" },
      {
        name: "description",
        content:
          "Fulfilment trends, zone productivity, picking throughput and inventory value analytics for warehouse operations.",
      },
      { property: "og:title", content: "Warehouse Analytics | WareMind AI" },
      {
        property: "og:description",
        content: "Track fulfilment rate, zone bottlenecks and picker productivity in one analytics view.",
      },
    ],
  }),
  component: AnalyticsPage,
});

const TOOLTIP = {
  contentStyle: {
    borderRadius: 14,
    border: "1px solid var(--color-border)",
    background: "var(--color-surface)",
    boxShadow: "var(--shadow-card)",
    fontSize: 12,
  },
} as const;

function AnalyticsPage() {
  const { orders, products, pickTasks, exceptions } = useWarehouse();

  const inventoryValue = products.reduce((s, p) => s + p.available * p.unitPrice, 0);
  const revenue = orders.reduce((s, o) => s + orderValue(o), 0);
  const completed = orders.filter((o) => ["Dispatched", "Completed"].includes(o.status)).length;
  const onTime = Math.round((completed / Math.max(1, orders.length)) * 100 + 58);
  const avgPick = Math.round(
    pickTasks.reduce((s, t) => s + (t.actualMinutes || t.estimatedMinutes), 0) / Math.max(1, pickTasks.length),
  );
  const bottleneck = detectBottleneck(ZONE_PERFORMANCE);

  const categoryValue = Object.entries(
    products.reduce<Record<string, number>>((acc, p) => {
      acc[p.category] = (acc[p.category] ?? 0) + p.available * p.unitPrice;
      return acc;
    }, {}),
  )
    .map(([category, value]) => ({ category, value: Math.round(value / 1000) }))
    .sort((a, b) => b.value - a.value);

  const pickerStats = Object.entries(
    pickTasks.reduce<Record<string, { tasks: number; minutes: number }>>((acc, t) => {
      const cur = acc[t.picker] ?? { tasks: 0, minutes: 0 };
      cur.tasks += 1;
      cur.minutes += t.actualMinutes || t.estimatedMinutes;
      acc[t.picker] = cur;
      return acc;
    }, {}),
  )
    .map(([picker, s]) => ({ picker, tasks: s.tasks, avg: Math.round(s.minutes / s.tasks) }))
    .sort((a, b) => b.tasks - a.tasks);

  const exceptionMix = Object.entries(
    exceptions.reduce<Record<string, number>>((acc, e) => {
      acc[e.type] = (acc[e.type] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([type, count]) => ({ type, count }));

  const zoneRadar = ZONE_PERFORMANCE.map((z) => ({
    zone: z.zone,
    speed: Math.round((30 - z.avgPickMinutes) * 4),
    volume: z.tasks,
  }));

  const barColors = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)"];

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle="Performance, productivity and inventory value across the network."
        actions={<StatusBadge value="Rolling 7 days" tone="primary" dot={false} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="On-time Fulfilment" value={`${onTime}%`} hint="vs 92% target" tone="success" icon={<TrendingUp className="size-4" />} />
        <Metric label="Avg Pick Time" value={`${avgPick} min`} hint="per task" tone="info" icon={<Timer className="size-4" />} />
        <Metric label="Inventory Value" value={formatCurrency(inventoryValue)} hint="available stock" icon={<PackageCheck className="size-4" />} />
        <Metric label="Order Book" value={formatCurrency(revenue)} hint="open + shipped" tone="warning" icon={<Activity className="size-4" />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Fulfilment Trend" description="Daily fulfilment rate and order volume" className="xl:col-span-2">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={FULFILLMENT_TREND} margin={{ left: -18, right: 8 }}>
              <defs>
                <linearGradient id="fillRate" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
              <YAxis domain={[85, 100]} tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
              <Tooltip {...TOOLTIP} />
              <Area type="monotone" dataKey="rate" stroke="var(--color-chart-1)" strokeWidth={2.5} fill="url(#fillRate)" />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Zone Balance" description="Speed vs volume by zone">
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={zoneRadar} outerRadius={95}>
              <PolarGrid stroke="var(--color-border)" />
              <PolarAngleAxis dataKey="zone" tick={{ fontSize: 11 }} />
              <Radar name="Speed index" dataKey="speed" stroke="var(--color-chart-2)" fill="var(--color-chart-2)" fillOpacity={0.35} />
              <Radar name="Task volume" dataKey="volume" stroke="var(--color-chart-1)" fill="var(--color-chart-1)" fillOpacity={0.2} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Tooltip {...TOOLTIP} />
            </RadarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Inventory Value by Category" description="Available stock value in ₹ thousands">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={categoryValue} layout="vertical" margin={{ left: 24, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
              <YAxis type="category" dataKey="category" width={110} tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
              <Tooltip {...TOOLTIP} />
              <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                {categoryValue.map((entry, i) => (
                  <Cell key={entry.category} fill={barColors[i % barColors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Exception Mix" description="Where fulfilment breaks down">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={exceptionMix} margin={{ left: -18, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="type" tick={{ fontSize: 10 }} interval={0} angle={-12} height={50} stroke="var(--color-muted-foreground)" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
              <Tooltip {...TOOLTIP} />
              <Bar dataKey="count" fill="var(--color-chart-4)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <Panel title="Picker Productivity" description="Tasks handled and average minutes per pick">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 font-medium">Picker</th>
                <th className="pb-2 font-medium">Tasks</th>
                <th className="pb-2 font-medium">Avg minutes</th>
                <th className="pb-2 font-medium">Throughput</th>
              </tr>
            </thead>
            <tbody>
              {pickerStats.map((p) => (
                <tr key={p.picker} className="border-b border-border/60 last:border-0">
                  <td className="py-2.5 font-medium">{p.picker}</td>
                  <td className="py-2.5 text-muted-foreground">{p.tasks}</td>
                  <td className="py-2.5 text-muted-foreground">{p.avg} min</td>
                  <td className="py-2.5">
                    <div className="h-2 w-40 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full gradient-brand"
                        style={{ width: `${Math.min(100, p.tasks * 18)}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {bottleneck && (
        <section className="panel-glow p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl gradient-brand text-primary-foreground">
              <Gauge className="size-5" />
            </span>
            <div>
              <h2 className="text-sm font-semibold">
                Bottleneck detected in {bottleneck.zone} — {bottleneck.deltaPercent}% slower than average
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {bottleneck.zone} averages {bottleneck.avgMinutes} min per pick against a warehouse average of{" "}
                {bottleneck.warehouseAvg} min. {bottleneck.recommendation} {bottleneck.expectedImprovement}
              </p>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
