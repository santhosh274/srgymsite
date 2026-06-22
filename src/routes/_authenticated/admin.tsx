import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Users, Search, Plus, Trash2, Megaphone, Download, IndianRupee, TrendingUp, Activity,
  Eye, EyeOff, UserPlus, BellRing, Settings,
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
    <AppShell title="Admin Control" subtitle="Manage your gym">
      <Tabs defaultValue="overview">
        <TabsList className="flex flex-wrap bg-muted">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="notifs">Broadcast</TabsTrigger>
          <TabsTrigger value="holidays">Holidays</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-5"><Overview /></TabsContent>
        <TabsContent value="members" className="mt-5"><MembersTab /></TabsContent>
        <TabsContent value="plans" className="mt-5"><PlansTab /></TabsContent>
        <TabsContent value="users" className="mt-5"><UsersTab /></TabsContent>
        <TabsContent value="notifs" className="mt-5"><BroadcastTab /></TabsContent>
        <TabsContent value="holidays" className="mt-5"><HolidaysTab /></TabsContent>
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
  const { data: todayCheckins = [] } = useQuery({
    queryKey: ["a-today-checkins"],
    queryFn: async () =>
      (await supabase.from("attendance").select("*, profiles(full_name)").eq("date", new Date().toISOString().slice(0, 10)).order("check_in", { ascending: false })).data ?? [],
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
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Today's check-ins ({todayCheckins.length})</CardTitle>
          <Button variant="outline" size="sm" onClick={async () => {
            const { error } = await supabase.rpc("check_renewals");
            if (error) toast.error(error.message);
            else toast.success("Renewal notifications checked");
          }}><BellRing className="mr-1.5 h-4 w-4" /> Check renewals</Button>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-3">
            {todayCheckins.map((a: any) => (
              <div key={a.id} className="rounded-lg border border-border bg-surface p-3 text-sm">
                <div className="font-medium">{a.profiles?.full_name}</div>
                <div className="text-xs text-muted-foreground">{new Date(a.check_in).toLocaleTimeString()}</div>
              </div>
            ))}
            {todayCheckins.length === 0 && <p className="text-sm text-muted-foreground">No check-ins yet today.</p>}
          </div>
        </CardContent>
      </Card>

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
  const [refreshKey, setRefreshKey] = useState(0);
  const { data: members = [] } = useQuery({
    queryKey: ["mem-list", refreshKey],
    queryFn: async () => (await supabase.rpc("admin_get_members")).data ?? [],
  });

  const filtered = members.filter((m: any) =>
    !q || m.full_name?.toLowerCase().includes(q.toLowerCase()) || m.email?.toLowerCase().includes(q.toLowerCase()) || m.phone?.includes(q)
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">Members</CardTitle>
        <div className="flex items-center gap-2">
          <div className="flex w-full max-w-xs items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search name / email / phone" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <AddUserDialog onDone={() => setRefreshKey((k) => k + 1)} />
          <Button variant="outline" size="sm" onClick={() => exportMembersCSV(filtered)}>
            <Download className="mr-1.5 h-4 w-4" /> Export CSV
          </Button>
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

function exportMembersCSV(members: any[]) {
  if (!members.length) return toast.info("Nothing to export");
  const headers = ["Name", "Email", "Phone", "Plan", "Expires", "Status", "Joined"];
  const rows = members.map((m: any) => {
    const latest = m.memberships?.sort((a: any, b: any) => (a.end_date < b.end_date ? 1 : -1))[0];
    const expired = latest ? daysBetween(latest.end_date) < 0 : true;
    return [
      m.full_name ?? "",
      m.email ?? "",
      m.phone ?? "",
      latest?.membership_plans?.name ?? "—",
      latest ? fmtDate(latest.end_date) : "—",
      expired ? "Expired" : latest ? "Active" : "No plan",
      fmtDate(m.joined_at),
    ];
  });
  const csv = [headers.join(","), ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `members-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function AddUserDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [idNo, setIdNo] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!idNo || !password || !fullName) return toast.error("ID No, password, and name are required.");

    setLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const adminToken = sessionData.session?.access_token;
      const adminRefresh = sessionData.session?.refresh_token;
      const adminUserId = sessionData.session?.user?.id;
      if (!adminToken) throw new Error("No admin session");

      const email = `${idNo.trim().toLowerCase()}@srgym.local`;
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName.trim(), phone: phone.trim() } },
      });
      if (signUpErr) throw signUpErr;
      if (!signUpData?.user) throw new Error("Signup returned no user");

      const { error: restoreErr } = await supabase.auth.setSession({
        access_token: adminToken,
        refresh_token: adminRefresh!,
      });
      if (restoreErr) throw new Error(`Failed to restore admin session: ${restoreErr.message}`);

      const { data: verifySession } = await supabase.auth.getSession();
      if (verifySession.session?.user?.id !== adminUserId)
        throw new Error("Session was not properly restored");

      const { error: rpcErr } = await supabase.rpc("admin_create_user", {
        p_id_no: idNo.trim(),
        p_password: password,
      });
      if (rpcErr) throw rpcErr;

      toast.success(`User "${fullName}" created (ID: ${idNo})`);
      setOpen(false);
      setIdNo(""); setPassword(""); setFullName(""); setPhone("");
      onDone();
    } catch (err: any) {
      toast.error(err.message || "Failed to create user");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><UserPlus className="mr-1.5 h-4 w-4" /> Add User</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Add new user</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="au-idno">ID No</Label>
            <Input id="au-idno" value={idNo} onChange={(e) => setIdNo(e.target.value)} placeholder="e.g. newmember1" required />
          </div>
          <div>
            <Label htmlFor="au-name">Full Name</Label>
            <Input id="au-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. John Doe" required />
          </div>
          <div>
            <Label htmlFor="au-phone">Phone</Label>
            <Input id="au-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 9876543210" />
          </div>
          <div>
            <Label htmlFor="au-pw">Password</Label>
            <div className="relative">
              <Input id="au-pw" type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-gradient-red text-primary-foreground">
            {loading ? "Creating..." : "Create User"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
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
  const tiers = [
    { name: "Monthly", months: 1 },
    { name: "3 Months", months: 3 },
    { name: "6 Months", months: 6 },
    { name: "Yearly", months: 12 },
  ];
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
            <Label>Plan</Label>
            <div className="grid grid-cols-2 gap-2">
              {tiers.map((tier) => {
                const p = plans.find((pl: any) => pl.name === tier.name);
                const selected = planId === p?.id;
                return (
                  <button
                    key={tier.name}
                    type="button"
                    onClick={() => p && setPlanId(p.id)}
                    disabled={!p}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      selected ? 'border-primary bg-primary/10' : 'border-border'
                    } ${!p ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-primary/50'}`}
                  >
                    <div className="font-medium">{tier.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {p ? `${INR(p.price)} / ${tier.name}` : 'Not configured'}
                    </div>
                  </button>
                );
              })}
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

/* ---------------- PLANS (simplified 4-tier) ---------------- */
function PlansTab() {
  const qc = useQueryClient();
  const { data: plans = [] } = useQuery({
    queryKey: ["a-plans"],
    queryFn: async () => (await supabase.from("membership_plans").select("*").order("duration_months")).data ?? [],
  });

  const [prices, setPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    if (plans.length > 0) {
      const map: Record<string, number> = {};
      plans.forEach((p: any) => { map[p.name] = p.price; });
      setPrices((prev) => ({ ...prev, ...map }));
    }
  }, [plans]);

  const tiers = [
    { name: "Monthly", key: "monthly", months: 1 },
    { name: "3 Months", key: "3months", months: 3 },
    { name: "6 Months", key: "6months", months: 6 },
    { name: "Yearly", key: "yearly", months: 12 },
  ];

  async function savePrice(name: string, months: number) {
    const price = prices[name];
    if (!price || price <= 0) return toast.error("Enter a valid price");

    const existing = plans.find((p: any) => p.name === name);
    if (existing) {
      const { error } = await supabase.from("membership_plans").update({ price, duration_months: months }).eq("id", existing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("membership_plans").insert({
        name, duration_months: months, price, is_active: true,
      });
      if (error) return toast.error(error.message);
    }
    qc.invalidateQueries({ queryKey: ["a-plans"] });
    toast.success(`${name} plan updated`);
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      {tiers.map((tier) => {
        const plan = plans.find((p: any) => p.name === tier.name);
        return (
          <Card key={tier.key}>
            <CardHeader>
              <CardTitle className="text-base">{tier.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Price (₹)</Label>
                <Input
                  type="number"
                  value={prices[tier.name] ?? plan?.price ?? ""}
                  onChange={(e) => setPrices({ ...prices, [tier.name]: Number(e.target.value) })}
                  placeholder="0"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={() => savePrice(tier.name, tier.months)} className="flex-1 bg-gradient-red text-primary-foreground">
                  <Settings className="mr-1.5 h-4 w-4" /> Save
                </Button>
                {plan && (
                  <Button size="icon" variant="outline" onClick={async () => {
                    await supabase.from("membership_plans").update({ is_active: !plan.is_active }).eq("id", plan.id);
                    qc.invalidateQueries({ queryKey: ["a-plans"] });
                  }}>
                    {plan.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                )}
              </div>
              {plan && (
                <p className="text-xs text-muted-foreground">
                  {plan.is_active ? "Active" : "Disabled"} · {plan.duration_months}mo
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/* ---------------- USERS ---------------- */
function UsersTab() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const { data: users = [] } = useQuery({
    queryKey: ["a-users", refreshKey],
    queryFn: async () => (await supabase.from("auth").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const filtered = users.filter((u: any) =>
    !q || u.user_id?.toLowerCase().includes(q.toLowerCase()) || u.name?.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">Users</CardTitle>
        <div className="flex items-center gap-2">
          <div className="flex w-full max-w-xs items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search user ID / name" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <AddUserDialog onDone={() => setRefreshKey((k) => k + 1)} />
        </div>
      </CardHeader>
      <CardContent className="overflow-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">User ID</th>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Created</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u: any) => (
              <tr key={u.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{u.user_id}</td>
                <td className="px-4 py-3">{u.name ?? "—"}</td>
                <td className="px-4 py-3">
                  <Badge variant={u.role === "admin" ? "default" : "secondary"}>{u.role}</Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{fmtDate(u.created_at)}</td>
                <td className="px-4 py-3 text-right">
                  <EditUserDialog user={u} onDone={() => qc.invalidateQueries({ queryKey: ["a-users"] })} />
                  <DeleteBtn onConfirm={async () => {
                    const { error } = await supabase.rpc("admin_delete_user", { p_user_id: u.user_id });
                    if (error) toast.error(error.message);
                    else { toast.success("User deleted"); setRefreshKey((k) => k + 1); }
                  }} />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No users.</td></tr>}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function EditUserDialog({ user, onDone }: { user: any; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(user.name ?? "");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.rpc("admin_update_user", {
      p_user_id: user.user_id,
      p_password: password || undefined,
      p_name: name || undefined,
    });
    if (error) toast.error(error.message);
    else { toast.success("User updated"); setOpen(false); onDone(); }
    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline" className="mr-1">Edit</Button></DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Edit — {user.user_id}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="eu-name">Name</Label>
            <Input id="eu-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="eu-pw">Password (leave blank to keep)</Label>
            <div className="relative">
              <Input id="eu-pw" type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-gradient-red text-primary-foreground">
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
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
