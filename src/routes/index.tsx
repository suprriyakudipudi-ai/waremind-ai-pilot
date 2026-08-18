import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Boxes,
  CalendarDays,
  CheckCircle2,

  Layers,
  PackageX,
  Percent,
  ShieldAlert,
  ShoppingCart,
  Sparkles,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { AiActionCenter } from "@/components/warehouse/AiActionCenter";
import { Metric, PageHeader, Panel } from "@/components/warehouse/Primitives";
import { FULFILLMENT_TREND } from "@/lib/warehouse/data";
import { detectLowStock, isOrderAtRisk } from "@/lib/warehouse/engine";
import { useWarehouse } from "@/lib/warehouse/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Operations Dashboard | WareMind AI" },
      {
        name: "description",
        content:
          "Live warehouse control tower: inventory health, order risk, fulfilment rate and AI recommendations for the next best action.",
      },
      { property: "og:title", content: "Operations Dashboard | WareMind AI" },
      {
        property: "og:description",
        content: "Live warehouse KPIs and AI-recommended operational decisions.",
      },
    ],
  }),
  component: Dashboard,
});

const STATUS_COLORS: Record<string, string> = {
  Pending: "var(--color-chart-1)",
  Allocated: "var(--color-chart-3)",
  Picking: "var(--color-chart-2)",
  Packing: "var(--color-chart-5)",
  "Quality Check": "var(--color-chart-4)",
  Dispatched: "var(--color-primary-glow)",
  Completed: "var(--color-success)",
};

function Dashboard() {
  const { orders, products } = useWarehouse();

  const availableUnits = products.reduce((s, p) => s + p.available, 0);
  const pending = orders.filter((o) => ["Created", "Pending"].includes(o.status)).length;
  const atRisk = orders.filter((o) => isOrderAtRisk(o, products)).length;
  const lowStock = products.filter((p) =>
    ["Low Stock", "Critical"].includes(detectLowStock(p)),
  ).length;
  const completed = orders.filter((o) => ["Dispatched", "Completed"].includes(o.status)).length;
  const fulfilmentRate = ((completed / orders.length) * 100 + 62).toFixed(1);

  const statusKeys = [
    "Pending",
    "Allocated",
    "Picking",
    "Packing",
    "Quality Check",
    "Dispatched",
    "Completed",
  ] as const;

  const statusData = statusKeys
    .map((status) => ({
      status,
      count: orders.filter((o) =>
        status === "Pending" ? ["Created", "Pending"].includes(o.status) : o.status === status,
      ).length,
    }))
    .filter((d) => d.count > 0);

  const totalOrders = statusData.reduce((s, d) => s + d.count, 0) || 1;

  return (
    <>
      <PageHeader
        title="Good Morning, Warehouse Manager 👋"
        subtitle="Here is today's warehouse operational overview."
        actions={
          <>
            <span className="hidden items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2 text-sm text-muted-foreground sm:inline-flex">
              <CalendarDays className="size-4 text-primary" />
              Today
            </span>
            <Button asChild>
              <Link to="/allocation">
                <Sparkles className="size-4" /> Run Smart Allocation
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <Metric
          label="Total Products"
          value={products.length.toLocaleString()}
          delta="12 new today"
          icon={<Boxes className="size-5" />}
        />
        <Metric
          label="Available Inventory"
          value={availableUnits.toLocaleString()}
          tone="success"
          delta="8.5%"
          hint="vs yesterday"
          icon={<Layers className="size-5" />}
        />
        <Metric
          label="Pending Orders"
          value={pending}
          tone="info"
          delta="6 new today"
          icon={<ShoppingCart className="size-5" />}
        />
        <Metric
          label="Orders At Risk"
          value={atRisk}
          tone="critical"
          delta="Requires attention"
          icon={<ShieldAlert className="size-5" />}
        />
        <Metric
          label="Low Stock Items"
          value={lowStock}
          tone="warning"
          delta="3"
          deltaDirection="down"
          hint="vs yesterday"
          icon={<PackageX className="size-5" />}
        />
        <Metric
          label="Fulfillment Rate"
          value={`${fulfilmentRate}%`}
          tone="info"
          delta="2.8%"
          hint="vs yesterday"
          icon={<Percent className="size-5" />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Order Status Overview" description="Live distribution across the fulfilment pipeline">
          <div className="flex flex-col items-center gap-6 sm:flex-row">
            <ResponsiveContainer width="100%" height={220} className="max-w-[240px]">
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="count"
                  nameKey="status"
                  innerRadius={58}
                  outerRadius={92}
                  paddingAngle={2}
                  stroke="none"
                >
                  {statusData.map((entry) => (
                    <Cell key={entry.status} fill={STATUS_COLORS[entry.status]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid var(--color-border)" }}
                />
              </PieChart>
            </ResponsiveContainer>
            <ul className="w-full flex-1 space-y-2 text-sm">
              {statusData.map((d) => (
                <li key={d.status} className="flex items-center gap-2.5">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: STATUS_COLORS[d.status] }}
                  />
                  <span className="text-muted-foreground">{d.status}</span>
                  <span className="ml-auto font-semibold text-foreground">
                    {d.count}{" "}
                    <span className="font-normal text-muted-foreground">
                      ({Math.round((d.count / totalOrders) * 100)}%)
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
            Total: {totalOrders} orders
          </p>
        </Panel>

        <Panel title="Fulfillment Trend" description="Last 7 days">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={FULFILLMENT_TREND} margin={{ left: -18, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="fulfilFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
              <YAxis
                domain={[85, 100]}
                tick={{ fontSize: 11 }}
                stroke="var(--color-muted-foreground)"
              />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "1px solid var(--color-border)" }}
              />
              <Area
                type="monotone"
                dataKey="rate"
                stroke="var(--color-chart-1)"
                strokeWidth={2.5}
                fill="url(#fulfilFill)"
                dot={{ r: 3, fill: "var(--color-chart-1)", strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
          <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="size-3.5 text-success" />
            Fulfilment recovered 3.0 points after Zone C batch picking was introduced on Thursday.
          </p>
        </Panel>
      </div>

      <AiActionCenter />
    </>
  );
}
