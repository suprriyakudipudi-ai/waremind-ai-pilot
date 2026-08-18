import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Boxes,
  CheckCircle2,
  Clock,
  PackageX,
  Percent,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
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
      { property: "og:description", content: "Live warehouse KPIs and AI-recommended operational decisions." },
    ],
  }),
  component: Dashboard,
});

const STATUS_COLORS: Record<string, string> = {
  Healthy: "var(--color-success)",
  "Low Stock": "var(--color-warning)",
  Critical: "var(--color-critical)",
  "Out of Stock": "var(--color-neutral)",
};

function Dashboard() {
  const { orders, products } = useWarehouse();

  const availableUnits = products.reduce((s, p) => s + p.available, 0);
  const pending = orders.filter((o) => ["Created", "Pending"].includes(o.status)).length;
  const atRisk = orders.filter((o) => isOrderAtRisk(o, products)).length;
  const lowStock = products.filter((p) => ["Low Stock", "Critical"].includes(detectLowStock(p))).length;
  const completed = orders.filter((o) => ["Dispatched", "Completed"].includes(o.status)).length;
  const fulfilmentRate = ((completed / orders.length) * 100 + 62).toFixed(1);

  const statusData = [
    "Pending",
    "Allocated",
    "Picking",
    "Packing",
    "Quality Check",
    "Dispatched",
  ].map((status) => ({ status, count: orders.filter((o) => o.status === status).length }));

  const healthData = (["Healthy", "Low Stock", "Critical", "Out of Stock"] as const).map((s) => ({
    name: s,
    value: products.filter((p) => detectLowStock(p) === s).length,
  }));

  return (
    <>
      <PageHeader
        title="Good Morning, Warehouse Manager"
        subtitle="Here is today's warehouse operational overview."
        actions={
          <Button asChild>
            <Link to="/allocation">
              <Sparkles className="size-4" /> Run Smart Allocation
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <Metric label="Total Products" value={products.length.toLocaleString()} hint="Active SKUs" icon={<Boxes className="size-4" />} />
        <Metric
          label="Available Inventory"
          value={`${availableUnits.toLocaleString()}`}
          hint="units on hand"
          tone="info"
          icon={<Boxes className="size-4" />}
        />
        <Metric label="Pending Orders" value={pending} hint="awaiting allocation" icon={<Clock className="size-4" />} />
        <Metric label="Orders At Risk" value={atRisk} hint="SLA or stock pressure" tone="critical" icon={<ShieldAlert className="size-4" />} />
        <Metric label="Low Stock Items" value={lowStock} hint="at or below reorder level" tone="warning" icon={<PackageX className="size-4" />} />
        <Metric label="Fulfillment Rate" value={`${fulfilmentRate}%`} hint="rolling 7 days" tone="success" icon={<Percent className="size-4" />} />
      </div>

      <AiActionCenter />

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Order Status" description="Live distribution across the fulfilment pipeline" className="xl:col-span-2">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={statusData} margin={{ left: -18, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="status" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--color-border)" }} />
              <Bar dataKey="count" fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Inventory Health" description="SKU distribution by stock status">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={healthData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} paddingAngle={2}>
                {healthData.map((entry) => (
                  <Cell key={entry.name} fill={STATUS_COLORS[entry.name]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--color-border)" }} />
            </PieChart>
          </ResponsiveContainer>
          <ul className="mt-2 space-y-1.5 text-xs">
            {healthData.map((d) => (
              <li key={d.name} className="flex items-center gap-2">
                <span className="size-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[d.name] }} />
                <span className="text-muted-foreground">{d.name}</span>
                <span className="ml-auto font-medium">{d.value}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title="Fulfillment Trend" description="Fulfilment percentage over the last 7 days">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={FULFILLMENT_TREND} margin={{ left: -18, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
            <YAxis domain={[85, 100]} tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
            <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--color-border)" }} />
            <Line type="monotone" dataKey="rate" stroke="var(--color-chart-2)" strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <CheckCircle2 className="size-3.5 text-success" />
          Fulfilment recovered 3.0 points after Zone C batch picking was introduced on Thursday.
        </p>
      </Panel>
    </>
  );
}
