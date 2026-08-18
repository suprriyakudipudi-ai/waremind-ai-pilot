import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  buildExceptions,
  buildOrders,
  buildPickTasks,
  buildProducts,
} from "./data";
import {
  allocateInventory,
  calculatePriority,
  createException,
  detectLowStock,
  nextStatus,
  recommendResolution,
  resolveException,
} from "./engine";
import type {
  AllocationResult,
  ExceptionType,
  Order,
  PickTask,
  Product,
  WarehouseException,
} from "./types";

interface WarehouseState {
  products: Product[];
  orders: Order[];
  pickTasks: PickTask[];
  exceptions: WarehouseException[];
  warehouse: string;
  setWarehouse: (w: string) => void;
  runAllocation: (orderId: string) => AllocationResult;
  approveAllocation: (result: AllocationResult) => void;
  holdOrder: (orderId: string, reason: string) => void;
  releaseOrder: (orderId: string) => void;
  advanceOrder: (orderId: string) => void;
  setOrderStatus: (orderId: string, status: Order["status"]) => void;
  adjustStock: (productId: string, delta: number) => void;
  addProduct: (p: Partial<Product> & { name: string }) => void;
  assignPicker: (taskId: string, picker: string) => void;
  setTaskStatus: (taskId: string, status: PickTask["status"]) => void;
  raiseException: (input: { orderId: string; type: ExceptionType; productId?: string | undefined; productName?: string | undefined; quantity?: number | undefined }) => void;
  closeException: (exceptionId: string) => void;
}

const WarehouseContext = createContext<WarehouseState | null>(null);

export function WarehouseProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>(() => buildProducts());
  const [orders, setOrders] = useState<Order[]>(() => buildOrders(buildProducts()));
  const [pickTasks, setPickTasks] = useState<PickTask[]>(() => buildPickTasks(buildOrders(buildProducts())));
  const [exceptions, setExceptions] = useState<WarehouseException[]>(() =>
    buildExceptions(buildOrders(buildProducts())).map((e) => ({
      ...e,
      recommendation: recommendResolution(e, buildProducts()),
    })),
  );
  const [warehouse, setWarehouse] = useState("All warehouses");

  const runAllocation = useCallback(
    (orderId: string) => {
      const order = orders.find((o) => o.id === orderId)!;
      return allocateInventory(order, products, orders);
    },
    [orders, products],
  );

  const approveAllocation = useCallback((result: AllocationResult) => {
    setProducts((prev) =>
      prev.map((p) => {
        const line = result.lines.find((l) => l.productId === p.id);
        if (!line) return p;
        return { ...p, available: p.available - line.allocated, reserved: p.reserved + line.allocated };
      }),
    );
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === result.orderId) {
          return {
            ...o,
            status: result.fullyAllocated ? "Allocated" : "Exception",
            items: o.items.map((it) => {
              const line = result.lines.find((l) => l.productId === it.productId);
              return line ? { ...it, allocated: line.allocated } : it;
            }),
            notes: [
              ...o.notes,
              result.fullyAllocated
                ? "Inventory fully allocated by the Smart Allocation engine."
                : `Partially allocated — ${result.shortageTotal} unit(s) short. Shortage exception raised.`,
            ],
          };
        }
        const held = result.heldOrders.find((h) => h.orderId === o.id);
        if (held) return { ...o, onHold: true, holdReason: held.reason, notes: [...o.notes, held.reason] };
        return o;
      }),
    );
    if (!result.fullyAllocated) {
      const line = result.lines.find((l) => l.shortage > 0)!;
      setExceptions((prev) => {
        const exc = createException({
          orderId: result.orderId,
          type: "Insufficient Stock",
          productId: line.productId,
          productName: line.productName,
          quantity: line.shortage,
          severity: result.priority === "Critical" ? "Critical" : "High",
        });
        return [{ ...exc, recommendation: recommendResolution(exc, products) }, ...prev];
      });
    }
    toast.success(`Allocation approved for ${result.orderId}`, {
      description: result.fullyAllocated
        ? "All lines fully allocated and moved to picking queue."
        : `${result.shortageTotal} unit(s) short — shortage exception created and conflicting orders held.`,
    });
  }, [products]);

  const holdOrder = useCallback((orderId: string, reason: string) => {
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, onHold: true, holdReason: reason, notes: [...o.notes, reason] } : o)));
    toast.warning(`${orderId} placed on hold`, { description: reason });
  }, []);

  const releaseOrder = useCallback((orderId: string) => {
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, onHold: false, holdReason: undefined } : o)));
    toast.success(`${orderId} released from hold`);
  }, []);

  const setOrderStatus = useCallback((orderId: string, status: Order["status"]) => {
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
  }, []);

  const advanceOrder = useCallback((orderId: string) => {
    let newStatus: Order["status"] | null = null;
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o;
        newStatus = nextStatus(o.status === "Exception" ? "Allocated" : o.status);
        return { ...o, status: newStatus, notes: [...o.notes, `Moved to ${newStatus}.`] };
      }),
    );
    if (newStatus === "Dispatched") {
      const order = orders.find((o) => o.id === orderId);
      if (order) {
        setProducts((prev) =>
          prev.map((p) => {
            const item = order.items.find((it) => it.productId === p.id);
            if (!item) return p;
            return { ...p, reserved: Math.max(0, p.reserved - item.allocated) };
          }),
        );
      }
      toast.success(`${orderId} dispatched`, { description: "Reserved inventory released and stock ledger updated." });
    } else if (newStatus) {
      toast.success(`${orderId} → ${newStatus}`);
    }
  }, [orders]);

  const adjustStock = useCallback((productId: string, delta: number) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, available: Math.max(0, p.available + delta) } : p)),
    );
    toast.success("Stock adjusted", { description: `${productId}: ${delta > 0 ? "+" : ""}${delta} units` });
  }, []);

  const addProduct = useCallback((p: Partial<Product> & { name: string }) => {
    setProducts((prev) => {
      const id = `P-${300 + prev.length}`;
      const product: Product = {
        id,
        name: p.name,
        sku: p.sku ?? `SKU-NEW-${prev.length}`,
        category: p.category ?? "Accessories",
        warehouse: p.warehouse ?? "WH-North (Pune)",
        zone: p.zone ?? "Zone A",
        location: p.location ?? "A-01-01",
        available: p.available ?? 0,
        reserved: 0,
        damaged: 0,
        reorderLevel: p.reorderLevel ?? 30,
        incoming: 0,
        incomingEta: "—",
        avgDailyDemand: p.avgDailyDemand ?? 5,
        unitPrice: p.unitPrice ?? 1000,
        demandTrend: [4, 6, 5, 7, 6, 5, 6],
      };
      return [product, ...prev];
    });
    toast.success("Product added to catalogue");
  }, []);

  const assignPicker = useCallback((taskId: string, picker: string) => {
    setPickTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, picker, status: t.status === "Waiting" ? "Assigned" : t.status } : t)),
    );
    toast.success(`Task ${taskId} assigned to ${picker}`);
  }, []);

  const setTaskStatus = useCallback((taskId: string, status: PickTask["status"]) => {
    setPickTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));
    toast.success(`Task ${taskId} → ${status}`);
  }, []);

  const raiseException = useCallback(
    (input: { orderId: string; type: ExceptionType; productId?: string | undefined; productName?: string | undefined; quantity?: number | undefined }) => {
      const exc = createException(input);
      setExceptions((prev) => [{ ...exc, recommendation: recommendResolution(exc, products) }, ...prev]);
      setOrders((prev) => prev.map((o) => (o.id === input.orderId ? { ...o, status: "Exception" } : o)));
      toast.error(`Exception raised on ${input.orderId}`, { description: input.type });
    },
    [products],
  );

  const closeException = useCallback(
    (exceptionId: string) => {
      setExceptions((prev) =>
        prev.map((e) => (e.id === exceptionId ? resolveException(e, products) : e)),
      );
      toast.success("Exception resolution applied");
    },
    [products],
  );

  const value = useMemo<WarehouseState>(
    () => ({
      products,
      orders: orders.map((o) => {
        const scored = calculatePriority(o, products);
        return { ...o, priority: scored.priority, priorityScore: scored.total };
      }),
      pickTasks,
      exceptions,
      warehouse,
      setWarehouse,
      runAllocation,
      approveAllocation,
      holdOrder,
      releaseOrder,
      advanceOrder,
      setOrderStatus,
      adjustStock,
      addProduct,
      assignPicker,
      setTaskStatus,
      raiseException,
      closeException,
    }),
    [
      products,
      orders,
      pickTasks,
      exceptions,
      warehouse,
      runAllocation,
      approveAllocation,
      holdOrder,
      releaseOrder,
      advanceOrder,
      setOrderStatus,
      adjustStock,
      addProduct,
      assignPicker,
      setTaskStatus,
      raiseException,
      closeException,
    ],
  );

  return <WarehouseContext.Provider value={value}>{children}</WarehouseContext.Provider>;
}

export function useWarehouse() {
  const ctx = useContext(WarehouseContext);
  if (!ctx) throw new Error("useWarehouse must be used inside WarehouseProvider");
  return ctx;
}

export function useStockStatus(product: Product) {
  return detectLowStock(product);
}