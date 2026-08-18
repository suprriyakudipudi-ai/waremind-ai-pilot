import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Circle, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, Metric, PageHeader, Panel } from "@/components/warehouse/Primitives";
import { StatusBadge } from "@/components/warehouse/StatusBadge";
import { useWarehouse } from "@/lib/warehouse/store";
import { ORDER_FLOW } from "@/lib/warehouse/engine";

export const Route = createFileRoute("/dispatch")({
  head: () => ({
    meta: [
      { title: "Dispatch Control | WareMind AI" },
      {
        name: "description",
        content: "Track shipments ready to dispatch, confirm handover and release reserved inventory automatically.",
      },
      { property: "og:title", content: "Dispatch Control | WareMind AI" },
      { property: "og:description", content: "Outbound dispatch tracking with live inventory settlement." },
    ],
  }),
  component: DispatchPage,
});

function DispatchPage() {
  const { orders, advanceOrder } = useWarehouse();
  const ready = orders.filter((o) => o.status === "Ready to Dispatch");
  const dispatched = orders.filter((o) => o.status === "Dispatched");
  const delayed = orders.filter((o) => o.status === "Exception" || o.onHold);
  const completed = orders.filter((o) => o.status === "Completed");

  return (
    <>
      <PageHeader title="Dispatch" subtitle="Outbound handover and inventory settlement." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Ready to Dispatch" value={ready.length} tone="info" icon={<Truck className="size-4" />} />
        <Metric label="Dispatching Today" value={Math.min(ready.length, 6)} />
        <Metric label="Dispatched" value={dispatched.length} tone="success" />
        <Metric label="Delayed" value={delayed.length} tone="warning" />
        <Metric label="Completed" value={completed.length} tone="success" />
      </div>

      <Panel title="Ready to dispatch" description="Confirm handover to release reserved stock">
        {ready.length === 0 ? (
          <EmptyState title="Nothing waiting for dispatch" description="Approve packing and QC to move orders here." />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {ready.slice(0, 8).map((o) => (
              <div key={o.id} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{o.id}</p>
                    <p className="text-xs text-muted-foreground">
                      {o.customer} · deadline in {o.deadlineHours}h
                    </p>
                  </div>
                  <StatusBadge value={o.priority} />
                </div>
                <ol className="mt-3 flex flex-wrap gap-3">
                  {ORDER_FLOW.slice(0, 8).map((stage, i) => (
                    <li key={stage} className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      {i < 7 ? <CheckCircle2 className="size-3.5 text-success" /> : <Circle className="size-3.5 text-info" />}
                      {stage}
                    </li>
                  ))}
                </ol>
                <Button className="mt-4" size="sm" onClick={() => advanceOrder(o.id)}>
                  Mark as Dispatched
                </Button>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Recently dispatched" bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {["Order", "Customer", "Items", "Priority", "Status"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dispatched.slice(0, 15).map((o) => (
                <tr key={o.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{o.id}</td>
                  <td className="px-4 py-3">{o.customer}</td>
                  <td className="px-4 py-3">{o.items.length}</td>
                  <td className="px-4 py-3">
                    <StatusBadge value={o.priority} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge value={o.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}