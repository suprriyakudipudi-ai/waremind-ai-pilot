import type {
  AllocationLine,
  AllocationResult,
  ExceptionType,
  Order,
  PickTask,
  Priority,
  Product,
  StockStatus,
  WarehouseException,
} from "./types";

/* ------------------------------------------------------------------ */
/* Priority engine                                                     */
/* ------------------------------------------------------------------ */

export interface PriorityBreakdown {
  deliveryUrgency: number;
  customerPriority: number;
  delayRisk: number;
  inventoryRisk: number;
  orderValue: number;
  total: number;
  priority: Priority;
  explanation: string;
}

export function classifyPriority(score: number): Priority {
  if (score >= 80) return "Critical";
  if (score >= 60) return "High";
  if (score >= 40) return "Medium";
  return "Low";
}

export function orderValue(order: Order) {
  return order.items.reduce((sum, i) => sum + i.required * i.unitPrice, 0);
}

export function calculatePriority(order: Order, products: Product[]): PriorityBreakdown {
  const h = order.deadlineHours;
  const deliveryUrgency = h <= 2 ? 35 : h <= 6 ? 30 : h <= 12 ? 24 : h <= 24 ? 18 : h <= 48 ? 11 : 5;
  const customerPriority = order.customerTier === "Platinum" ? 25 : order.customerTier === "Gold" ? 17 : 9;

  const shortages = order.items.filter((it) => {
    const p = products.find((pr) => pr.id === it.productId);
    return !p || p.available < it.required;
  }).length;
  const inventoryRisk = shortages === 0 ? 10 : shortages === 1 ? 8 : 4;

  const delayRisk =
    order.status === "Exception" ? 20 : order.onHold ? 16 : h <= 6 && order.status === "Pending" ? 18 : h <= 24 ? 12 : 6;

  const value = orderValue(order);
  const orderValueScore = value > 400000 ? 10 : value > 150000 ? 7 : value > 50000 ? 5 : 3;

  const total = deliveryUrgency + customerPriority + delayRisk + inventoryRisk + orderValueScore;
  const priority = classifyPriority(total);

  const reasons: string[] = [];
  if (h <= 2) reasons.push(`delivery deadline is within ${h} hour${h === 1 ? "" : "s"}`);
  else if (h <= 12) reasons.push(`delivery deadline is in ${h} hours`);
  if (order.customerTier === "Platinum") reasons.push("customer is on a Platinum SLA");
  if (shortages > 0) reasons.push(`${shortages} line item${shortages > 1 ? "s have" : " has"} insufficient stock`);
  if (order.status === "Exception") reasons.push("an open exception is blocking fulfilment");

  return {
    deliveryUrgency,
    customerPriority,
    delayRisk,
    inventoryRisk,
    orderValue: orderValueScore,
    total,
    priority,
    explanation:
      reasons.length > 0
        ? `${priority} priority because ${reasons.join(", and ")}.`
        : `${priority} priority — no urgency or inventory pressure detected.`,
  };
}

/* ------------------------------------------------------------------ */
/* Inventory allocation                                                */
/* ------------------------------------------------------------------ */

export function allocateInventory(order: Order, products: Product[], allOrders: Order[]): AllocationResult {
  const lines: AllocationLine[] = [];
  const reasoning: string[] = [];
  const heldOrders: { orderId: string; reason: string }[] = [];

  for (const item of order.items) {
    const product = products.find((p) => p.id === item.productId);
    const available = product?.available ?? 0;

    if (item.required <= available) {
      lines.push({
        productId: item.productId,
        productName: item.productName,
        required: item.required,
        available,
        allocated: item.required,
        shortage: 0,
        incomingReserved: 0,
      });
      reasoning.push(
        `${item.productName}: full quantity of ${item.required} units allocated — available stock (${available}) covers the requirement.`,
      );
      continue;
    }

    const allocated = available;
    const shortage = item.required - available;
    const incoming = product?.incoming ?? 0;
    const incomingReserved = order.priority === "Critical" ? Math.min(shortage, incoming) : 0;

    lines.push({
      productId: item.productId,
      productName: item.productName,
      required: item.required,
      available,
      allocated,
      shortage,
      incomingReserved,
    });

    if (order.priority === "Critical" || order.priority === "High") {
      reasoning.push(
        `${order.id} carries ${order.priority} delivery priority, so all ${allocated} available units of ${item.productName} are allocated to it ahead of lower-priority demand.`,
      );
      reasoning.push(`Remaining shortage of ${shortage} units is flagged and tracked as an open exception.`);
      if (incomingReserved > 0) {
        reasoning.push(
          `${incomingReserved} units from the incoming shipment (ETA ${product?.incomingEta}) are reserved to close the shortage.`,
        );
      } else {
        reasoning.push(`No incoming stock is available for ${item.productName} — escalation to procurement recommended.`);
      }

      for (const other of allOrders) {
        if (other.id === order.id) continue;
        if (["Dispatched", "Completed"].includes(other.status)) continue;
        if (other.priorityScore >= order.priorityScore) continue;
        if (!other.items.some((it) => it.productId === item.productId && it.allocated === 0)) continue;
        heldOrders.push({
          orderId: other.id,
          reason: `Placed on temporary hold — required stock of ${item.productName} overlaps with ${order.priority} order ${order.id}.`,
        });
      }
    } else {
      reasoning.push(
        `${order.id} is ${order.priority} priority. ${allocated} units allocated, ${shortage} units short — stock is held for higher-priority demand until replenishment.`,
      );
    }
  }

  const shortageTotal = lines.reduce((s, l) => s + l.shortage, 0);
  return {
    orderId: order.id,
    priority: order.priority,
    fullyAllocated: shortageTotal === 0,
    lines,
    reasoning,
    heldOrders: heldOrders.slice(0, 4),
    shortageTotal,
  };
}

/* ------------------------------------------------------------------ */
/* Stock health / reorder                                              */
/* ------------------------------------------------------------------ */

export function detectLowStock(product: Product): StockStatus {
  if (product.available === 0) return "Out of Stock";
  if (product.available <= product.reorderLevel * 0.4) return "Critical";
  if (product.available <= product.reorderLevel) return "Low Stock";
  return "Healthy";
}

export interface ReorderRecommendation {
  productId: string;
  daysUntilStockout: number;
  urgent: boolean;
  recommendedQuantity: number;
  message: string;
}

export function calculateReorderRecommendation(product: Product): ReorderRecommendation {
  const demand = Math.max(1, product.avgDailyDemand);
  const days = Math.floor(product.available / demand);
  const recommendedQuantity = Math.max(50, Math.ceil((demand * 14 - product.available) / 10) * 10);
  const urgent = days <= 3;
  return {
    productId: product.id,
    daysUntilStockout: days,
    urgent,
    recommendedQuantity,
    message: urgent
      ? `Critical reorder recommended — ${product.name} covers only ${days} day${days === 1 ? "" : "s"} of demand at ${demand} units/day. Raise a PO for ${recommendedQuantity} units.`
      : `Stock covers ~${days} days of demand. Reorder ${recommendedQuantity} units at the next planning cycle.`,
  };
}

/* ------------------------------------------------------------------ */
/* Bottlenecks & picking optimisation                                  */
/* ------------------------------------------------------------------ */

export interface Bottleneck {
  zone: string;
  avgMinutes: number;
  warehouseAvg: number;
  deltaPercent: number;
  recommendation: string;
  expectedImprovement: string;
}

export function detectBottleneck(zones: { zone: string; avgPickMinutes: number }[]): Bottleneck | null {
  if (zones.length === 0) return null;
  const warehouseAvg = Math.round(zones.reduce((s, z) => s + z.avgPickMinutes, 0) / zones.length);
  const worst = [...zones].sort((a, b) => b.avgPickMinutes - a.avgPickMinutes)[0]!;
  const deltaPercent = Math.round(((worst.avgPickMinutes - warehouseAvg) / warehouseAvg) * 100);
  if (deltaPercent < 15) return null;
  return {
    zone: worst.zone,
    avgMinutes: worst.avgPickMinutes,
    warehouseAvg,
    deltaPercent,
    recommendation: `Move high-demand products in ${worst.zone} closer to the packing station and group open tasks into batch picks.`,
    expectedImprovement: "Estimated picking time reduction: 15–20%.",
  };
}

export interface PickingOptimisation {
  zone: string;
  orderIds: string[];
  distanceSavingPercent: number;
  timeSavingMinutes: number;
  message: string;
}

export function optimizePicking(tasks: PickTask[]): PickingOptimisation | null {
  const open = tasks.filter((t) => t.status === "Waiting" || t.status === "Assigned");
  const byZone = new Map<string, PickTask[]>();
  for (const t of open) byZone.set(t.zone, [...(byZone.get(t.zone) ?? []), t]);
  const best = [...byZone.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  if (!best || best[1].length < 2) return null;
  const [zone, group] = best;
  const distanceSavingPercent = Math.min(48, 12 + group.length * 3);
  const timeSavingMinutes = Math.round(group.reduce((s, t) => s + t.estimatedMinutes, 0) * (distanceSavingPercent / 200));
  return {
    zone,
    orderIds: group.map((t) => t.orderId),
    distanceSavingPercent,
    timeSavingMinutes,
    message: `${group.length} open orders contain products from ${zone}. Batch picking could reduce estimated walking distance by ${distanceSavingPercent}%.`,
  };
}

/* ------------------------------------------------------------------ */
/* Exceptions                                                          */
/* ------------------------------------------------------------------ */

let exceptionCounter = 500;

export function createException(input: {
  orderId: string;
  type: ExceptionType;
  productId?: string | undefined;
  productName?: string | undefined;
  quantity?: number | undefined;
  severity?: WarehouseException["severity"] | undefined;
}): WarehouseException {
  exceptionCounter += 1;
  return {
    id: `EXC-${exceptionCounter}`,
    orderId: input.orderId,
    productId: input.productId,
    productName: input.productName,
    quantity: input.quantity ?? 1,
    type: input.type,
    severity: input.severity ?? "High",
    detectedAt: "just now",
    status: "Open",
    recommendation: "",
  };
}

export function recommendResolution(exception: WarehouseException, products: Product[]): string {
  const product = products.find((p) => p.id === exception.productId);
  const replacement = product && product.available >= exception.quantity;

  switch (exception.type) {
    case "Damaged Item":
    case "Wrong Item":
    case "Missing Item":
      return replacement
        ? `Replacement stock available (${product?.available} units at ${product?.location}). Recommended resolution: replace the affected ${exception.quantity} unit(s) and re-run quality check.`
        : `No replacement stock available. Recommended resolution: escalate to the warehouse manager, notify the order team, and offer a partial dispatch.`;
    case "Insufficient Stock":
      return product && product.incoming > 0
        ? `Reserve ${Math.min(exception.quantity, product.incoming)} units from the incoming shipment (ETA ${product.incomingEta}) and hold lower-priority orders on the same SKU.`
        : `No incoming stock scheduled. Recommended resolution: raise an urgent purchase order and inform the customer of a revised delivery window.`;
    case "Picking Delay":
      return `Reassign the task to an available picker in an adjacent zone and batch remaining tasks in the same aisle to recover the delay.`;
    case "Packing Failure":
      return `Re-pack using the alternate carton spec, re-verify the barcode, and route the order back to quality check.`;
    case "Dispatch Delay":
      return `Move the shipment to the next outbound slot and notify the customer with an updated ETA.`;
    default:
      return `Escalate to the warehouse manager for manual review.`;
  }
}

export function resolveException(exception: WarehouseException, products: Product[]): WarehouseException {
  const product = products.find((p) => p.id === exception.productId);
  const canReplace = product ? product.available >= exception.quantity : false;
  const escalate = ["Damaged Item", "Missing Item", "Wrong Item"].includes(exception.type) && !canReplace;
  return {
    ...exception,
    status: escalate ? "Escalated" : "Resolved",
    resolution: escalate
      ? "Escalated to warehouse manager — no replacement stock on hand. Order team notified."
      : recommendResolution(exception, products),
  };
}

/* ------------------------------------------------------------------ */
/* Derived metrics                                                     */
/* ------------------------------------------------------------------ */

export function isOrderAtRisk(order: Order, products: Product[]): boolean {
  if (["Dispatched", "Completed"].includes(order.status)) return false;
  if (order.status === "Exception" || order.onHold) return true;
  if (order.deadlineHours <= 6 && order.status !== "Ready to Dispatch") return true;
  return order.items.some((it) => {
    const p = products.find((pr) => pr.id === it.productId);
    return it.allocated === 0 && (!p || p.available < it.required);
  });
}

export const ORDER_FLOW: Order["status"][] = [
  "Created",
  "Pending",
  "Allocated",
  "Picking",
  "Packing",
  "Quality Check",
  "Ready to Dispatch",
  "Dispatched",
  "Completed",
];

export function nextStatus(status: Order["status"]): Order["status"] {
  const i = ORDER_FLOW.indexOf(status);
  if (i === -1 || i === ORDER_FLOW.length - 1) return status;
  return ORDER_FLOW[i + 1]!;
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}