import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { EmptyState, PageHeader, Panel } from "@/components/warehouse/Primitives";
import { StatusBadge } from "@/components/warehouse/StatusBadge";
import { useWarehouse } from "@/lib/warehouse/store";

export const Route = createFileRoute("/packing")({
  head: () => ({
    meta: [
      { title: "Packing & Quality Check | WareMind AI" },
      {
        name: "description",
        content: "Verify packing checklists and quality gates before dispatch, and raise exceptions when checks fail.",
      },
      { property: "og:title", content: "Packing & Quality Check | WareMind AI" },
      { property: "og:description", content: "Checklist-driven packing and QC with exception routing." },
    ],
  }),
  component: PackingPage,
});

const PACK_CHECKS = ["Product quantity verified", "Correct product verified", "Packaging verified", "Barcode verified"];
const QC_CHECKS = ["Product condition", "Quantity", "Packaging", "Damage check"];

function PackingPage() {
  const { orders, advanceOrder, raiseException } = useWarehouse();
  const queue = orders.filter((o) => ["Packing", "Quality Check", "Allocated", "Picking"].includes(o.status)).slice(0, 8);

  return (
    <>
      <PageHeader title="Packing & Quality Check" subtitle="Every order must clear both gates before it can be dispatched." />
      {queue.length === 0 ? (
        <Panel>
          <EmptyState title="Nothing waiting to be packed" description="Orders will appear here once picking completes." />
        </Panel>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          {queue.map((o) => (
            <PackCard
              key={o.id}
              orderId={o.id}
              customer={o.customer}
              status={o.status}
              productName={o.items[0]?.productName ?? "—"}
              productId={o.items[0]?.productId}
              onApprove={() => advanceOrder(o.id)}
              onException={() =>
                raiseException({
                  orderId: o.id,
                  type: "Damaged Item",
                  productId: o.items[0]?.productId,
                  productName: o.items[0]?.productName,
                  quantity: 1,
                })
              }
            />
          ))}
        </div>
      )}
    </>
  );
}

function PackCard({
  orderId,
  customer,
  status,
  productName,
  onApprove,
  onException,
}: {
  orderId: string;
  customer: string;
  status: string;
  productName: string;
  productId?: string | undefined;
  onApprove: () => void;
  onException: () => void;
}) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const all = [...PACK_CHECKS, ...QC_CHECKS];
  const done = all.filter((c) => checked[c]).length;
  const complete = done === all.length;

  return (
    <Panel
      title={`${orderId} · ${customer}`}
      description={productName}
      actions={<StatusBadge value={complete ? "Ready" : status} tone={complete ? "success" : undefined} />}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Checklist title="Packing checklist" items={PACK_CHECKS} checked={checked} setChecked={setChecked} />
        <Checklist title="Quality check" items={QC_CHECKS} checked={checked} setChecked={setChecked} />
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        {done}/{all.length} checks complete
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button disabled={!complete} onClick={onApprove}>
          Approve & Move to Dispatch
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline">Create Exception</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Raise an exception on {orderId}?</AlertDialogTitle>
              <AlertDialogDescription>
                The order will move to the exception centre, where WareMind AI checks replacement stock and recommends a resolution.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onException}>Create exception</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Panel>
  );
}

function Checklist({
  title,
  items,
  checked,
  setChecked,
}: {
  title: string;
  items: string[];
  checked: Record<string, boolean>;
  setChecked: (fn: (prev: Record<string, boolean>) => Record<string, boolean>) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item} className="flex items-center gap-2.5">
            <Checkbox
              id={`${title}-${item}`}
              checked={!!checked[item]}
              onCheckedChange={(v) => setChecked((prev) => ({ ...prev, [item]: !!v }))}
            />
            <label htmlFor={`${title}-${item}`} className="text-sm">
              {item}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}