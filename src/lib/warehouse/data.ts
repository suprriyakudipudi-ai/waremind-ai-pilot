import type { Order, OrderItem, PickTask, Priority, Product, WarehouseException, Zone } from "./types";
import { calculatePriority } from "./engine";

/** Deterministic PRNG so mock data is stable between server render and hydration. */
function makeRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const CATEGORIES = [
  "Electronics",
  "Accessories",
  "Home & Kitchen",
  "Industrial",
  "Office Supplies",
  "Apparel",
  "Sports",
];

const NOUNS: Record<string, string[]> = {
  Electronics: ["Laptop", "4K Monitor", "Tablet", "Smart Speaker", "Action Camera", "Router"],
  Accessories: ["Wireless Keyboard", "USB-C Hub", "Ergonomic Mouse", "Laptop Sleeve", "Cable Kit"],
  "Home & Kitchen": ["Air Fryer", "Coffee Grinder", "Blender", "Ceramic Cookware", "Vacuum Flask"],
  Industrial: ["Torque Wrench", "Safety Helmet", "Pallet Jack", "Barcode Scanner", "Work Gloves"],
  "Office Supplies": ["Desk Organizer", "Whiteboard", "Label Printer", "Paper Ream", "Chair Mat"],
  Apparel: ["Fleece Jacket", "Running Shoes", "Cotton T-Shirt", "Rain Poncho", "Beanie"],
  Sports: ["Yoga Mat", "Dumbbell Set", "Cycling Helmet", "Tennis Racket", "Water Bottle"],
};

const BRANDS = ["Nova", "Halo", "Vertex", "Orbit", "Lumen", "Atlas", "Pulse", "Zenith"];
const ZONES: Zone[] = ["Zone A", "Zone B", "Zone C", "Zone D"];
export const WAREHOUSES = ["WH-North (Pune)", "WH-Central (Hyderabad)", "WH-South (Chennai)"];
const CUSTOMERS = [
  "Meridian Retail",
  "BlueCart Logistics",
  "Kestrel Electronics",
  "Northwind Traders",
  "Sunrise Grocers",
  "Vector Industrial",
  "Lumina Stores",
  "Ironclad Supplies",
  "Peak Outfitters",
  "Cobalt Systems",
];
export const PICKERS = ["A. Rao", "M. Iqbal", "S. Nair", "J. Fernandes", "R. Patel", "Unassigned"];

export function buildProducts(): Product[] {
  const rnd = makeRng(20260818);
  const products: Product[] = [];
  for (let i = 0; i < 124; i++) {
    const category = CATEGORIES[i % CATEGORIES.length]!;
    const nouns = NOUNS[category]!;
    const name = `${BRANDS[Math.floor(rnd() * BRANDS.length)]!} ${nouns[Math.floor(rnd() * nouns.length)]!}`;
    const zone = ZONES[Math.floor(rnd() * ZONES.length)]!;
    const reorderLevel = 20 + Math.floor(rnd() * 60);
    const roll = rnd();
    let available: number;
    if (roll < 0.06) available = 0;
    else if (roll < 0.18) available = Math.floor(reorderLevel * 0.35);
    else if (roll < 0.32) available = reorderLevel - Math.floor(rnd() * 8);
    else available = reorderLevel + 20 + Math.floor(rnd() * 400);
    const avgDailyDemand = 4 + Math.floor(rnd() * 26);
    products.push({
      id: `P-${100 + i}`,
      name,
      sku: `SKU-${category.slice(0, 2).toUpperCase()}-${1000 + i}`,
      category,
      warehouse: WAREHOUSES[Math.floor(rnd() * WAREHOUSES.length)]!,
      zone,
      location: `${zone.slice(-1)}-${String(1 + Math.floor(rnd() * 24)).padStart(2, "0")}-${String(
        1 + Math.floor(rnd() * 9),
      ).padStart(2, "0")}`,
      available,
      reserved: Math.floor(rnd() * Math.max(1, available * 0.15)),
      damaged: rnd() < 0.2 ? 1 + Math.floor(rnd() * 4) : 0,
      reorderLevel,
      incoming: rnd() < 0.45 ? 50 + Math.floor(rnd() * 200) : 0,
      incomingEta: `${1 + Math.floor(rnd() * 5)} days`,
      avgDailyDemand,
      unitPrice: 250 + Math.floor(rnd() * 40) * 75,
      demandTrend: Array.from({ length: 7 }, () =>
        Math.max(1, avgDailyDemand + Math.floor((rnd() - 0.5) * avgDailyDemand)),
      ),
    });
  }
  // Demo scenario anchor product.
  products[4] = {
    ...products[4]!,
    id: "P-104",
    name: "Vertex Wireless Keyboard",
    sku: "SKU-AC-1004",
    category: "Accessories",
    zone: "Zone B",
    location: "B-04-02",
    available: 7,
    reserved: 0,
    damaged: 0,
    reorderLevel: 45,
    incoming: 100,
    incomingEta: "2 days",
    avgDailyDemand: 15,
    demandTrend: [12, 14, 18, 15, 17, 16, 15],
  };
  return products;
}

const STATUS_POOL: Order["status"][] = [
  "Pending",
  "Pending",
  "Allocated",
  "Picking",
  "Packing",
  "Quality Check",
  "Ready to Dispatch",
  "Dispatched",
  "Completed",
  "Completed",
  "Exception",
];

export function buildOrders(products: Product[]): Order[] {
  const rnd = makeRng(776611);
  const orders: Order[] = [];
  for (let i = 0; i < 214; i++) {
    const itemCount = 1 + Math.floor(rnd() * 3);
    const items: OrderItem[] = [];
    for (let k = 0; k < itemCount; k++) {
      const p = products[Math.floor(rnd() * products.length)]!;
      if (items.some((it) => it.productId === p.id)) continue;
      items.push({
        productId: p.id,
        productName: p.name,
        sku: p.sku,
        zone: p.zone,
        location: p.location,
        required: 1 + Math.floor(rnd() * 12),
        allocated: 0,
        unitPrice: p.unitPrice,
      });
    }
    const status = STATUS_POOL[Math.floor(rnd() * STATUS_POOL.length)]!;
    const order: Order = {
      id: `ORD-${1000 + i}`,
      customer: CUSTOMERS[Math.floor(rnd() * CUSTOMERS.length)]!,
      customerTier: rnd() < 0.18 ? "Platinum" : rnd() < 0.5 ? "Gold" : "Standard",
      createdAt: `${1 + Math.floor(rnd() * 22)}h ago`,
      deadlineHours: 1 + Math.floor(rnd() * 72),
      items,
      status,
      priority: "Medium",
      priorityScore: 50,
      onHold: false,
      notes: [],
      zone: items[0]?.zone ?? "Zone A",
    };
    if (["Allocated", "Picking", "Packing", "Quality Check", "Ready to Dispatch", "Dispatched", "Completed"].includes(status)) {
      order.items = order.items.map((it) => ({ ...it, allocated: it.required }));
    }
    orders.push(order);
  }

  // ---- Demo scenario orders -------------------------------------------------
  const kb = products.find((p) => p.id === "P-104")!;
  const demoItem = (required: number): OrderItem => ({
    productId: kb.id,
    productName: kb.name,
    sku: kb.sku,
    zone: kb.zone,
    location: kb.location,
    required,
    allocated: 0,
    unitPrice: kb.unitPrice,
  });
  const idx1024 = orders.findIndex((o) => o.id === "ORD-1024");
  orders[idx1024] = {
    id: "ORD-1024",
    customer: "Kestrel Electronics",
    customerTier: "Platinum",
    createdAt: "40m ago",
    deadlineHours: 2,
    items: [demoItem(10)],
    status: "Pending",
    priority: "Critical",
    priorityScore: 91,
    onHold: false,
    notes: [],
    zone: "Zone B",
  };
  const idx1051 = orders.findIndex((o) => o.id === "ORD-1051");
  orders[idx1051] = {
    id: "ORD-1051",
    customer: "Sunrise Grocers",
    customerTier: "Standard",
    createdAt: "3h ago",
    deadlineHours: 46,
    items: [demoItem(5)],
    status: "Pending",
    priority: "Medium",
    priorityScore: 48,
    onHold: false,
    notes: [],
    zone: "Zone B",
  };

  return orders.map((o) => {
    const scored = calculatePriority(o, products);
    return { ...o, priority: scored.priority, priorityScore: scored.total };
  });
}

export function buildPickTasks(orders: Order[]): PickTask[] {
  const rnd = makeRng(31337);
  return orders
    .filter((o) => ["Allocated", "Picking", "Packing", "Quality Check"].includes(o.status))
    .slice(0, 34)
    .map((o, i) => {
      const base = o.status === "Allocated" ? "Waiting" : "In Progress";
      const status: PickTask["status"] =
        o.status === "Picking" ? (rnd() < 0.25 ? "Delayed" : "In Progress") : o.status === "Allocated" ? (base as PickTask["status"]) : "Completed";
      const est = 8 + Math.floor(rnd() * 16);
      return {
        id: `PT-${2000 + i}`,
        orderId: o.id,
        picker: PICKERS[Math.floor(rnd() * PICKERS.length)]!,
        zone: o.zone,
        items: o.items.length,
        priority: o.priority as Priority,
        estimatedMinutes: est,
        actualMinutes: status === "Completed" ? est + Math.floor((rnd() - 0.35) * 10) : 0,
        status,
      };
    });
}

export function buildExceptions(orders: Order[]): WarehouseException[] {
  const rnd = makeRng(90210);
  const types: WarehouseException["type"][] = [
    "Damaged Item",
    "Missing Item",
    "Wrong Item",
    "Insufficient Stock",
    "Picking Delay",
    "Packing Failure",
    "Dispatch Delay",
  ];
  const exceptionOrders = orders.filter((o) => o.status === "Exception").slice(0, 11);
  const list = exceptionOrders.map((o, i) => {
    const type = types[Math.floor(rnd() * types.length)]!;
    const item = o.items[0];
    return {
      id: `EXC-${300 + i}`,
      orderId: o.id,
      productId: item?.productId ?? "P-100",
      productName: item?.productName ?? "Unknown item",
      quantity: 1 + Math.floor(rnd() * 3),
      type,
      severity: (o.priority === "Critical" ? "Critical" : rnd() < 0.5 ? "High" : "Medium") as WarehouseException["severity"],
      detectedAt: `${1 + Math.floor(rnd() * 9)}h ago`,
      status: "Open" as const,
      recommendation: "",
    };
  });
  list.unshift({
    id: "EXC-299",
    orderId: "ORD-1008",
    productId: "P-100",
    productName: "Nova Laptop",
    quantity: 1,
    type: "Damaged Item",
    severity: "High",
    detectedAt: "25m ago",
    status: "Open",
    recommendation: "",
  });
  return list;
}

export const FULFILLMENT_TREND = [
  { day: "Mon", rate: 91.4, orders: 168 },
  { day: "Tue", rate: 92.8, orders: 181 },
  { day: "Wed", rate: 90.2, orders: 205 },
  { day: "Thu", rate: 93.6, orders: 194 },
  { day: "Fri", rate: 94.9, orders: 221 },
  { day: "Sat", rate: 95.4, orders: 176 },
  { day: "Sun", rate: 94.2, orders: 149 },
];

export const ZONE_PERFORMANCE = [
  { zone: "Zone A", avgPickMinutes: 12, tasks: 62 },
  { zone: "Zone B", avgPickMinutes: 22, tasks: 78 },
  { zone: "Zone C", avgPickMinutes: 13, tasks: 54 },
  { zone: "Zone D", avgPickMinutes: 11, tasks: 41 },
];