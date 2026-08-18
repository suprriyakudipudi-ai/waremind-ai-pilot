import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Bell, Building2, Save, ShieldCheck, SlidersHorizontal, Users } from "lucide-react";
import { toast } from "sonner";
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
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, Panel } from "@/components/warehouse/Primitives";
import { StatusBadge } from "@/components/warehouse/StatusBadge";
import { PICKERS, WAREHOUSES } from "@/lib/warehouse/data";
import { useWarehouse } from "@/lib/warehouse/store";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings | WareMind AI" },
      {
        name: "description",
        content:
          "Configure warehouses, allocation priority weights, alert thresholds, notifications and team access for WareMind AI.",
      },
      { property: "og:title", content: "Settings | WareMind AI" },
      {
        property: "og:description",
        content: "Tune allocation weights, thresholds, alerts and team roles for your warehouse network.",
      },
    ],
  }),
  component: SettingsPage,
});

const ROLES = ["Warehouse Manager", "Supervisor", "Picker", "QC Analyst", "Read only"];

function SettingsPage() {
  const { warehouse, setWarehouse } = useWarehouse();

  const [weights, setWeights] = useState({ deadline: 40, tier: 25, value: 20, stock: 15 });
  const [thresholds, setThresholds] = useState({ lowStockDays: 5, slaHours: 12, pickMinutes: 20 });
  const [alerts, setAlerts] = useState({ atRisk: true, stockout: true, qcFailure: true, dailyDigest: false });
  const [profile, setProfile] = useState({ name: "Suprriya K.", email: "suprriya@waremind.ai", role: ROLES[0]! });

  const total = Object.values(weights).reduce((s, v) => s + v, 0);

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Tune how the decision engine prioritises, alerts and escalates."
        actions={
          <Button onClick={() => toast.success("Settings saved", { description: "Applied across all warehouses." })}>
            <Save className="size-4" /> Save changes
          </Button>
        }
      />

      <Tabs defaultValue="operations">
        <TabsList className="flex-wrap">
          <TabsTrigger value="operations">
            <SlidersHorizontal className="mr-1.5 size-4" /> Operations
          </TabsTrigger>
          <TabsTrigger value="alerts">
            <Bell className="mr-1.5 size-4" /> Alerts
          </TabsTrigger>
          <TabsTrigger value="network">
            <Building2 className="mr-1.5 size-4" /> Network
          </TabsTrigger>
          <TabsTrigger value="team">
            <Users className="mr-1.5 size-4" /> Team
          </TabsTrigger>
        </TabsList>

        <TabsContent value="operations" className="mt-6 space-y-6">
          <Panel
            title="Allocation Priority Weights"
            description="How the engine scores which order gets scarce inventory first"
            actions={<StatusBadge value={`${total}% allocated`} tone={total === 100 ? "success" : "warning"} />}
          >
            <div className="space-y-6">
              {(
                [
                  ["deadline", "Delivery deadline pressure"],
                  ["tier", "Customer tier"],
                  ["value", "Order value"],
                  ["stock", "Stock scarcity"],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <Label>{label}</Label>
                    <span className="font-semibold text-primary">{weights[key]}%</span>
                  </div>
                  <Slider
                    value={[weights[key]]}
                    max={60}
                    step={5}
                    onValueChange={([v]) => setWeights((w) => ({ ...w, [key]: v ?? 0 }))}
                  />
                </div>
              ))}
              {total !== 100 && (
                <p className="text-xs text-warning">Weights should total 100% — currently {total}%.</p>
              )}
            </div>
          </Panel>

          <Panel title="Operational Thresholds" description="When an event becomes an exception">
            <div className="grid gap-5 sm:grid-cols-3">
              <Field
                label="Low stock warning (days of cover)"
                value={thresholds.lowStockDays}
                onChange={(v) => setThresholds((t) => ({ ...t, lowStockDays: v }))}
              />
              <Field
                label="SLA risk window (hours)"
                value={thresholds.slaHours}
                onChange={(v) => setThresholds((t) => ({ ...t, slaHours: v }))}
              />
              <Field
                label="Pick delay threshold (minutes)"
                value={thresholds.pickMinutes}
                onChange={(v) => setThresholds((t) => ({ ...t, pickMinutes: v }))}
              />
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="alerts" className="mt-6 space-y-6">
          <Panel title="Notifications" description="Choose which signals reach the operations team">
            <div className="divide-y divide-border">
              {(
                [
                  ["atRisk", "Order at risk", "Notify when an order may breach its delivery deadline."],
                  ["stockout", "Stockout forecast", "Notify when a SKU falls below its cover threshold."],
                  ["qcFailure", "QC failure", "Notify when packing or quality check raises an exception."],
                  ["dailyDigest", "Daily digest", "A 7am summary of throughput, risk and exceptions."],
                ] as const
              ).map(([key, title, desc]) => (
                <div key={key} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium">{title}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <Switch
                    checked={alerts[key]}
                    onCheckedChange={(checked) => {
                      setAlerts((a) => ({ ...a, [key]: checked }));
                      toast.success(`${title} alerts ${checked ? "enabled" : "disabled"}`);
                    }}
                  />
                </div>
              ))}
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="network" className="mt-6 space-y-6">
          <Panel title="Default Warehouse" description="Applied whenever you open the control tower">
            <div className="max-w-sm space-y-2">
              <Label>Active warehouse</Label>
              <Select value={warehouse} onValueChange={setWarehouse}>
                <SelectTrigger>
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
            </div>
            <Separator className="my-5" />
            <div className="grid gap-3 sm:grid-cols-3">
              {WAREHOUSES.map((w) => (
                <div key={w} className="rounded-xl border border-border bg-surface/60 p-4">
                  <div className="flex items-center gap-2">
                    <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Building2 className="size-4" />
                    </span>
                    <p className="text-sm font-semibold">{w}</p>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">Zones A–D · 3 dock doors · 24/7 shift cover</p>
                  <StatusBadge value="Operational" tone="success" className="mt-3" />
                </div>
              ))}
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="team" className="mt-6 space-y-6">
          <Panel title="Your Profile" description="How you appear across the control tower">
            <div className="grid max-w-2xl gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={profile.name} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Work email</Label>
                <Input id="email" type="email" value={profile.email} onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={profile.role} onValueChange={(role) => setProfile((p) => ({ ...p, role }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Panel>

          <Panel title="Team & Access" description="Floor team and their permissions">
            <div className="divide-y divide-border">
              {PICKERS.filter((p) => p !== "Unassigned").map((p, i) => (
                <div key={p} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="grid size-9 place-items-center rounded-full gradient-brand text-xs font-semibold text-primary-foreground">
                    {p.split(" ").map((n) => n[0]).join("")}
                  </span>
                  <div className="min-w-40">
                    <p className="text-sm font-medium">{p}</p>
                    <p className="text-xs text-muted-foreground">{p.toLowerCase().replace(/[^a-z]/g, "")}@waremind.ai</p>
                  </div>
                  <StatusBadge value={i === 0 ? "Supervisor" : "Picker"} tone={i === 0 ? "primary" : "neutral"} dot={false} />
                  <div className="ml-auto flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Mobile scanner</span>
                    <Switch defaultChecked={i !== 3} />
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Security" description="Account protection for the operations workspace">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="grid size-9 place-items-center rounded-lg bg-success/12 text-success">
                  <ShieldCheck className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-medium">Two-factor authentication</p>
                  <p className="text-xs text-muted-foreground">Required for anyone who can approve allocations.</p>
                </div>
              </div>
              <Switch defaultChecked />
            </div>
          </Panel>
        </TabsContent>
      </Tabs>
    </>
  );
}

function Field({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type="number" min={1} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}
