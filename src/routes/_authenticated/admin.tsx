import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Users, CreditCard, ClipboardList, Calendar, BellRing, Trophy, Search, Plus, Trash2,
  CheckCircle2, XCircle, Megaphone, Download, IndianRupee, TrendingUp, Activity, ShieldOff,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { INR, fmtDate, daysBetween } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — SRGYM" }] }),
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    if (!isAdmin) throw redirect({ to: "/dashboard" });
  },
  component: Admin,
});

function Admin() {
  return (
    <AppShell title="Admin Control" subtitle="Members, payments, attendance and more.">
      <Tabs defaultValue="overview">
        <TabsList className="flex flex-wrap bg-muted">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="leaves">Leaves</TabsTrigger>
          <TabsTrigger value="notifs">Broadcast</TabsTrigger>
          <TabsTrigger value="holidays">Holidays</TabsTrigger>
          <TabsTrigger value="trainers">Trainers</TabsTrigger>
          <TabsTrigger value="contact">Inbox</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-5"><Overview /></TabsContent>
        <TabsContent value="members" className="mt-5"><MembersTab /></TabsContent>
        <TabsContent value="plans" className="mt-5"><PlansTab /></TabsContent>
        <TabsContent value="payments" className="mt-5"><PaymentsTab /></TabsContent>
        <TabsContent value="attendance" className="mt-5"><AttendanceTab /></TabsContent>
        <TabsContent value="leaves" className="mt-5"><LeavesTab /></TabsContent>
        <TabsContent value="notifs" className="mt-5"><BroadcastTab /></TabsContent>
        <TabsContent value="holidays" className="mt-5"><HolidaysTab /></TabsContent>
        <TabsContent value="trainers" className="mt-5"><TrainersTab /></TabsContent>
        <TabsContent value="contact" className="mt-5"><ContactTab /></TabsContent>
      </Tabs>
    </AppShell>
  );
}

/* ---------------- OVERVIEW ---------------- */
function Overview() {
  const { data: members = [] } = useQuery({
    queryKey: ["a-members"],
    queryFn: async () => (await supabase.from("profiles").select("id, joined_at")).data ?? [],
  });
  const { data: memberships = [] } = useQuery({
    queryKey: ["a-memberships"],
    queryFn: async () => (await supabase.from("memberships").select("end_date, status")).data ?? [],
  });
  const { data: payments = [] } = useQuery({
    queryKey: ["a-payments"],
    queryFn: async () => (await supabase.from("payments").select("amount, status, paid_at, due_date")).data ?? [],
  });
  const { data: attendance = [] } = useQuery({
    queryKey: ["a-attendance"],
    queryFn: async () => (await supabase.from("attendance").select("date")).data ?? [],
  });

  const activeMembers = memberships.filter((m) => daysBetween(m.end_date) >= 0).length;
  const expiredMembers = memberships.filter((m) => daysBetween(m.end_date) < 0).length;
  const revenue30 = payments
    .filter((p) => p.status === "paid" && p.paid_at && daysBetween(p.paid_at) > -30)
    .reduce((s, p) => s + Number(p.amount), 0);
  const overdue = payments.filter((p) => p.status === "overdue").length;
  const todayAttendance = attendance.filter((a) => a.date === new Date().toISOString().slice(0, 10)).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Stat icon={Users} label="Total members" value={members.length} sub={`${activeMembers} active · ${expiredMembers} expired`} />
        <Stat icon={IndianRupee} label="Revenue (30d)" value={INR(revenue30)} sub={`${payments.filter(p=>p.status==='paid').length} paid invoices`} />
        <Stat icon={Activity} label="Today's check-ins" value={todayAttendance} sub="live count" />
        <Stat icon={TrendingUp} label="Overdue payments" value={overdue} sub="needs follow-up" tone={overdue > 0 ? "danger" : "ok"} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Quick actions</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link to="/dashboard">My member view</Link></Button>
          <Button variant="outline" onClick={() => exportCSV("members", members)}><Download className="mr-2 h-4 w-4" /> Export members CSV</Button>
          <Button variant="outline" onClick={() => exportCSV("payments", payments)}><Download className="mr-2 h-4 w-4" /> Export payments CSV</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub, tone = "ok" }: any) {
  const cls = tone === "danger" ? "text-destructive" : "text-foreground";
  return (
    <div className="glass rounded-xl p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${cls}`} />
      </div>
      <div className={`mt-3 font-display text-2xl font-extrabold ${cls}`}>{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

/* ---------------- MEMBERS ---------------- */
function MembersTab() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const { data: members = [] } = useQuery({
    queryKey: ["mem-list"],
    queryFn: async () =>
      (
        await supabase
          .from("profiles")
          .select("*, memberships(end_date, status, plan_id, membership_plans(name))")
          .order("joined_at", { ascending: false })
      ).data ?? [],
  });

  const filtered = members.filter((m: any) =>
    !q || m.full_name?.toLowerCase().includes(q.toLowerCase()) || m.email?.toLowerCase().includes(q.toLowerCase()) || m.phone?.includes(q)
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">Members</CardTitle>
        <div className="flex w-full max-w-xs items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search name / email / phone" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </CardHeader>
      <CardContent className="overflow-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Contact</th>
              <th className="px-4 py-3 text-left">Plan</th>
              <th className="px-4 py-3 text-left">Expires</th>
              <th className="px-4 py-3 text-left">Joined</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m: any) => {
              const latest = m.memberships?.sort((a:any,b:any) => (a.end_date < b.end_date ? 1 : -1))[0];
              const expired = latest ? daysBetween(latest.end_date) < 0 : true;
              return (
                <tr key={m.id} className="border-t border-border align-top">
                  <td className="px-4 py-3 font-medium">{m.full_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <div>{m.email}</div>
                    <div className="text-xs">{m.phone}</div>
                  </td>
                  <td className="px-4 py-3">{latest?.membership_plans?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    {latest ? (
                      <Badge variant={expired ? "destructive" : "default"}>{fmtDate(latest.end_date)}</Badge>
                    ) : <Badge variant="secondary">none</Badge>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{fmtDate(m.joined_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <AssignDialog member={m} onDone={() => qc.invalidateQueries({ queryKey: ["mem-list"] })} />
                      <DeleteBtn onConfirm={async () => {
                        const { error } = await supabase.from("profiles").delete().eq("id", m.id);
                        if (error) toast.error(error.message); else { toast.success("Member removed"); qc.invalidateQueries({ queryKey: ["mem-list"] }); }
                      }} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No members.</td></tr>}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function AssignDialog({ member, onDone }: any) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"membership" | "payment" | "workout" | "diet">("membership");
  const { data: plans = [] } = useQuery({
    queryKey: ["aplans"],
    queryFn: async () => (await supabase.from("membership_plans").select("*").eq("is_active", true)).data ?? [],
    enabled: open,
  });
  const [planId, setPlanId] = useState("");
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [due, setDue] = useState(new Date().toISOString().slice(0, 10));
  const [text, setText] = useState({ title: "", content: "" });

  const plan = plans.find((p: any) => p.id === planId);
  const endDate = plan
    ? new Date(new Date(start).setMonth(new Date(start).getMonth() + plan.duration_months)).toISOString().slice(0, 10)
    : "";

  async function assignMembership() {
    if (!plan) return toast.error("Pick a plan");
    const { error } = await supabase.from("memberships").insert({
      user_id: member.id, plan_id: plan.id, start_date: start, end_date: endDate, status: "active",
    });
    if (error) return toast.error(error.message);
    await supabase.from("payments").insert({
      user_id: member.id, amount: plan.price, due_date: start, status: "pending",
    });
    await supabase.from("notifications").insert({
      user_id: member.id, title: "Welcome aboard 🎉", message: `Your ${plan.name} membership is now active until ${endDate}.`, type: "success",
    });
    toast.success("Membership assigned"); setOpen(false); onDone();
  }

  async function logPayment() {
    if (!amount) return toast.error("Enter amount");
    const { error } = await supabase.from("payments").insert({
      user_id: member.id, amount: Number(amount), due_date: due, paid_at: new Date().toISOString(),
      status: "paid", receipt_no: "RCP-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
    });
    if (error) return toast.error(error.message);
    await supabase.from("notifications").insert({
      user_id: member.id, title: "Payment received", message: `We received ${INR(amount)}. Thank you!`, type: "success",
    });
    toast.success("Payment recorded"); setOpen(false); onDone();
  }

  async function savePlan(table: "workout_plans" | "diet_plans") {
    if (!text.title || !text.content) return toast.error("Title & content required");
    const { error } = await supabase.from(table).insert({ user_id: member.id, ...text });
    if (error) return toast.error(error.message);
    toast.success("Saved"); setText({ title: "", content: "" }); setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline">Manage</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Manage — {member.full_name}</DialogTitle></DialogHeader>
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="grid grid-cols-4">
            <TabsTrigger value="membership">Plan</TabsTrigger>
            <TabsTrigger value="payment">Payment</TabsTrigger>
            <TabsTrigger value="workout">Workout</TabsTrigger>
            <TabsTrigger value="diet">Diet</TabsTrigger>
          </TabsList>
          <TabsContent value="membership" className="mt-4 space-y-3">
            <div>
              <Label>Plan</Label>
              <Select value={planId} onValueChange={setPlanId}>
                <SelectTrigger><SelectValue placeholder="Choose plan" /></SelectTrigger>
                <SelectContent>
                  {plans.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name} — {INR(p.price)} / {p.duration_months}mo</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Start date</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
            {endDate && <p className="text-sm text-muted-foreground">Ends: <span className="font-medium text-foreground">{fmtDate(endDate)}</span></p>}
            <Button onClick={assignMembership} className="w-full bg-gradient-red text-primary-foreground">Assign & invoice</Button>
          </TabsContent>
          <TabsContent value="payment" className="mt-4 space-y-3">
            <div><Label>Amount (₹)</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div><Label>Due date</Label><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>
            <Button onClick={logPayment} className="w-full bg-gradient-red text-primary-foreground">Record paid</Button>
          </TabsContent>
          <TabsContent value="workout" className="mt-4 space-y-3">
            <div><Label>Title</Label><Input value={text.title} onChange={(e) => setText({ ...text, title: e.target.value })} /></div>
            <div><Label>Plan</Label><Textarea rows={8} value={text.content} onChange={(e) => setText({ ...text, content: e.target.value })} /></div>
            <Button onClick={() => savePlan("workout_plans")} className="w-full bg-gradient-red text-primary-foreground">Save workout plan</Button>
          </TabsContent>
          <TabsContent value="diet" className="mt-4 space-y-3">
            <div><Label>Title</Label><Input value={text.title} onChange={(e) => setText({ ...text, title: e.target.value })} /></div>
            <div><Label>Plan</Label><Textarea rows={8} value={text.content} onChange={(e) => setText({ ...text, content: e.target.value })} /></div>
            <Button onClick={() => savePlan("diet_plans")} className="w-full bg-gradient-red text-primary-foreground">Save diet plan</Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- PLANS ---------------- */
function PlansTab() {
  const qc = useQueryClient();
  const { data: plans = [] } = useQuery({
    queryKey: ["a-plans"],
    queryFn: async () => (await supabase.from("membership_plans").select("*").order("price")).data ?? [],
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", duration_months: 1, price: 0, features: "" });

  async function add() {
    const features = form.features.split("\n").map((s) => s.trim()).filter(Boolean);
    const { error } = await supabase.from("membership_plans").insert({
      name: form.name, duration_months: Number(form.duration_months), price: Number(form.price), features,
    });
    if (error) return toast.error(error.message);
    toast.success("Plan created"); setOpen(false);
    setForm({ name: "", duration_months: 1, price: 0, features: "" });
    qc.invalidateQueries({ queryKey: ["a-plans"] });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Membership plans</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="bg-gradient-red text-primary-foreground"><Plus className="mr-1 h-4 w-4" /> New plan</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New plan</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Duration (months)</Label><Input type="number" value={form.duration_months} onChange={(e) => setForm({ ...form, duration_months: Number(e.target.value) })} /></div>
                <div><Label>Price (₹)</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} /></div>
              </div>
              <div><Label>Features (one per line)</Label><Textarea rows={4} value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={add} className="bg-gradient-red text-primary-foreground">Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-3">
        {plans.map((p: any) => (
          <div key={p.id} className="rounded-xl border border-border bg-surface p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-display text-xl font-bold">{p.name}</h3>
                <p className="text-xs text-muted-foreground">{p.duration_months} months</p>
              </div>
              <Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? "active" : "off"}</Badge>
            </div>
            <p className="mt-3 font-display text-2xl font-extrabold text-primary">{INR(p.price)}</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="outline" onClick={async () => {
                await supabase.from("membership_plans").update({ is_active: !p.is_active }).eq("id", p.id);
                qc.invalidateQueries({ queryKey: ["a-plans"] });
              }}>{p.is_active ? "Disable" : "Enable"}</Button>
              <DeleteBtn onConfirm={async () => {
                await supabase.from("membership_plans").delete().eq("id", p.id);
                qc.invalidateQueries({ queryKey: ["a-plans"] });
                toast.success("Deleted");
              }} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* ---------------- PAYMENTS ---------------- */
function PaymentsTab() {
  const qc = useQueryClient();
  const { data: payments = [] } = useQuery({
    queryKey: ["a-pay"],
    queryFn: async () =>
      (await supabase.from("payments").select("*, profiles(full_name, email)").order("due_date", { ascending: false })).data ?? [],
  });

  async function setStatus(id: string, status: string) {
    const upd: any = { status };
    if (status === "paid") { upd.paid_at = new Date().toISOString(); upd.receipt_no = "RCP-" + Math.random().toString(36).slice(2, 8).toUpperCase(); }
    await supabase.from("payments").update(upd).eq("id", id);
    qc.invalidateQueries({ queryKey: ["a-pay"] });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">All payments</CardTitle>
        <Button variant="outline" onClick={() => exportCSV("payments", payments)}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>
      </CardHeader>
      <CardContent className="overflow-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Member</th>
              <th className="px-4 py-3 text-left">Amount</th>
              <th className="px-4 py-3 text-left">Due</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p: any) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-4 py-3">{p.profiles?.full_name ?? p.user_id.slice(0,6)}</td>
                <td className="px-4 py-3 font-medium">{INR(p.amount)}</td>
                <td className="px-4 py-3">{fmtDate(p.due_date)}</td>
                <td className="px-4 py-3">
                  <Badge variant={p.status === "paid" ? "default" : p.status === "overdue" ? "destructive" : "secondary"}>{p.status}</Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <Select value={p.status} onValueChange={(v) => setStatus(p.id, v)}>
                    <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">pending</SelectItem>
                      <SelectItem value="paid">paid</SelectItem>
                      <SelectItem value="overdue">overdue</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

/* ---------------- ATTENDANCE ---------------- */
function AttendanceTab() {
  const { data: today = [] } = useQuery({
    queryKey: ["att-today"],
    queryFn: async () =>
      (await supabase.from("attendance").select("*, profiles(full_name)").eq("date", new Date().toISOString().slice(0, 10))).data ?? [],
  });
  const { data: all = [] } = useQuery({
    queryKey: ["att-all"],
    queryFn: async () =>
      (await supabase.from("attendance").select("date")).data ?? [],
  });

  const byDay = useMemo(() => {
    const map = new Map<string, number>();
    all.forEach((a: any) => map.set(a.date, (map.get(a.date) ?? 0) + 1));
    return Array.from(map.entries()).sort().slice(-14);
  }, [all]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Today's check-ins ({today.length})</CardTitle></CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-3">
          {today.map((a: any) => (
            <div key={a.id} className="rounded-lg border border-border bg-surface p-3 text-sm">
              <div className="font-medium">{a.profiles?.full_name}</div>
              <div className="text-xs text-muted-foreground">{new Date(a.check_in).toLocaleTimeString()}</div>
            </div>
          ))}
          {today.length === 0 && <p className="text-sm text-muted-foreground">No check-ins yet.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Last 14 days</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-end gap-1.5">
            {byDay.map(([d, n]) => (
              <div key={d} className="flex-1 text-center">
                <div className="bg-gradient-red mx-auto rounded-t" style={{ height: Math.max(6, n * 12) + "px" }} title={`${d}: ${n}`} />
                <div className="mt-1 text-[10px] text-muted-foreground">{d.slice(8)}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- LEAVES ---------------- */
function LeavesTab() {
  const qc = useQueryClient();
  const { data: leaves = [] } = useQuery({
    queryKey: ["a-leaves"],
    queryFn: async () =>
      (await supabase.from("leave_requests").select("*, profiles(full_name, email)").order("created_at", { ascending: false })).data ?? [],
  });

  async function decide(id: string, status: "approved" | "rejected", user_id: string) {
    await supabase.from("leave_requests").update({ status }).eq("id", id);
    await supabase.from("notifications").insert({
      user_id, title: `Leave ${status}`, message: `Your leave request has been ${status}.`, type: status === "approved" ? "success" : "warning",
    });
    qc.invalidateQueries({ queryKey: ["a-leaves"] });
  }

  return (
    <div className="space-y-3">
      {leaves.map((l: any) => (
        <Card key={l.id}>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
            <div className="min-w-0">
              <div className="font-medium">{l.profiles?.full_name}</div>
              <div className="text-xs text-muted-foreground">{fmtDate(l.start_date)} → {fmtDate(l.end_date)}</div>
              <div className="mt-1 text-sm">{l.reason}</div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={l.status === "approved" ? "default" : l.status === "rejected" ? "destructive" : "secondary"}>{l.status}</Badge>
              {l.status === "pending" && (
                <>
                  <Button size="sm" onClick={() => decide(l.id, "approved", l.user_id)} className="bg-green-600 hover:bg-green-700">
                    <CheckCircle2 className="mr-1 h-3 w-3" /> Approve
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => decide(l.id, "rejected", l.user_id)}>
                    <XCircle className="mr-1 h-3 w-3" /> Reject
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
      {leaves.length === 0 && <p className="text-sm text-muted-foreground">No leave requests.</p>}
    </div>
  );
}

/* ---------------- BROADCAST ---------------- */
function BroadcastTab() {
  const [form, setForm] = useState({ title: "", message: "", type: "info" });
  async function send() {
    if (!form.title || !form.message) return toast.error("Title & message required");
    const { error } = await supabase.from("notifications").insert({ ...form, user_id: null });
    if (error) return toast.error(error.message);
    toast.success("Broadcast sent to all members");
    setForm({ title: "", message: "", type: "info" });
  }
  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Megaphone className="h-4 w-4 text-primary" /> Broadcast notification</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
        <div><Label>Message</Label><Textarea rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></div>
        <div>
          <Label>Type</Label>
          <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="holiday">Holiday</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={send} className="bg-gradient-red text-primary-foreground">Send to all members</Button>
      </CardContent>
    </Card>
  );
}

/* ---------------- HOLIDAYS ---------------- */
function HolidaysTab() {
  const qc = useQueryClient();
  const { data: holidays = [] } = useQuery({
    queryKey: ["a-holidays"],
    queryFn: async () => (await supabase.from("holidays").select("*").order("date")).data ?? [],
  });
  const [form, setForm] = useState({ date: "", title: "", description: "" });

  async function add() {
    if (!form.date || !form.title) return toast.error("Date & title required");
    const { error } = await supabase.from("holidays").insert(form);
    if (error) return toast.error(error.message);
    await supabase.from("notifications").insert({
      user_id: null, title: `Holiday: ${form.title}`, message: `Gym closed on ${form.date}. ${form.description ?? ""}`, type: "holiday",
    });
    setForm({ date: "", title: "", description: "" });
    qc.invalidateQueries({ queryKey: ["a-holidays"] });
    toast.success("Holiday added & broadcast sent");
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base">Add holiday</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
          <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><Label>Description</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <Button onClick={add} className="bg-gradient-red text-primary-foreground">Add holiday</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Upcoming</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {holidays.map((h: any) => (
            <div key={h.id} className="flex items-center justify-between rounded border border-border p-3 text-sm">
              <div>
                <div className="font-medium">{h.title}</div>
                <div className="text-xs text-muted-foreground">{fmtDate(h.date)}</div>
              </div>
              <DeleteBtn onConfirm={async () => { await supabase.from("holidays").delete().eq("id", h.id); qc.invalidateQueries({ queryKey: ["a-holidays"] }); }} />
            </div>
          ))}
          {holidays.length === 0 && <p className="text-sm text-muted-foreground">No holidays.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- TRAINERS ---------------- */
function TrainersTab() {
  const qc = useQueryClient();
  const { data: trainers = [] } = useQuery({
    queryKey: ["a-trainers"],
    queryFn: async () => (await supabase.from("trainers").select("*").order("name")).data ?? [],
  });
  const [form, setForm] = useState({ name: "", specialty: "", bio: "", photo_url: "", experience_years: 0 });

  async function add() {
    if (!form.name || !form.specialty) return toast.error("Name & specialty required");
    const { error } = await supabase.from("trainers").insert(form);
    if (error) return toast.error(error.message);
    setForm({ name: "", specialty: "", bio: "", photo_url: "", experience_years: 0 });
    qc.invalidateQueries({ queryKey: ["a-trainers"] });
    toast.success("Trainer added");
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base">Add trainer</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Specialty</Label><Input value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} /></div>
          <div><Label>Years experience</Label><Input type="number" value={form.experience_years} onChange={(e) => setForm({ ...form, experience_years: Number(e.target.value) })} /></div>
          <div><Label>Photo URL</Label><Input value={form.photo_url} onChange={(e) => setForm({ ...form, photo_url: e.target.value })} /></div>
          <div><Label>Bio</Label><Textarea rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></div>
          <Button onClick={add} className="bg-gradient-red text-primary-foreground">Add trainer</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Current team</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {trainers.map((t: any) => (
            <div key={t.id} className="flex items-center justify-between gap-3 rounded border border-border p-3 text-sm">
              <div className="min-w-0">
                <div className="truncate font-medium">{t.name}</div>
                <div className="truncate text-xs text-muted-foreground">{t.specialty} · {t.experience_years}y</div>
              </div>
              <DeleteBtn onConfirm={async () => { await supabase.from("trainers").delete().eq("id", t.id); qc.invalidateQueries({ queryKey: ["a-trainers"] }); }} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- CONTACT ---------------- */
function ContactTab() {
  const qc = useQueryClient();
  const { data: msgs = [] } = useQuery({
    queryKey: ["a-contact"],
    queryFn: async () => (await supabase.from("contact_messages").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  return (
    <div className="space-y-2">
      {msgs.map((m: any) => (
        <Card key={m.id}>
          <CardContent className="flex flex-wrap items-start justify-between gap-4 py-4">
            <div className="min-w-0">
              <div className="font-medium">{m.name} <span className="font-normal text-muted-foreground">— {m.email}{m.phone ? ` · ${m.phone}` : ""}</span></div>
              <div className="mt-1 text-sm">{m.message}</div>
              <div className="mt-1 text-xs text-muted-foreground">{fmtDate(m.created_at)}</div>
            </div>
            <DeleteBtn onConfirm={async () => { await supabase.from("contact_messages").delete().eq("id", m.id); qc.invalidateQueries({ queryKey: ["a-contact"] }); }} />
          </CardContent>
        </Card>
      ))}
      {msgs.length === 0 && <p className="text-sm text-muted-foreground">No messages.</p>}
    </div>
  );
}

/* ---------------- helpers ---------------- */
function DeleteBtn({ onConfirm }: { onConfirm: () => void | Promise<void> }) {
  return (
    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete? This cannot be undone.")) onConfirm(); }}>
      <Trash2 className="h-4 w-4 text-destructive" />
    </Button>
  );
}

function exportCSV(filename: string, rows: any[]) {
  if (!rows.length) return toast.info("Nothing to export");
  const headers = Object.keys(rows[0]).filter((k) => typeof rows[0][k] !== "object");
  const csv = [headers.join(",")]
    .concat(rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(",")))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${filename}-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  URL.revokeObjectURL(url);
}
