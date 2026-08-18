import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mail, MapPin, Pencil, Phone, RotateCcw, Save, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { PageHeader, Panel } from "@/components/warehouse/Primitives";
import { WAREHOUSES } from "@/lib/warehouse/data";
import { DEFAULT_PROFILE, useProfile, type Profile } from "@/lib/profile";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "My Profile | WareMind AI" },
      {
        name: "description",
        content:
          "View and edit your WareMind AI operator profile: name, role, contact details, home warehouse and shift.",
      },
      { property: "og:title", content: "My Profile | WareMind AI" },
      {
        property: "og:description",
        content: "Edit your operator profile, contact details and default warehouse.",
      },
    ],
  }),
  component: ProfilePage,
});

const ROLES = [
  "Warehouse Manager",
  "Operations Lead",
  "Picker",
  "Packer",
  "QC Inspector",
  "Dispatch Coordinator",
];

const SHIFTS = [
  "Morning (6:00 – 14:00)",
  "Afternoon (14:00 – 22:00)",
  "Night (22:00 – 6:00)",
  "Flexible",
];

function ProfilePage() {
  const { profile, saveProfile, initials } = useProfile();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Profile>(profile);

  useEffect(() => {
    setDraft(profile);
  }, [profile]);

  const set = (key: keyof Profile) => (value: string) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const onSave = () => {
    if (!draft.name.trim()) {
      toast.error("Name can't be empty");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(draft.email)) {
      toast.error("Enter a valid email address");
      return;
    }
    saveProfile({ ...draft, name: draft.name.trim() });
    setEditing(false);
    toast.success("Profile updated");
  };

  return (
    <>
      <PageHeader
        title="My Profile"
        subtitle="Your operator identity, contact details and default working context."
        actions={
          editing ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setDraft(profile);
                  setEditing(false);
                }}
              >
                <X className="size-4" /> Cancel
              </Button>
              <Button onClick={onSave}>
                <Save className="size-4" /> Save changes
              </Button>
            </>
          ) : (
            <Button onClick={() => setEditing(true)}>
              <Pencil className="size-4" /> Edit profile
            </Button>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Panel title="Overview" description="How you appear across the control tower">
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <span className="grid size-24 place-items-center rounded-full gradient-brand text-2xl font-semibold text-primary-foreground shadow-[var(--shadow-glow)]">
              {initials}
            </span>
            <div>
              <p className="text-lg font-semibold">{profile.name}</p>
              <p className="text-sm text-muted-foreground">{profile.role}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 text-xs font-medium text-foreground ring-1 ring-success/30">
              <ShieldCheck className="size-3.5 text-success" /> Verified operator
            </span>
          </div>
          <Separator className="my-4" />
          <ul className="space-y-3 text-sm">
            <li className="flex items-center gap-2.5 text-muted-foreground">
              <Mail className="size-4 text-primary" />
              <span className="truncate text-foreground">{profile.email}</span>
            </li>
            <li className="flex items-center gap-2.5 text-muted-foreground">
              <Phone className="size-4 text-primary" />
              <span className="text-foreground">{profile.phone}</span>
            </li>
            <li className="flex items-center gap-2.5 text-muted-foreground">
              <MapPin className="size-4 text-primary" />
              <span className="text-foreground">{profile.warehouse}</span>
            </li>
          </ul>
        </Panel>

        <Panel
          title="Profile details"
          description={editing ? "Update your details and save" : "Click edit to change these details"}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                value={draft.name}
                disabled={!editing}
                onChange={(e) => set("name")(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={draft.role} onValueChange={set("role")} disabled={!editing}>
                <SelectTrigger id="role">
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
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={draft.email}
                disabled={!editing}
                onChange={(e) => set("email")(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={draft.phone}
                disabled={!editing}
                onChange={(e) => set("phone")(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="warehouse">Home warehouse</Label>
              <Select value={draft.warehouse} onValueChange={set("warehouse")} disabled={!editing}>
                <SelectTrigger id="warehouse">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WAREHOUSES.map((w) => (
                    <SelectItem key={w} value={w}>
                      {w}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="shift">Shift</Label>
              <Select value={draft.shift} onValueChange={set("shift")} disabled={!editing}>
                <SelectTrigger id="shift">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SHIFTS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="bio">About</Label>
              <Textarea
                id="bio"
                rows={3}
                value={draft.bio}
                disabled={!editing}
                onChange={(e) => set("bio")(e.target.value)}
              />
            </div>
          </div>

          {editing && (
            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <Button
                variant="ghost"
                onClick={() => {
                  setDraft(DEFAULT_PROFILE);
                  toast.info("Reset to defaults — save to apply");
                }}
              >
                <RotateCcw className="size-4" /> Reset to defaults
              </Button>
              <Button className="ml-auto" onClick={onSave}>
                <Save className="size-4" /> Save changes
              </Button>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
