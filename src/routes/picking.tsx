import { createFileRoute } from "@tanstack/react-router";
import { Layers, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, Metric, PageHeader, Panel } from "@/components/warehouse/Primitives";
import { StatusBadge } from "@/components/warehouse/StatusBadge";
import { useWarehouse } from "@/lib/warehouse/store";
import { optimizePicking } from "@/lib/warehouse/engine";
import { PICKERS, ZONE_PERFORMANCE } from "@/lib/warehouse/data";
import { toast } from "sonner";

export const Route = createFileRoute("/picking")({
  head: () => ({
    meta: [
      { title: "Picking Operations | WareMind AI" },
      {
        name: "description",
        content: "Assign pickers, track pick tasks by zone and create batch picks that cut walking distance.",
      },
      { property: "og:title", content: "Picking Operations | WareMind AI" },
      { property: "og:description", content: "Zone-aware picking management with batch pick recommendations." },
    ],
  }),
  component: PickingPage,
});

function PickingPage() {
  const { pickTasks, assignPicker, setTaskStatus } = useWarehouse();
  const opt = optimizePicking(pickTasks);

  const counts = {
    waiting: pickTasks.filter((t) => t.status === "Waiting").length,
    inProgress: pickTasks.filter((t) => t.status === "In Progress").length,
    delayed: pickTasks.filter((t) => t.status === "Delayed").length,
    completed: pickTasks.filter((t) => t.status === "Completed").length,
  };

  return (
    <>
      <PageHeader title="Picking" subtitle="Live pick tasks, picker assignment and route optimisation." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Waiting" value={counts.waiting} hint="unassigned tasks" />
        <Metric label="In Progress" value={counts.inProgress} tone="info" />
        <Metric label="Delayed" value={counts.delayed} tone="warning" />
        <Metric label="Completed today" value={counts.completed} tone="success" />
      </div>

      {opt && (
        <Panel title="Batch picking recommendation" actions={<StatusBadge value="Optimization" tone="info" />}>
          <p className="text-sm">{opt.message}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Orders in scope: {opt.orderIds.slice(0, 6).join(", ")} · estimated saving {opt.timeSavingMinutes} picking minutes.
          </p>
          <Button
            className="mt-4"
            onClick={() =>
              toast.success("Batch pick created", {
                description: `${opt.orderIds.length} orders grouped into one route in ${opt.zone}.`,
              })
            }
          >
            <Layers className="size-4" /> Create Batch Pick
          </Button>
        </Panel>
      )}

      <Panel title="Warehouse zone map" description="Relative pick performance by zone">
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {ZONE_PERFORMANCE.map((z) => (
            <div key={z.zone} className="rounded-xl border border-border bg-muted/40 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <MapPin className="size-4 text-primary" /> {z.zone}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{z.tasks} tasks</p>
              <p className="text-xs text-muted-foreground">avg {z.avgPickMinutes} min/pick</p>
              <div className="mt-2">
                <StatusBadge value={z.avgPickMinutes > 18 ? "Bottleneck" : "Healthy"} tone={z.avgPickMinutes > 18 ? "warning" : "success"} />
              </div>
            </div>
          ))}
          <div className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">Packing Area</div>
          <div className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">Dispatch Area</div>
        </div>
      </Panel>

      <Panel title={`${pickTasks.length} pick tasks`} bodyClassName="p-0">
        {pickTasks.length === 0 ? (
          <div className="p-5">
            <EmptyState title="No pick tasks in the queue" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  {["Task", "Order", "Picker", "Zone", "Items", "Priority", "Est. time", "Status", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pickTasks.map((t) => (
                  <tr key={t.id} className="border-t border-border hover:bg-muted/40">
                    <td className="px-4 py-3 font-medium">{t.id}</td>
                    <td className="px-4 py-3">{t.orderId}</td>
                    <td className="px-4 py-3">
                      <Select value={t.picker} onValueChange={(v) => assignPicker(t.id, v)}>
                        <SelectTrigger className="h-8 w-[150px]" aria-label="Assign picker">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PICKERS.map((p) => (
                            <SelectItem key={p} value={p}>
                              {p}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{t.zone}</td>
                    <td className="px-4 py-3">{t.items}</td>
                    <td className="px-4 py-3">
                      <StatusBadge value={t.priority} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{t.estimatedMinutes} min</td>
                    <td className="px-4 py-3">
                      <StatusBadge value={t.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {t.status !== "Completed" ? (
                        <Button size="sm" variant="outline" onClick={() => setTaskStatus(t.id, t.status === "Waiting" || t.status === "Assigned" ? "In Progress" : "Completed")}>
                          {t.status === "Waiting" || t.status === "Assigned" ? "Start" : "Complete"}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Done</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}