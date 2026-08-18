export type StockStatus = "Healthy" | "Low Stock" | "Critical" | "Out of Stock";
export type Priority = "Critical" | "High" | "Medium" | "Low";
export type OrderStatus =
  | "Created"
  | "Pending"
  | "Allocated"
  | "Picking"
  | "Packing"
  | "Quality Check"
  | "Ready to Dispatch"
  | "Dispatched"
  | "Completed"
  | "Exception";
export type Zone = "Zone A" | "Zone B" | "Zone C" | "Zone D";

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  warehouse: string;
  zone: Zone;
  location: string;
  available: number;
  reserved: number;
  damaged: number;
  reorderLevel: number;
  incoming: number;
  incomingEta: string;
  avgDailyDemand: number;
  unitPrice: number;
  demandTrend: number[];
}

export interface OrderItem {
  productId: string;
  productName: string;
  sku: string;
  zone: Zone;
  location: string;
  required: number;
  allocated: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  customer: string;
  customerTier: "Platinum" | "Gold" | "Standard";
  createdAt: string;
  deadlineHours: number;
  items: OrderItem[];
  status: OrderStatus;
  priority: Priority;
  priorityScore: number;
  onHold: boolean;
  holdReason?: string | undefined;
  notes: string[];
  zone: Zone;
}

export interface PickTask {
  id: string;
  orderId: string;
  picker: string;
  zone: Zone;
  items: number;
  priority: Priority;
  estimatedMinutes: number;
  actualMinutes: number;
  status: "Waiting" | "Assigned" | "In Progress" | "Completed" | "Delayed";
}

export type ExceptionType =
  | "Damaged Item"
  | "Missing Item"
  | "Wrong Item"
  | "Insufficient Stock"
  | "Picking Delay"
  | "Packing Failure"
  | "Dispatch Delay";

export interface WarehouseException {
  id: string;
  orderId: string;
  productId?: string | undefined;
  productName?: string | undefined;
  quantity: number;
  type: ExceptionType;
  severity: "Critical" | "High" | "Medium" | "Low";
  detectedAt: string;
  status: "Open" | "In Review" | "Resolved" | "Escalated";
  recommendation: string;
  resolution?: string | undefined;
}

export interface AllocationLine {
  productId: string;
  productName: string;
  required: number;
  available: number;
  allocated: number;
  shortage: number;
  incomingReserved: number;
}

export interface AllocationResult {
  orderId: string;
  priority: Priority;
  fullyAllocated: boolean;
  lines: AllocationLine[];
  reasoning: string[];
  heldOrders: { orderId: string; reason: string }[];
  shortageTotal: number;
}