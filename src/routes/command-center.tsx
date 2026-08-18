import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Bot,
  Brain,
  CircuitBoard,
  Radar as RadarIcon,
  Send,
  Sparkles,
  Workflow,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AiActionCenter } from "@/components/warehouse/AiActionCenter";
import { Metric, PageHeader, Panel } from "@/components/warehouse/Primitives";
import { StatusBadge } from "@/components/warehouse/StatusBadge";
import { ZONE_PERFORMANCE } from "@/lib/warehouse/data";
import {
  calculateReorderRecommendation,
  detectBottleneck,
  detectLowStock,
  isOrderAtRisk,
  optimizePicking,
} from "@/lib/warehouse/engine";
import { useWarehouse } from "@/lib/warehouse/store";

export const Route = createFileRoute("/command-center")({
  head: () => ({
    meta: [
      { title: "AI Command Center | WareMind AI" },
      {
        name: "description",
        content:
          "The AI command center for warehouse operations: live signal feed, autonomous playbooks and a decision assistant for allocation, picking and dispatch.",
      },
      { property: "og:title", content: "AI Command Center | WareMind AI" },
      {
        property: "og:description",
        content: "Detect, analyse, decide and act on fulfilment risk with AI playbooks.",
      },
    ],
  }),
  component: CommandCenterPage,
});

interface Signal {
  id: string;
  stage: "Detect" | "Analyze" | "Decide" | "Act" | "Track";
  tone: "critical" | "warning" | "info" | "success";
  title: string;
  detail: string;
  time: string;
}

const PLAYBOOKS = [
  {
    id: "pb-stockout",
    name: "Stockout Shield",
    icon: RadarIcon,
    trigger: "Available stock covers < 3 days of demand",
    action: "Reserve incoming shipment, raise PO and notify planning",
    to: "/inventory" as const,
  },
  {
    id: "pb-priority",
    name: "SLA Guardian",
    icon: Zap,
    trigger: "Platinum order within 12h of deadline and not allocated",
    action: "Escalate priority score and pre-allocate inventory",
    to: "/allocation" as const,
  },
  {
    id: "pb-batch",
    name: "Batch Router",
    icon: Workflow,
    trigger: "3+ open picks share a zone",
    action: "Merge into a single batch route and reassign picker",
    to: "/picking" as const,
  },
  {
    id: "pb-qc",
    name: "QC Sentinel",
    icon: CircuitBoard,
    trigger: "Damaged or wrong item detected during packing",
    action: "Auto-raise exception with recommended resolution",
    to: "/exceptions" as const,
  },
];

function CommandCenterPage() {
  const { orders, products, pickTasks, exceptions } = useWarehouse();
  const [autonomy, setAutonomy] = useState<Record<string, boolean>>({ "pb-batch": true, "pb-qc": true });
  const [question, setQuestion] = useState("");
  const [thread, setThread] = useState<{ role: "user" | "ai"; text: string }[]>([]);

  const atRisk = orders.filter((o) => isOrderAtRisk(o, products));
  const lowStock = products.filter((p) => detectLowStock(p) !== "Healthy");
  const openExceptions = exceptions.filter((e) => e.status === "Open");
  const opt = optimizePicking(pickTasks);
  const bottleneck = detectBottleneck(ZONE_PERFORMANCE);

  const signals = useMemo<Signal[]>(() => {
    const list: Signal[] = [];
    if (atRisk[0]) {
      list.push({
        id: "s1",
        stage: "Detect",
        tone: "critical",
        title: `${atRisk.length} order${atRisk.length === 1 ? "" : "s"} at risk of breaching SLA`,
        detail: `${atRisk[0].id} for ${atRisk[0].customer} has ${atRisk[0].deadlineHours}h remaining.`,
        time: "just now",
      });
    }
    if (lowStock[0]) {
      const r = calculateReorderRecommendation(lowStock[0]);
      list.push({
        id: "s2",
        stage: "Analyze",
        tone: "warning",
        title: `${lowStock.length} SKUs below reorder level`,
        detail: r.message,
        time: "2 min ago",
      });
    }
    if (opt) {
      list.push({
        id: "s3",
        stage: "Decide",
        tone: "info",
        title: `Batch picking opportunity in ${opt.zone}`,
        detail: `${opt.message} Estimated saving: ${opt.timeSavingMinutes} min.`,
        time: "6 min ago",
      });
    }
    if (bottleneck) {
      list.push({
        id: "s4",
        stage: "Act",
        tone: "warning",
        title: `${bottleneck.zone} throughput degraded`,
        detail: bottleneck.recommendation,
        time: "14 min ago",
      });
    }
    list.push({
      id: "s5",
      stage: "Track",
      tone: "success",
      title: `${exceptions.filter((e) => e.status === "Resolved").length} exceptions resolved today`,
      detail: "Resolution actions applied to inventory and order ledgers.",
      time: "28 min ago",
    });
    return list;
  }, [atRisk, lowStock, opt, bottleneck, exceptions]);

  function answer(q: string) {
    const lower = q.toLowerCase();
    if (lower.includes("risk") || lower.includes("late") || lower.includes("sla")) {
      return atRisk[0]
        ? `${atRisk.length} order(s) are at risk. The most urgent is ${atRisk[0].id} (${atRisk[0].customerTier} · ${atRisk[0].customer}) with ${atRisk[0].deadlineHours}h left. Recommended: allocate available stock now and flag the shortage.`
        : "No orders are currently at risk — every open order has stock cover and deadline headroom.";
    }
    if (lower.includes("stock") || lower.includes("reorder") || lower.includes("inventory")) {
      return lowStock[0]
        ? calculateReorderRecommendation(lowStock[0]).message
        : `All ${products.length} SKUs are above their reorder level.`;
    }
    if (lower.includes("pick") || lower.includes("batch")) {
      return opt
        ? `${opt.message} Merging them saves about ${opt.timeSavingMinutes} picking minutes today.`
        : "Picking queues are balanced — no batching opportunity right now.";
    }
    if (lower.includes("exception")) {
      return `${openExceptions.length} exception(s) are open. Highest severity: ${openExceptions[0]?.type ?? "none"}.`;
    }
    return `I track ${orders.length} orders, ${products.length} SKUs and ${pickTasks.length} pick tasks. Ask me about risk, stock, picking or exceptions.`;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;
    setThread((t) => [...t, { role: "user", text: q }, { role: "ai", text: answer(q) }]);
    setQuestion("");
  }

  const toneRing: Record<Signal["tone"], string> = {
    critical: "bg-critical/12 text-critical",
    warning: "bg-warning/12 text-warning",
    info: "bg-info/12 text-info",
    success: "bg-success/12 text-success",
  };

  return (
    <>
      <PageHeader
        title="AI Command Center"
        subtitle="One place to see what the engine detected, why it matters and what to do next."
        actions={<StatusBadge value="Engine online" tone="success" />}
      />

      <section className="panel-glow p-6">
        <div className="flex flex-wrap items-center gap-4">
          <span className="grid size-12 place-items-center rounded-2xl gradient-brand text-primary-foreground shadow-[var(--shadow-glow)]">
            <Brain className="size-6" />
          </span>
          <div className="min-w-56 flex-1">
            <h2 className="text-lg font-semibold">
              <span className="text-gradient-brand">Decision engine</span> is monitoring your network
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Detect → Analyze → Decide → Act → Track runs continuously across allocation, picking, QC and dispatch.
            </p>
          </div>
          <Button asChild>
            <Link to="/allocation">
              <Sparkles className="size-4" /> Run Smart Allocation
            </Link>
          </Button>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Signals Today" value={signals.length + 12} hint="detected events" tone="info" icon={<RadarIcon className="size-4" />} />
        <Metric label="Orders At Risk" value={atRisk.length} hint="needs a decision" tone="critical" icon={<Zap className="size-4" />} />
        <Metric label="Open Exceptions" value={openExceptions.length} hint="awaiting resolution" tone="warning" icon={<CircuitBoard className="size-4" />} />
        <Metric
          label="Automations Live"
          value={Object.values(autonomy).filter(Boolean).length}
          hint={`of ${PLAYBOOKS.length} playbooks`}
          tone="success"
          icon={<Workflow className="size-4" />}
        />
      </div>

      <AiActionCenter />

      <div className="grid gap-6 xl:grid-cols-5">
        <Panel title="Live Signal Feed" description="Chronological engine activity" className="xl:col-span-3">
          <ol className="relative space-y-5 pl-6">
            <span className="absolute left-2 top-1 bottom-1 w-px bg-border" />
            {signals.map((s) => (
              <li key={s.id} className="relative">
                <span className={`absolute -left-6 grid size-4 place-items-center rounded-full ${toneRing[s.tone]}`}>
                  <span className="size-1.5 rounded-full bg-current" />
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge value={s.stage} tone="primary" dot={false} />
                  <p className="text-sm font-medium">{s.title}</p>
                  <span className="ml-auto text-[11px] text-muted-foreground">{s.time}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{s.detail}</p>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel title="Autonomous Playbooks" description="Toggle what the engine may act on alone" className="xl:col-span-2">
          <div className="space-y-3">
            {PLAYBOOKS.map((pb) => {
              const on = !!autonomy[pb.id];
              return (
                <div key={pb.id} className="rounded-xl border border-border bg-surface/60 p-4">
                  <div className="flex items-start gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <pb.icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{pb.name}</p>
                        <StatusBadge value={on ? "Autonomous" : "Suggest only"} tone={on ? "success" : "neutral"} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">When:</span> {pb.trigger}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Then:</span> {pb.action}
                      </p>
                      <div className="mt-3 flex items-center gap-2">
                        <Button
                          size="sm"
                          variant={on ? "secondary" : "default"}
                          onClick={() => {
                            setAutonomy((a) => ({ ...a, [pb.id]: !on }));
                            toast.success(`${pb.name} is now ${on ? "suggest only" : "autonomous"}`);
                          }}
                        >
                          {on ? "Switch to suggest" : "Enable autonomy"}
                        </Button>
                        <Button asChild size="sm" variant="ghost">
                          <Link to={pb.to}>
                            Open <ArrowRight className="size-3.5" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <Panel title="Ask the Operations Assistant" description="Grounded in your live orders, stock and pick tasks">
        <div className="space-y-3">
          {thread.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Try: “Which orders are at risk?”, “What should I reorder?”, “Any batching opportunity?”
            </p>
          )}
          {thread.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex gap-2"}>
              {m.role === "ai" && (
                <span className="grid size-8 shrink-0 place-items-center rounded-lg gradient-brand text-primary-foreground">
                  <Bot className="size-4" />
                </span>
              )}
              <p
                className={
                  m.role === "user"
                    ? "max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground"
                    : "max-w-[80%] rounded-2xl rounded-bl-sm border border-border bg-surface px-3.5 py-2 text-sm"
                }
              >
                {m.text}
              </p>
            </div>
          ))}
          <form onSubmit={submit} className="flex gap-2 pt-1">
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask about risk, stock, picking or exceptions…"
            />
            <Button type="submit" size="icon" aria-label="Send question">
              <Send className="size-4" />
            </Button>
          </form>
        </div>
      </Panel>
    </>
  );
}
