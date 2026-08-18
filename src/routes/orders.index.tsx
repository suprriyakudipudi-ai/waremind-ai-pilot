import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, PageHeader, Panel } from "@/components/warehouse/Primitives";
import { StatusBadge } from "@/components/warehouse/StatusBadge";
import { useWarehouse } from "@/lib/warehouse/store";
import { formatCurrency, isOrderAtRisk, orderValue } from "@/lib/warehouse/engine";

export const Route = createFileRoute("/orders/")({
  head: () => ({
    meta: [
      { title: "Order Management | WareMind AI" },
      {
        name: "description",
        content: "Every open order with priority score, inventory status, fulfilment stage and risk flag in one operational table.",
      },
      { property: "og:title", content: "Order Management | WareMind AI" },
      { property: "og:description", content: "Priority-scored order book with live fulfilment status and risk." },
    ],
  }),
  component: OrdersPage,
});

const STATUSES = [
  "All",
  "Pending",
  "Allocated",
  "Picking",
  "Packing",
  "Quality Check",
  "Ready to Dispatch",
  "Dispatched",
  "Completed",
  "Exception",
];

function OrdersPage() {
  const { orders, products } = useWarehouse();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [priority, setPriority] = useState("All");
  const [riskOnly, setRiskOnly] = useState(false);

  const rows = useMemo(
    () =>
      orders
        .filter((o) => {
          const q = query.toLowerCase();
          return (
            (!q || o.id.toLowerCase().includes(q) || o.customer.toLowerCase().includes(q)) &&
            (status === "All" || o.status === status) &&
            (priority === "All" || o.priority === priority) &&
            (!riskOnly || isOrderAtRisk(o, products))
          );
        })
        .sort((a, b) => b.priorityScore - a.priorityScore),
    [orders, products, query, status, priority, riskOnly],
  );

  return (
    <>
      <PageHeader
        title="Orders"
        subtitle={`${orders.length} orders in the current fulfilment book`}
        actions={
          <Button variant={riskOnly ? "default" : "outline"} onClick={() => setRiskOnly((v) => !v)}>
            {riskOnly ? "Showing at-risk only" : "Show at-risk only"}
          </Button>
        }
      />

      <Panel bodyClassName="p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <Input placeholder="Search order ID or customer" value={query} onChange={(e) => setQuery(e.target.value)} />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger aria-label="Fulfilment status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger aria-label="Priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["All", "Critical", "High", "Medium", "Low"].map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Panel>

      <Panel title={`${rows.length} orders`} bodyClassName="p-0">
        {rows.length === 0 ? (
          <div className="p-5">
            <EmptyState title="No orders match these filters" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  {["Order", "Customer", "Created", "Deadline", "Items", "Value", "Priority", "Inventory", "Fulfilment", "Risk", ""].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-3 text-left font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 60).map((o) => {
                  const short = o.items.some((it) => {
                    const p = products.find((pr) => pr.id === it.productId);
                    return it.allocated === 0 && (!p || p.available < it.required);
                  });
                  const risk = isOrderAtRisk(o, products);
                  return (
                    <tr key={o.id} className="border-t border-border transition-colors hover:bg-muted/40">
                      <td className="px-4 py-3 font-medium">{o.id}</td>
                      <td className="px-4 py-3">
                        {o.customer}
                        <span className="ml-2 text-xs text-muted-foreground">{o.customerTier}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{o.createdAt}</td>
                      <td className="px-4 py-3 text-muted-foreground">in {o.deadlineHours}h</td>
                      <td className="px-4 py-3">{o.items.length}</td>
                      <td className="px-4 py-3">{formatCurrency(orderValue(o))}</td>
                      <td className="px-4 py-3">
                        <StatusBadge value={o.priority} />
                        <span className="ml-2 text-xs text-muted-foreground">{o.priorityScore}</span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge value={short ? "Shortage" : "Sufficient"} tone={short ? "critical" : "success"} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge value={o.onHold ? "On Hold" : o.status} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge value={risk ? "At Risk" : "On Track"} tone={risk ? "warning" : "success"} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button asChild size="sm" variant="outline">
                          <Link to="/orders/$orderId" params={{ orderId: o.id }}>
                            View
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}