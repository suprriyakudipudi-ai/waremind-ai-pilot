import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PlayCircle, PauseCircle, PackageCheck, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { EmptyState, PageHeader, Panel } from "@/components/warehouse/Primitives";
import { StatusBadge } from "@/components/warehouse/StatusBadge";
import { useWarehouse } from "@/lib/warehouse/store";
import { calculatePriority, isOrderAtRisk } from "@/lib/warehouse/engine";
import type { AllocationResult } from "@/lib/warehouse/types";

export const Route = createFileRoute("/allocation")({
  head: () => ({
    meta: [
      { title: "Smart Allocation Engine | WareMind AI" },
      {
        name: "description",
        content: "Run the allocation engine to assign scarce stock to the highest-priority orders with transparent decision reasoning.",
      },
      { property: "og:title", content: "Smart Allocation Engine | WareMind AI" },
      { property: "og:description", content: "Priority-driven stock allocation with explainable decisions." },
    ],
  }),
  component: AllocationPage,
});

function AllocationPage() {
  const { orders, products, runAllocation, approveAllocation, holdOrder } = useWarehouse();
  const [result, setResult] = useState<AllocationResult | null>(null);
  const [running, setRunning] = useState(false);

  const queue = orders
    .filter((o) => ["Pending", "Created", "Exception"].includes(o.status) && !o.onHold)
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 12);

  const run = (orderId: string) => {
    setRunning(true);
    setResult(null);
    window.setTimeout(() => {
      setResult(runAllocation(orderId));
      setRunning(false);
    }, 550);
  };

  return (
    <>
      <PageHeader
        title="Smart Allocation"
        subtitle="Exception → Decision → Resolution. Allocate scarce stock to the orders that matter most."
        actions={
          <Button onClick={() => run(queue[0]?.id ?? "ORD-1024")} disabled={running || queue.length === 0}>
            <PlayCircle className="size-4" /> {running ? "Running engine…" : "Run Smart Allocation"}
          </Button>
        }
      />

      <Panel title="Allocation queue" description="Orders awaiting an inventory decision, ranked by priority score" bodyClassName="p-0">
        {queue.length === 0 ? (
          <div className="p-5">
            <EmptyState title="Allocation queue is clear" description="Every open order already has stock assigned." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  {["Order", "Product", "Required", "Available", "Priority", "Deadline", "Risk", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {queue.map((o) => {
                  const item = o.items[0]!;
                  const p = products.find((pr) => pr.id === item.productId);
                  const required = o.items.reduce((s, i) => s + i.required, 0);
                  return (
                    <tr key={o.id} className="border-t border-border hover:bg-muted/40">
                      <td className="px-4 py-3 font-medium">{o.id}</td>
                      <td className="px-4 py-3">{item.productName}</td>
                      <td className="px-4 py-3">{required}</td>
                      <td className="px-4 py-3">{p?.available ?? 0}</td>
                      <td className="px-4 py-3">
                        <StatusBadge value={o.priority} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">in {o.deadlineHours}h</td>
                      <td className="px-4 py-3">
                        <StatusBadge value={isOrderAtRisk(o, products) ? "At Risk" : "On Track"} tone={isOrderAtRisk(o, products) ? "warning" : "success"} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="outline" onClick={() => run(o.id)}>
                          Allocate
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

      {running && (
        <Panel title="Decision engine running">
          <Progress value={66} className="h-2" />
          <p className="mt-3 text-xs text-muted-foreground">Scoring priority, checking stock ledger, evaluating conflicting demand…</p>
        </Panel>
      )}

      {result && !running && <AllocationDecision result={result} onApprove={() => { approveAllocation(result); setResult(null); }} onHold={holdOrder} />}
    </>
  );
}

function AllocationDecision({
  result,
  onApprove,
  onHold,
}: {
  result: AllocationResult;
  onApprove: () => void;
  onHold: (orderId: string, reason: string) => void;
}) {
  const { orders, products } = useWarehouse();
  const order = orders.find((o) => o.id === result.orderId)!;
  const breakdown = calculatePriority(order, products);

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <Panel
        title={`Decision for ${result.orderId}`}
        description={breakdown.explanation}
        className="xl:col-span-2"
        actions={<StatusBadge value={result.fullyAllocated ? "Full allocation" : "Partial allocation"} tone={result.fullyAllocated ? "success" : "critical"} />}
      >
        {!result.fullyAllocated && (
          <div className="mb-4 rounded-xl border border-critical/30 bg-critical/8 p-4">
            <p className="text-sm font-semibold text-critical">🚨 Stock shortage detected</p>
            <p className="mt-1 text-sm">
              {result.shortageTotal} unit(s) are unavailable for a {result.priority} order.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Recommended action: allocate all available units now and reserve the next incoming shipment.
            </p>
          </div>
        )}

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {["Product", "Required", "Available", "Allocated", "Shortage", "Incoming reserved"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.lines.map((l) => (
                <tr key={l.productId} className="border-t border-border">
                  <td className="px-4 py-3">{l.productName}</td>
                  <td className="px-4 py-3">{l.required}</td>
                  <td className="px-4 py-3">{l.available}</td>
                  <td className="px-4 py-3 font-medium text-success">{l.allocated}</td>
                  <td className={`px-4 py-3 font-medium ${l.shortage ? "text-critical" : "text-muted-foreground"}`}>{l.shortage}</td>
                  <td className="px-4 py-3">{l.incomingReserved}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="mt-5 text-sm font-semibold">Decision reasoning</h3>
        <ul className="mt-2 space-y-2">
          {result.reasoning.map((r, i) => (
            <li key={i} className="rounded-lg border border-border bg-muted/40 p-3 text-xs">
              {r}
            </li>
          ))}
        </ul>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={onApprove}>
            <PackageCheck className="size-4" /> Approve Allocation
          </Button>
          <Button variant="outline" onClick={onApprove}>
            Modify Allocation
          </Button>
          <Button variant="outline" onClick={() => onHold(result.orderId, "Held pending replenishment decision.")}>
            <PauseCircle className="size-4" /> Hold Order
          </Button>
          <Button variant="outline" onClick={onApprove}>
            <Truck className="size-4" /> Reserve Incoming Stock
          </Button>
        </div>
      </Panel>

      <Panel title="Affected lower-priority orders" description="Orders competing for the same stock">
        {result.heldOrders.length === 0 ? (
          <EmptyState title="No conflicts detected" description="No lower-priority order depends on this stock." />
        ) : (
          <ul className="space-y-3">
            {result.heldOrders.map((h) => (
              <li key={h.orderId} className="rounded-lg border border-warning/30 bg-warning/8 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{h.orderId}</span>
                  <StatusBadge value="On Hold" tone="warning" />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{h.reason}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}