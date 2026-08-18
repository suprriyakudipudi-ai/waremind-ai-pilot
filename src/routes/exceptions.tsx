import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, Metric, PageHeader, Panel } from "@/components/warehouse/Primitives";
import { StatusBadge } from "@/components/warehouse/StatusBadge";
import { useWarehouse } from "@/lib/warehouse/store";

export const Route = createFileRoute("/exceptions")({
  head: () => ({
    meta: [
      { title: "Exception Center | WareMind AI" },
      {
        name: "description",
        content: "Damaged, missing and short-stock exceptions with an AI-recommended resolution for every case.",
      },
      { property: "og:title", content: "Exception Center | WareMind AI" },
      { property: "og:description", content: "Exception → Decision → Resolution for every fulfilment blocker." },
    ],
  }),
  component: ExceptionsPage,
});

function ExceptionsPage() {
  const { exceptions, closeException } = useWarehouse();
  const [filter, setFilter] = useState("All");

  const rows = exceptions.filter((e) => filter === "All" || e.type === filter);
  const open = exceptions.filter((e) => e.status === "Open").length;
  const escalated = exceptions.filter((e) => e.status === "Escalated").length;
  const resolved = exceptions.filter((e) => e.status === "Resolved").length;

  return (
    <>
      <PageHeader title="Exception Center" subtitle="Every blocker, its root cause and the recommended resolution." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Open" value={open} tone="critical" icon={<ShieldAlert className="size-4" />} />
        <Metric label="Escalated" value={escalated} tone="warning" />
        <Metric label="Resolved" value={resolved} tone="success" />
        <Metric label="Total logged" value={exceptions.length} />
      </div>

      <Panel bodyClassName="p-4">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[240px]" aria-label="Exception type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["All", "Damaged Item", "Missing Item", "Wrong Item", "Insufficient Stock", "Picking Delay", "Packing Failure", "Dispatch Delay"].map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Panel>

      {rows.length === 0 ? (
        <Panel>
          <EmptyState title="No exceptions of this type" description="Operations are running clean for this category." />
        </Panel>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {rows.map((e) => (
            <Panel
              key={e.id}
              title={`${e.id} · ${e.type}`}
              description={`${e.orderId} · ${e.productName ?? "—"} · ${e.quantity} unit(s) · detected ${e.detectedAt}`}
              actions={
                <div className="flex items-center gap-2">
                  <StatusBadge value={e.severity} />
                  <StatusBadge value={e.status} />
                </div>
              }
            >
              <div className="space-y-3 text-sm">
                <Step label="Exception" text={`${e.type} detected on ${e.orderId}.`} tone="critical" />
                <Step label="Decision" text={e.recommendation} tone="info" />
                <Step label="Resolution" text={e.resolution ?? "Awaiting approval — apply the recommended action to close this exception."} tone={e.resolution ? "success" : "neutral"} />
              </div>
              {e.status === "Open" && (
                <Button className="mt-4" onClick={() => closeException(e.id)}>
                  Apply recommended resolution
                </Button>
              )}
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}

function Step({ label, text, tone }: { label: string; text: string; tone: "critical" | "info" | "success" | "neutral" }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3">
      <StatusBadge value={label} tone={tone} dot={false} />
      <p className="mt-2 text-xs">{text}</p>
    </div>
  );
}