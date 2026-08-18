import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Circle, CircleDot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PageHeader, Panel } from "@/components/warehouse/Primitives";
import { StatusBadge } from "@/components/warehouse/StatusBadge";
import { useWarehouse } from "@/lib/warehouse/store";
import {
  ORDER_FLOW,
  allocateInventory,
  calculatePriority,
  formatCurrency,
  orderValue,
} from "@/lib/warehouse/engine";

export const Route = createFileRoute("/orders/$orderId")({
  head: ({ params }) => ({
    meta: [
      { title: `Order ${params.orderId} | WareMind AI` },
      {
        name: "description",
        content: `Fulfilment timeline, allocation decision and priority reasoning for order ${params.orderId}.`,
      },
      { property: "og:title", content: `Order ${params.orderId} | WareMind AI` },
      { property: "og:description", content: "Order timeline, allocation decision and priority reasoning." },
    ],
  }),
  component: OrderDetail,
});

function OrderDetail() {
  const { orderId } = Route.useParams();
  const { orders, products, advanceOrder, holdOrder, releaseOrder } = useWarehouse();
  const order = orders.find((o) => o.id === orderId);

  if (!order) {
    return (
      <Panel title="Order not found">
        <p className="text-sm text-muted-foreground">No order matches {orderId}.</p>
        <Button asChild className="mt-4">
          <Link to="/orders">Back to orders</Link>
        </Button>
      </Panel>
    );
  }

  const breakdown = calculatePriority(order, products);
  const allocation = allocateInventory(order, products, orders);
  const currentIdx = Math.max(0, ORDER_FLOW.indexOf(order.status));

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link to="/orders">
          <ArrowLeft className="size-4" /> Back to orders
        </Link>
      </Button>

      <PageHeader
        title={`Order ${order.id}`}
        subtitle={`${order.customer} · ${order.customerTier} · deadline in ${order.deadlineHours}h`}
        actions={
          <>
            <StatusBadge value={order.onHold ? "On Hold" : order.status} />
            {order.onHold ? (
              <Button variant="outline" onClick={() => releaseOrder(order.id)}>
                Release hold
              </Button>
            ) : (
              <Button variant="outline" onClick={() => holdOrder(order.id, "Manually held by warehouse manager.")}>
                Hold order
              </Button>
            )}
            <Button onClick={() => advanceOrder(order.id)}>Advance stage</Button>
          </>
        }
      />

      <Panel title="Fulfilment timeline">
        <ol className="flex flex-wrap gap-x-2 gap-y-4">
          {ORDER_FLOW.map((stage, i) => {
            const done = i < currentIdx;
            const active = i === currentIdx;
            return (
              <li key={stage} className="flex min-w-[132px] flex-1 items-start gap-2">
                <span className="mt-0.5">
                  {done ? (
                    <CheckCircle2 className="size-4 text-success" />
                  ) : active ? (
                    <CircleDot className="size-4 text-info" />
                  ) : (
                    <Circle className="size-4 text-muted-foreground" />
                  )}
                </span>
                <div>
                  <p className={`text-xs font-medium ${active ? "text-info" : done ? "text-foreground" : "text-muted-foreground"}`}>{stage}</p>
                  <p className="text-[11px] text-muted-foreground">{done ? "Completed" : active ? "In progress" : "Pending"}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Order items" className="xl:col-span-2" bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  {["Product", "Required", "Available", "Allocated", "Location", "Status"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {order.items.map((it) => {
                  const p = products.find((pr) => pr.id === it.productId);
                  const available = p?.available ?? 0;
                  const ok = it.allocated >= it.required || available >= it.required;
                  return (
                    <tr key={it.productId} className="border-t border-border">
                      <td className="px-4 py-3">
                        {it.productName}
                        <span className="block text-xs text-muted-foreground">{it.sku}</span>
                      </td>
                      <td className="px-4 py-3">{it.required}</td>
                      <td className="px-4 py-3">{available}</td>
                      <td className="px-4 py-3">{it.allocated}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {it.zone} · {it.location}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge value={ok ? "Sufficient" : "Shortage"} tone={ok ? "success" : "critical"} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Customer & value">
          <dl className="space-y-3 text-sm">
            <Row label="Customer" value={order.customer} />
            <Row label="Tier" value={order.customerTier} />
            <Row label="Created" value={order.createdAt} />
            <Row label="Deadline" value={`in ${order.deadlineHours} hours`} />
            <Row label="Order value" value={formatCurrency(orderValue(order))} />
            <Row label="Zone" value={order.zone} />
          </dl>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Priority engine" description={breakdown.explanation}>
          <div className="mb-4 flex items-center gap-3">
            <span className="text-3xl font-semibold">{breakdown.total}</span>
            <span className="text-sm text-muted-foreground">/ 100</span>
            <StatusBadge value={breakdown.priority} className="ml-auto" />
          </div>
          <div className="space-y-3">
            <Factor label="Delivery urgency" value={breakdown.deliveryUrgency} max={35} />
            <Factor label="Customer priority" value={breakdown.customerPriority} max={25} />
            <Factor label="Delay risk" value={breakdown.delayRisk} max={20} />
            <Factor label="Inventory risk" value={breakdown.inventoryRisk} max={10} />
            <Factor label="Order value" value={breakdown.orderValue} max={10} />
          </div>
        </Panel>

        <Panel title="Inventory decision" description="What the allocation engine recommends for this order">
          <StatusBadge
            value={allocation.fullyAllocated ? "Full allocation possible" : `Shortage of ${allocation.shortageTotal} units`}
            tone={allocation.fullyAllocated ? "success" : "critical"}
          />
          <ul className="mt-3 space-y-2 text-sm">
            {allocation.reasoning.map((r, i) => (
              <li key={i} className="rounded-lg border border-border bg-muted/40 p-3 text-xs">
                {r}
              </li>
            ))}
          </ul>
          {order.notes.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium text-muted-foreground">Activity</p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {order.notes.map((n, i) => (
                  <li key={i}>• {n}</li>
                ))}
              </ul>
            </div>
          )}
          <Button asChild className="mt-4">
            <Link to="/allocation">Open Smart Allocation</Link>
          </Button>
        </Panel>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function Factor({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {value}/{max}
        </span>
      </div>
      <Progress value={(value / max) * 100} className="h-2" />
    </div>
  );
}