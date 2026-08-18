import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Minus, Plus, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState, PageHeader, Panel } from "@/components/warehouse/Primitives";
import { StatusBadge } from "@/components/warehouse/StatusBadge";
import { useWarehouse } from "@/lib/warehouse/store";
import { calculateReorderRecommendation, detectLowStock, formatCurrency } from "@/lib/warehouse/engine";
import { WAREHOUSES } from "@/lib/warehouse/data";
import type { Product } from "@/lib/warehouse/types";

export const Route = createFileRoute("/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory Control | WareMind AI" },
      {
        name: "description",
        content: "Track SKU-level availability, reserved and damaged stock, reorder levels and AI reorder recommendations.",
      },
      { property: "og:title", content: "Inventory Control | WareMind AI" },
      { property: "og:description", content: "SKU-level stock health with AI reorder recommendations." },
    ],
  }),
  component: InventoryPage,
});

function InventoryPage() {
  const { products, adjustStock, addProduct, orders } = useWarehouse();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [wh, setWh] = useState("All");
  const [status, setStatus] = useState("All");
  const [sort, setSort] = useState("stock-asc");
  const [detail, setDetail] = useState<Product | null>(null);
  const [newName, setNewName] = useState("");
  const [newStock, setNewStock] = useState("50");

  const categories = useMemo(() => ["All", ...new Set(products.map((p) => p.category))], [products]);

  const rows = useMemo(() => {
    let list = products.filter((p) => {
      const q = query.toLowerCase();
      const matches = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.id.toLowerCase().includes(q);
      return (
        matches &&
        (category === "All" || p.category === category) &&
        (wh === "All" || p.warehouse === wh) &&
        (status === "All" || detectLowStock(p) === status)
      );
    });
    list = [...list].sort((a, b) =>
      sort === "stock-asc"
        ? a.available - b.available
        : sort === "stock-desc"
          ? b.available - a.available
          : a.name.localeCompare(b.name),
    );
    return list;
  }, [products, query, category, wh, status, sort]);

  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle={`${products.length} SKUs across ${WAREHOUSES.length} warehouses`}
        actions={
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <PackagePlus className="size-4" /> Add Product
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add product</DialogTitle>
                <DialogDescription>Create a new SKU in the catalogue.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="pname">Product name</Label>
                  <Input id="pname" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Atlas Barcode Scanner" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pstock">Opening stock</Label>
                  <Input id="pstock" type="number" value={newStock} onChange={(e) => setNewStock(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button
                  disabled={!newName.trim()}
                  onClick={() => {
                    addProduct({ name: newName.trim(), available: Number(newStock) || 0 });
                    setNewName("");
                  }}
                >
                  Save product
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Panel bodyClassName="p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Input placeholder="Search product, SKU or ID" value={query} onChange={(e) => setQuery(e.target.value)} />
          <FilterSelect value={category} onChange={setCategory} options={categories} label="Category" />
          <FilterSelect value={wh} onChange={setWh} options={["All", ...WAREHOUSES]} label="Warehouse" />
          <FilterSelect value={status} onChange={setStatus} options={["All", "Healthy", "Low Stock", "Critical", "Out of Stock"]} label="Stock status" />
          <FilterSelect
            value={sort}
            onChange={setSort}
            options={["stock-asc", "stock-desc", "name"]}
            label="Sort"
            labels={{ "stock-asc": "Stock: low → high", "stock-desc": "Stock: high → low", name: "Name A–Z" }}
          />
        </div>
      </Panel>

      <Panel title={`${rows.length} products`} bodyClassName="p-0">
        {rows.length === 0 ? (
          <div className="p-5">
            <EmptyState title="No products match these filters" description="Try clearing the search or widening the stock status filter." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  {["Product ID", "Product", "SKU", "Category", "Location", "Available", "Reserved", "Damaged", "Reorder", "Status", ""].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-3 text-left font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 60).map((p) => (
                  <tr key={p.id} className="border-t border-border transition-colors hover:bg-muted/40">
                    <td className="px-4 py-3 font-medium">{p.id}</td>
                    <td className="px-4 py-3">{p.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.sku}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.category}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {p.zone} · {p.location}
                    </td>
                    <td className="px-4 py-3 font-medium">{p.available}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.reserved}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.damaged}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.reorderLevel}</td>
                    <td className="px-4 py-3">
                      <StatusBadge value={detectLowStock(p)} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost" aria-label="Decrease stock" onClick={() => adjustStock(p.id, -10)}>
                          <Minus className="size-4" />
                        </Button>
                        <Button size="icon" variant="ghost" aria-label="Increase stock" onClick={() => adjustStock(p.id, 10)}>
                          <Plus className="size-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setDetail(p)}>
                          Details
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {detail && <ProductDetail product={detail} orderCount={orders.filter((o) => o.items.some((i) => i.productId === detail.id)).length} />}
        </SheetContent>
      </Sheet>
    </>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
  label,
  labels,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  label: string;
  labels?: Record<string, string>;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {labels?.[o] ?? o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ProductDetail({ product, orderCount }: { product: Product; orderCount: number }) {
  const reorder = calculateReorderRecommendation(product);
  const trend = product.demandTrend.map((v, i) => ({ day: `D${i + 1}`, demand: v }));
  return (
    <>
      <SheetHeader>
        <SheetTitle>{product.name}</SheetTitle>
        <SheetDescription>
          {product.id} · {product.sku} · {product.category}
        </SheetDescription>
      </SheetHeader>
      <div className="space-y-5 px-4 pb-8">
        <div className="grid grid-cols-2 gap-3">
          <Fact label="Available" value={product.available} />
          <Fact label="Reserved" value={product.reserved} />
          <Fact label="Damaged" value={product.damaged} />
          <Fact label="Reorder level" value={product.reorderLevel} />
          <Fact label="Incoming" value={`${product.incoming} (${product.incomingEta})`} />
          <Fact label="Unit price" value={formatCurrency(product.unitPrice)} />
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Stock status</p>
          <StatusBadge value={detectLowStock(product)} />
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Demand trend (7 days)</p>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={trend}>
              <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="var(--color-muted-foreground)" />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--color-border)" }} />
              <Line type="monotone" dataKey="demand" stroke="var(--color-chart-1)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-lg border border-border bg-muted/40 p-4">
          <StatusBadge value={reorder.urgent ? "Critical Reorder Recommendation" : "Reorder Planned"} tone={reorder.urgent ? "critical" : "info"} />
          <p className="mt-2 text-sm">{reorder.message}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Estimated days until stockout: {reorder.daysUntilStockout} · Recommended quantity: {reorder.recommendedQuantity} units
          </p>
        </div>
        <p className="text-xs text-muted-foreground">Appears on {orderCount} orders in the current book.</p>
      </div>
    </>
  );
}

function Fact({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}