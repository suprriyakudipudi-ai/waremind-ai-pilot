import { Link, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  Boxes,
  ClipboardCheck,
  Cpu,
  LayoutDashboard,
  LineChart,
  PackageSearch,
  Menu,
  ScanBarcode,
  Settings,
  ShieldAlert,
  ShoppingCart,
  Sparkles,
  Truck,
  Warehouse,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useWarehouse } from "@/lib/warehouse/store";
import { WAREHOUSES } from "@/lib/warehouse/data";
import { isOrderAtRisk } from "@/lib/warehouse/engine";
import { ThemeToggle } from "@/components/layout/ThemeToggle";


const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/inventory", label: "Inventory", icon: Boxes },
  { to: "/orders", label: "Orders", icon: ShoppingCart },
  { to: "/allocation", label: "Smart Allocation", icon: Sparkles },
  { to: "/picking", label: "Picking", icon: PackageSearch },
  { to: "/packing", label: "Packing & QC", icon: ClipboardCheck },
  { to: "/exceptions", label: "Exceptions", icon: ShieldAlert },
  { to: "/dispatch", label: "Dispatch", icon: Truck },
  { to: "/analytics", label: "Analytics", icon: LineChart },
  { to: "/command-center", label: "AI Command Center", icon: Cpu },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { warehouse, setWarehouse, orders, products, exceptions } = useWarehouse();

  const atRisk = orders.filter((o) => isOrderAtRisk(o, products)).length;
  const openExceptions = exceptions.filter((e) => e.status === "Open").length;

  return (
    <div className="min-h-screen">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-2.5 px-5 py-6">
          <span className="grid size-10 place-items-center rounded-xl gradient-brand text-primary-foreground shadow-[var(--shadow-glow)]">
            <Warehouse className="size-5" />
          </span>
          <div>
            <p className="text-sm font-semibold tracking-tight text-sidebar-accent-foreground">WareMind AI</p>
            <p className="text-[11px] text-sidebar-foreground/70">Warehouse Operations</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {NAV.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all",
                  active
                    ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",

                )}
              >
                <item.icon className="size-4 shrink-0" />
                <span className="truncate">{item.label}</span>
                {item.label === "Exceptions" && openExceptions > 0 && (
                  <span className="ml-auto rounded-full bg-critical px-1.5 py-0.5 text-[10px] font-semibold text-critical-foreground">
                    {openExceptions}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="m-3 rounded-xl border border-sidebar-border bg-sidebar-accent/60 px-4 py-3 text-[11px] leading-relaxed text-sidebar-foreground/75">
          <span className="font-semibold text-sidebar-accent-foreground">Decision loop</span>
          <br />
          Detect → Analyze → Decide → Act → Track
        </div>
      </aside>

      {open && (
        <button
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-foreground/40 lg:hidden"
        />
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-border/70 bg-surface/70 px-4 py-3 backdrop-blur-xl sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation">
            <Menu className="size-5" />
          </Button>
          <div className="hidden items-center gap-2 md:flex">
            <Sparkles className="size-4 text-primary" />
            <p className="text-sm font-medium text-muted-foreground">
              Control tower · <span className="text-foreground">{warehouse}</span>
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Select value={warehouse} onValueChange={setWarehouse}>
              <SelectTrigger className="h-9 w-[190px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All warehouses">All warehouses</SelectItem>
                {WAREHOUSES.map((w) => (
                  <SelectItem key={w} value={w}>
                    {w}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
                  <Bell className="size-5" />
                  {atRisk > 0 && (
                    <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-critical" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>Operational alerts</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="flex-col items-start gap-0.5">
                  <span className="text-sm font-medium">{atRisk} orders at risk</span>
                  <span className="text-xs text-muted-foreground">Deadline or inventory pressure detected</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="flex-col items-start gap-0.5">
                  <span className="text-sm font-medium">{openExceptions} open exceptions</span>
                  <span className="text-xs text-muted-foreground">Awaiting decision in the exception centre</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full border border-border py-1 pl-1 pr-3 transition-colors hover:bg-muted">
                  <span className="grid size-7 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {initials}
                  </span>
                  <span className="hidden text-xs font-medium sm:block">{profile.role}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{profile.name}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile">Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuItem>Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="mx-auto max-w-[1500px] space-y-6 px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

export const NAV_ITEMS = NAV;
export const ICONS = { ScanBarcode };