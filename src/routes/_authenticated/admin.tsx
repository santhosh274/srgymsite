import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Search, Trash2, Megaphone, Download, Settings, Calendar,
  CheckCircle2, Clock, AlertCircle, Eye, EyeOff, UserPlus,
  KeyRound, Dumbbell, Utensils, Plus, X,
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
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
  },
  component: Admin,
});

function Admin() {
  return (
    <AppShell title="Admin Control" subtitle="Manage your gym">
      <Tabs defaultValue="members">
        <TabsList className="flex flex-wrap bg-muted">
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="active">Active Members</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="due">Due Payments</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="notifs">Broadcast</TabsTrigger>
          <TabsTrigger value="holidays">Holidays</TabsTrigger>
        </TabsList>
        <TabsContent value="members" className="mt-5"><MembersTab /></TabsContent>
        <TabsContent value="active" className="mt-5"><ActiveMembersTab /></TabsContent>
        <TabsContent value="attendance" className="mt-5"><AttendanceTab /></TabsContent>
        <TabsContent value="due" className="mt-5"><DuePaymentsTab /></TabsContent>
        <TabsContent value="plans" className="mt-5"><PlansTab /></TabsContent>
        <TabsContent value="notifs" className="mt-5"><BroadcastTab /></TabsContent>
        <TabsContent value="holidays" className="mt-5"><HolidaysTab /></TabsContent>
      </Tabs>
    </AppShell>
  );
}

/* ---------------- ATTENDANCE ---------------- */
function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function AttendanceTab() {
  const today = localDateStr();
  const yesterday = localDateStr(new Date(Date.now() - 86400000));
  const [selectedDate, setSelectedDate] = useState(today);
  const [q, setQ] = useState("");
  const qc = useQueryClient();

  const { data: checkins = [], isLoading } = useQuery({
    queryKey: ["a-attendance-date", selectedDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("*, profiles(full_name, phone)")
        .gte("check_in", `${selectedDate}T00:00:00`)
        .lte("check_in", `${selectedDate}T23:59:59`)
        .order("check_in", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function handleCheckOut(id: string, memberName: string) {
    const now = new Date();
    const localISO = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString();
    const { error } = await supabase.from("attendance").update({ check_out: localISO } as any).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`${memberName} checked out`);
    qc.invalidateQueries({ queryKey: ["a-attendance-date", selectedDate] });
  }

  const filtered = checkins.filter((c: any) =>
    !q || c.profiles?.full_name?.toLowerCase().includes(q.toLowerCase())
  );

  const quickDates = [{ label: "Today", value: today }, { label: "Yesterday", value: yesterday }];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" /> Attendance Log
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-2">
            {quickDates.map((d) => (
              <Button key={d.value} size="sm" variant={selectedDate === d.value ? "default" : "outline"} onClick={() => setSelectedDate(d.value)}>
                {d.label}
              </Button>
            ))}
          </div>
          <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-auto" />
          <div className="flex items-center gap-2 ml-auto">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search member name" value={q} onChange={(e) => setQ(e.target.value)} className="w-48" />
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <span>
            <span className="font-semibold text-foreground">{filtered.length}</span> check-in{filtered.length !== 1 ? "s" : ""} on{" "}
            <span className="font-semibold text-foreground">
              {selectedDate === today ? "Today" : selectedDate === yesterday ? "Yesterday" : fmtDate(selectedDate)}
            </span>
          </span>
        </div>
        <div className="overflow-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Member</th>
                <th className="px-4 py-3 text-left">Phone</th>
                <th className="px-4 py-3 text-left">Check-in time</th>
                <th className="px-4 py-3 text-left">Check-out time</th>
                <th className="px-4 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>}
              {!isLoading && filtered.map((a: any, i: number) => (
                <tr key={a.id} className="border-t border-border">
                  <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-3 font-medium">{a.profiles?.full_name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{a.profiles?.phone ?? "—"}</td>
                  <td className="px-4 py-3">
                    {a.check_in ? (
                      <Badge variant="outline" className="text-green-600 border-green-300">
                        {new Date(a.check_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </Badge>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {a.check_out
                      ? new Date(a.check_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                      : <span className="text-xs italic">still in</span>}
                  </td>
                  <td className="px-4 py-3">
                    {!a.check_out ? (
                      <Button size="sm" variant="outline" className="border-blue-400 text-blue-600 hover:bg-blue-50"
                        onClick={() => handleCheckOut(a.id, a.profiles?.full_name ?? "Member")}>
                        <Clock className="mr-1.5 h-3.5 w-3.5" /> Check Out
                      </Button>
                    ) : <span className="text-xs text-muted-foreground italic">Done</span>}
                  </td>
                </tr>
              ))}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No check-ins for this date.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------- ACTIVE MEMBERS ---------------- */
function ActiveMembersTab() {
  const [q, setQ] = useState("");
  const { data: members = [], isLoading } = useQuery({
    queryKey: ["a-active-members"],
    queryFn: async () => (await supabase.rpc("admin_get_members")).data ?? [],
  });

  const activeMembers = useMemo(() => {
    return (members as any[]).filter((m: any) => {
      const latest = m.memberships?.sort((a: any, b: any) => (a.end_date < b.end_date ? 1 : -1))[0];
      return latest && daysBetween(latest.end_date) >= 0;
    });
  }, [members]);

  const filtered = activeMembers.filter((m: any) =>
    !q || m.full_name?.toLowerCase().includes(q.toLowerCase()) || m.email?.toLowerCase().includes(q.toLowerCase()) || m.phone?.includes(q)
  );

  const sorted = [...filtered].sort((a: any, b: any) => {
    const aL = a.memberships?.sort((x: any, y: any) => (x.end_date < y.end_date ? 1 : -1))[0];
    const bL = b.memberships?.sort((x: any, y: any) => (x.end_date < y.end_date ? 1 : -1))[0];
    return (aL?.end_date ?? "") < (bL?.end_date ?? "") ? -1 : 1;
  });

  function expiryBadge(endDate: string) {
    const days = daysBetween(endDate);
    if (days <= 7) return <Badge variant="destructive">Expires in {days}d</Badge>;
    if (days <= 30) return <Badge variant="outline" className="border-yellow-400 text-yellow-600">Expires in {days}d</Badge>;
    return <Badge variant="default">{fmtDate(endDate)}</Badge>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          Active Members
          <Badge variant="secondary" className="ml-1">{activeMembers.length}</Badge>
        </CardTitle>
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search name / email / phone" value={q} onChange={(e) => setQ(e.target.value)} className="w-64" />
        </div>
      </CardHeader>
      <CardContent className="overflow-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Contact</th>
              <th className="px-4 py-3 text-left">Plan</th>
              <th className="px-4 py-3 text-left">Started</th>
              <th className="px-4 py-3 text-left">Expires</th>
              <th className="px-4 py-3 text-left">Payment due</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>}
            {!isLoading && sorted.map((m: any) => {
              const latest = m.memberships?.sort((a: any, b: any) => (a.end_date < b.end_date ? 1 : -1))[0];
              const pendingPayment = (m.payments ?? []).find((p: any) => p.status === "pending" || p.status === "overdue");
              return (
                <tr key={m.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{m.full_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <div>{m.email}</div>
                    <div className="text-xs">{m.phone}</div>
                  </td>
                  <td className="px-4 py-3">{latest?.membership_plans?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{fmtDate(latest?.start_date)}</td>
                  <td className="px-4 py-3">{latest ? expiryBadge(latest.end_date) : "—"}</td>
                  <td className="px-4 py-3">
                    {pendingPayment ? (
                      <div>
                        <div className="font-medium text-destructive">{INR(pendingPayment.amount)}</div>
                        <div className="text-xs text-muted-foreground">Due {fmtDate(pendingPayment.due_date)}</div>
                      </div>
                    ) : (
                      <Badge variant="outline" className="border-green-400 text-green-600 text-xs">Paid</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
            {!isLoading && sorted.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No active members.</td></tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

/* ---------------- DUE PAYMENTS ---------------- */
function DuePaymentsTab() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"due" | "history">("due");

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["a-due-payments"],
    queryFn: async () => (await supabase.rpc("admin_get_members")).data ?? [],
  });

  const dueMembers = useMemo(() => {
    return (members as any[]).filter((m: any) => {
      const latest = m.memberships?.sort((a: any, b: any) => (a.end_date < b.end_date ? 1 : -1))[0];
      if (!latest) return false;
      return daysBetween(latest.end_date) <= 7;
    }).sort((a: any, b: any) => {
      const aL = a.memberships?.sort((x: any, y: any) => (x.end_date < y.end_date ? 1 : -1))[0];
      const bL = b.memberships?.sort((x: any, y: any) => (x.end_date < y.end_date ? 1 : -1))[0];
      return (aL?.end_date ?? "") < (bL?.end_date ?? "") ? -1 : 1;
    });
  }, [members]);

  const { data: allPayments = [], isLoading: payLoading } = useQuery({
    queryKey: ["a-payment-history"],
    queryFn: async () =>
      (await supabase.from("payments").select("*, profiles(full_name, phone)").order("paid_at", { ascending: false }).limit(200)).data ?? [],
    enabled: tab === "history",
  });

  async function markPaidOffline(member: any) {
    const latest = member.memberships?.sort((a: any, b: any) => (a.end_date < b.end_date ? 1 : -1))[0];
    if (!latest) return toast.error("No membership found");
    const pendingPmt = (member.payments ?? []).find((p: any) => p.status === "pending" || p.status === "overdue");
    if (pendingPmt) {
      const { error } = await supabase.from("payments").update({
        status: "paid", paid_at: new Date().toISOString(),
        receipt_no: "OFF-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
      }).eq("id", pendingPmt.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("payments").insert({
        user_id: member.id, amount: latest.membership_plans?.price ?? 0, due_date: latest.end_date,
        paid_at: new Date().toISOString(), status: "paid",
        receipt_no: "OFF-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
      });
      if (error) return toast.error(error.message);
    }
    await supabase.from("notifications").insert({
      user_id: member.id, title: "Payment recorded",
      message: `Offline payment received for ${latest.membership_plans?.name ?? "membership"}. Thank you!`, type: "success",
    });
    toast.success(`Marked ${member.full_name} as paid (offline)`);
    qc.invalidateQueries({ queryKey: ["a-due-payments"] });
    qc.invalidateQueries({ queryKey: ["a-payment-history"] });
  }

  function urgencyBadge(endDate: string) {
    const days = daysBetween(endDate);
    if (days < 0) return <Badge variant="destructive">Expired {Math.abs(days)}d ago</Badge>;
    if (days === 0) return <Badge variant="destructive">Expires today</Badge>;
    return <Badge variant="outline" className="border-orange-400 text-orange-600">Expires in {days}d</Badge>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-orange-500" /> Due Payments
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="due">
              Due / Expiring Soon
              {dueMembers.length > 0 && <Badge variant="destructive" className="ml-2 text-xs">{dueMembers.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="history">Payment History</TabsTrigger>
          </TabsList>
          <TabsContent value="due" className="mt-4">
            <div className="overflow-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Member</th>
                    <th className="px-4 py-3 text-left">Contact</th>
                    <th className="px-4 py-3 text-left">Plan</th>
                    <th className="px-4 py-3 text-left">Expires</th>
                    <th className="px-4 py-3 text-left">Amount due</th>
                    <th className="px-4 py-3 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>}
                  {!isLoading && dueMembers.map((m: any) => {
                    const latest = m.memberships?.sort((a: any, b: any) => (a.end_date < b.end_date ? 1 : -1))[0];
                    const pendingPmt = (m.payments ?? []).find((p: any) => p.status === "pending" || p.status === "overdue");
                    const amount = pendingPmt?.amount ?? latest?.membership_plans?.price ?? 0;
                    return (
                      <tr key={m.id} className="border-t border-border">
                        <td className="px-4 py-3 font-medium">{m.full_name}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          <div>{m.email}</div>
                          <div className="text-xs">{m.phone}</div>
                        </td>
                        <td className="px-4 py-3">{latest?.membership_plans?.name ?? "—"}</td>
                        <td className="px-4 py-3">{latest ? urgencyBadge(latest.end_date) : "—"}</td>
                        <td className="px-4 py-3 font-semibold text-destructive">{INR(amount)}</td>
                        <td className="px-4 py-3">
                          <Button size="sm" variant="outline" className="border-green-500 text-green-600 hover:bg-green-50"
                            onClick={() => { if (confirm(`Mark ${m.full_name} as paid offline?`)) markPaidOffline(m); }}>
                            <CheckCircle2 className="mr-1.5 h-4 w-4" /> Paid Offline
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {!isLoading && dueMembers.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">🎉 No due payments within 7 days.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>
          <TabsContent value="history" className="mt-4">
            <div className="overflow-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Member</th>
                    <th className="px-4 py-3 text-left">Amount</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Paid on</th>
                    <th className="px-4 py-3 text-left">Due date</th>
                    <th className="px-4 py-3 text-left">Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {payLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>}
                  {!payLoading && (allPayments as any[]).map((p: any) => (
                    <tr key={p.id} className="border-t border-border">
                      <td className="px-4 py-3 font-medium">
                        {p.profiles?.full_name ?? "—"}
                        {p.profiles?.phone && <div className="text-xs text-muted-foreground">{p.profiles.phone}</div>}
                      </td>
                      <td className="px-4 py-3 font-semibold">{INR(p.amount)}</td>
                      <td className="px-4 py-3">
                        {p.status === "paid" && <Badge variant="default" className="bg-green-600">Paid</Badge>}
                        {p.status === "pending" && <Badge variant="outline" className="border-yellow-400 text-yellow-600">Pending</Badge>}
                        {p.status === "overdue" && <Badge variant="destructive">Overdue</Badge>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{p.paid_at ? fmtDate(p.paid_at) : <span className="italic text-xs">—</span>}</td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtDate(p.due_date)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{p.receipt_no ?? "—"}</td>
                    </tr>
                  ))}
                  {!payLoading && allPayments.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No payment records found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
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

  function refresh() {
    setRefreshKey((k) => k + 1);
    qc.invalidateQueries({ queryKey: ["mem-list"] });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">Members</CardTitle>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex w-full max-w-xs items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search name / email / phone" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <AddUserDialog onDone={refresh} />
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
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m: any) => {
              const latest = m.memberships?.sort((a: any, b: any) => (a.end_date < b.end_date ? 1 : -1))[0];
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
                    {latest
                      ? <Badge variant={expired ? "destructive" : "default"}>{fmtDate(latest.end_date)}</Badge>
                      : <Badge variant="secondary">none</Badge>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{fmtDate(m.joined_at)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={m.role === "admin" ? "default" : "secondary"} className="text-xs">
                      {m.role ?? "member"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <AssignDialog member={m} onDone={refresh} />
                      <EditUserDialog member={m} onDone={refresh} />
                      <DeleteBtn onConfirm={async () => {
                        const { error } = await supabase.from("profiles").delete().eq("id", m.id);
                        if (error) toast.error(error.message);
                        else { toast.success("Member removed"); refresh(); }
                      }} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No members.</td></tr>
            )}
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
      m.full_name ?? "", m.email ?? "", m.phone ?? "",
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

/* ---- Add User Dialog ---- */
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
        email, password,
        options: { data: { full_name: fullName.trim(), phone: phone.trim() } },
      });
      if (signUpErr) throw signUpErr;
      if (!signUpData?.user) throw new Error("Signup returned no user");

      const { error: restoreErr } = await supabase.auth.setSession({ access_token: adminToken, refresh_token: adminRefresh! });
      if (restoreErr) throw new Error(`Failed to restore admin session: ${restoreErr.message}`);

      const { data: verifySession } = await supabase.auth.getSession();
      if (verifySession.session?.user?.id !== adminUserId) throw new Error("Session was not properly restored");

      const { error: rpcErr } = await supabase.rpc("admin_create_user", { p_id_no: idNo.trim(), p_password: password });
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
        <Button size="sm"><UserPlus className="mr-1.5 h-4 w-4" /> Add Member</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Add new member</DialogTitle></DialogHeader>
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
            {loading ? "Creating..." : "Create Member"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---- Edit User Dialog ---- */
function EditUserDialog({ member, onDone }: { member: any; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(member.full_name ?? "");
  const [phone, setPhone] = useState(member.phone ?? "");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const userId = member.email?.replace(/@srgym\.local$/, "") ?? member.id;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const profileUpdates: any = { full_name: name };
      if (phone) profileUpdates.phone = phone;
      const { error: profileErr } = await supabase.from("profiles").update(profileUpdates).eq("id", member.id);
      if (profileErr) throw profileErr;

      if (password) {
        const { error: rpcErr } = await supabase.rpc("admin_update_user", { p_user_id: userId, p_password: password, p_name: name });
        if (rpcErr) throw rpcErr;
      }

      toast.success("Member updated");
      setOpen(false);
      setPassword("");
      onDone();
    } catch (err: any) {
      toast.error(err.message || "Failed to update member");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="mr-1">
          <KeyRound className="h-3.5 w-3.5 mr-1" /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-muted-foreground" /> Edit — {member.full_name}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="eu-idno">ID No</Label>
            <Input id="eu-idno" value={userId} disabled className="opacity-60 cursor-not-allowed" />
            <p className="text-xs text-muted-foreground mt-1">ID cannot be changed after creation.</p>
          </div>
          <div>
            <Label htmlFor="eu-name">Full Name</Label>
            <Input id="eu-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="eu-phone">Phone</Label>
            <Input id="eu-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="eu-pw">New Password <span className="text-muted-foreground font-normal">(leave blank to keep)</span></Label>
            <div className="relative">
              <Input id="eu-pw" type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
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

/* ---- Assign Dialog (Membership + Payment + Workout + Diet) ---- */
function AssignDialog({ member, onDone }: any) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"membership" | "payment" | "workout" | "diet">("membership");

  /* membership state */
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

  const plan = plans.find((p: any) => p.id === planId);
  const endDate = plan
    ? new Date(new Date(start).setMonth(new Date(start).getMonth() + plan.duration_months)).toISOString().slice(0, 10)
    : "";

  /* workout / diet state */
  const qc = useQueryClient();

  const { data: memberPlans = [], isLoading: plansLoading } = useQuery({
    queryKey: ["member-plans", member.id],
    queryFn: async () =>
      (await supabase.from("member_plans").select("*").eq("user_id", member.id).order("assigned_at", { ascending: false })).data ?? [],
    enabled: open && (tab === "workout" || tab === "diet"),
  });

  const [wpTitle, setWpTitle] = useState("");
  const [wpContent, setWpContent] = useState("");
  const [dpTitle, setDpTitle] = useState("");
  const [dpContent, setDpContent] = useState("");
  const [saving, setSaving] = useState(false);

  async function assignMembership() {
    if (!plan) return toast.error("Pick a plan");
    const { error } = await supabase.from("memberships").insert({
      user_id: member.id, plan_id: plan.id, start_date: start, end_date: endDate, status: "active",
    });
    if (error) return toast.error(error.message);
    await supabase.from("payments").insert({ user_id: member.id, amount: plan.price, due_date: start, status: "pending" });
    await supabase.from("notifications").insert({
      user_id: member.id, title: "Welcome aboard 🎉",
      message: `Your ${plan.name} membership is now active until ${endDate}.`, type: "success",
    });
    toast.success("Membership assigned"); setOpen(false); onDone();
  }

  async function logPayment() {
    if (!amount) return toast.error("Enter amount");
    const { error } = await supabase.from("payments").insert({
      user_id: member.id, amount: Number(amount), due_date: due,
      paid_at: new Date().toISOString(), status: "paid",
      receipt_no: "RCP-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
    });
    if (error) return toast.error(error.message);
    await supabase.from("notifications").insert({
      user_id: member.id, title: "Payment received",
      message: `We received ${INR(amount)}. Thank you!`, type: "success",
    });
    toast.success("Payment recorded"); setOpen(false); onDone();
  }

  async function savePlan(type: "workout" | "diet") {
    const title = type === "workout" ? wpTitle : dpTitle;
    const content = type === "workout" ? wpContent : dpContent;
    if (!title.trim() || !content.trim()) return toast.error("Title and content are required");
    setSaving(true);
    try {
      const { error } = await supabase.from("member_plans").insert({
        user_id: member.id, type, title: title.trim(), content: content.trim(),
      });
      if (error) throw error;
      await supabase.from("notifications").insert({
        user_id: member.id,
        title: type === "workout" ? "New Workout Plan 💪" : "New Diet Plan 🥗",
        message: `Your trainer has assigned a new ${type} plan: "${title}". Check it out!`,
        type: "info",
      });
      toast.success(`${type === "workout" ? "Workout" : "Diet"} plan saved`);
      if (type === "workout") { setWpTitle(""); setWpContent(""); }
      else { setDpTitle(""); setDpContent(""); }
      qc.invalidateQueries({ queryKey: ["member-plans", member.id] });
    } catch (err: any) {
      toast.error(err.message || "Failed to save plan");
    } finally {
      setSaving(false);
    }
  }

  async function deletePlan(id: string) {
    const { error } = await supabase.from("member_plans").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Plan removed");
    qc.invalidateQueries({ queryKey: ["member-plans", member.id] });
  }

  const workoutPlans = (memberPlans as any[]).filter((p) => p.type === "workout");
  const dietPlans = (memberPlans as any[]).filter((p) => p.type === "diet");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline">Manage</Button></DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage — {member.full_name}</DialogTitle>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="grid grid-cols-4">
            <TabsTrigger value="membership">Plan</TabsTrigger>
            <TabsTrigger value="payment">Payment</TabsTrigger>
            <TabsTrigger value="workout" className="flex items-center gap-1.5">
              <Dumbbell className="h-3.5 w-3.5" /> Workout
            </TabsTrigger>
            <TabsTrigger value="diet" className="flex items-center gap-1.5">
              <Utensils className="h-3.5 w-3.5" /> Diet
            </TabsTrigger>
          </TabsList>

          {/* ---- Membership tab ---- */}
          <TabsContent value="membership" className="mt-4 space-y-3">
            <Label>Plan</Label>
            <div className="grid grid-cols-2 gap-2">
              {tiers.map((tier) => {
                const p = plans.find((pl: any) => pl.name === tier.name);
                const selected = planId === p?.id;
                return (
                  <button key={tier.name} type="button" onClick={() => p && setPlanId(p.id)} disabled={!p}
                    className={`rounded-lg border p-3 text-left transition-colors ${selected ? "border-primary bg-primary/10" : "border-border"} ${!p ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:border-primary/50"}`}>
                    <div className="font-medium">{tier.name}</div>
                    <div className="text-sm text-muted-foreground">{p ? `${INR(p.price)} / ${tier.name}` : "Not configured"}</div>
                  </button>
                );
              })}
            </div>
            <div><Label>Start date</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
            {endDate && <p className="text-sm text-muted-foreground">Ends: <span className="font-medium text-foreground">{fmtDate(endDate)}</span></p>}
            <Button onClick={assignMembership} className="w-full bg-gradient-red text-primary-foreground">Assign & invoice</Button>
          </TabsContent>

          {/* ---- Payment tab ---- */}
          <TabsContent value="payment" className="mt-4 space-y-3">
            <div><Label>Amount (₹)</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div><Label>Due date</Label><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>
            <Button onClick={logPayment} className="w-full bg-gradient-red text-primary-foreground">Record paid</Button>
          </TabsContent>

          {/* ---- Workout tab ---- */}
          <TabsContent value="workout" className="mt-4 space-y-4">
            <div className="rounded-lg border border-border p-4 space-y-3 bg-muted/30">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" /> Add Workout Plan
              </h3>
              <div>
                <Label>Title</Label>
                <Input value={wpTitle} onChange={(e) => setWpTitle(e.target.value)} placeholder="e.g. Chest & Triceps Day" />
              </div>
              <div>
                <Label>Plan details</Label>
                <Textarea
                  rows={5}
                  value={wpContent}
                  onChange={(e) => setWpContent(e.target.value)}
                  placeholder={"e.g.\nBench Press — 4×10\nIncline DB Press — 3×12\nTricep Pushdown — 3×15\n..."}
                />
              </div>
              <Button onClick={() => savePlan("workout")} disabled={saving} className="w-full bg-gradient-red text-primary-foreground">
                <Dumbbell className="mr-1.5 h-4 w-4" /> {saving ? "Saving…" : "Save Workout Plan"}
              </Button>
            </div>

            {/* Existing workout plans */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Assigned Plans ({workoutPlans.length})
              </h3>
              {plansLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
              {!plansLoading && workoutPlans.length === 0 && (
                <p className="text-sm text-muted-foreground italic">No workout plans assigned yet.</p>
              )}
              {workoutPlans.map((p: any) => (
                <div key={p.id} className="rounded-lg border border-border p-3 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">{p.title}</p>
                      <p className="text-xs text-muted-foreground">{fmtDate(p.assigned_at)}</p>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete this plan?")) deletePlan(p.id); }}>
                      <X className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap bg-muted rounded p-2 mt-1">{p.content}</pre>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ---- Diet tab ---- */}
          <TabsContent value="diet" className="mt-4 space-y-4">
            <div className="rounded-lg border border-border p-4 space-y-3 bg-muted/30">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" /> Add Diet Plan
              </h3>
              <div>
                <Label>Title</Label>
                <Input value={dpTitle} onChange={(e) => setDpTitle(e.target.value)} placeholder="e.g. High Protein Cutting Diet" />
              </div>
              <div>
                <Label>Plan details</Label>
                <Textarea
                  rows={5}
                  value={dpContent}
                  onChange={(e) => setDpContent(e.target.value)}
                  placeholder={"e.g.\nBreakfast: 6 eggs, oats, banana\nLunch: Chicken breast, rice, veggies\nSnack: Whey protein + almonds\nDinner: Paneer, salad, chapati\n..."}
                />
              </div>
              <Button onClick={() => savePlan("diet")} disabled={saving} className="w-full bg-gradient-red text-primary-foreground">
                <Utensils className="mr-1.5 h-4 w-4" /> {saving ? "Saving…" : "Save Diet Plan"}
              </Button>
            </div>

            {/* Existing diet plans */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Assigned Plans ({dietPlans.length})
              </h3>
              {plansLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
              {!plansLoading && dietPlans.length === 0 && (
                <p className="text-sm text-muted-foreground italic">No diet plans assigned yet.</p>
              )}
              {dietPlans.map((p: any) => (
                <div key={p.id} className="rounded-lg border border-border p-3 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">{p.title}</p>
                      <p className="text-xs text-muted-foreground">{fmtDate(p.assigned_at)}</p>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete this plan?")) deletePlan(p.id); }}>
                      <X className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap bg-muted rounded p-2 mt-1">{p.content}</pre>
                </div>
              ))}
            </div>
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
      const { error } = await supabase.from("membership_plans").insert({ name, duration_months: months, price, is_active: true });
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
            <CardHeader><CardTitle className="text-base">{tier.name}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Price (₹)</Label>
                <Input type="number" value={prices[tier.name] ?? plan?.price ?? ""} placeholder="0"
                  onChange={(e) => setPrices({ ...prices, [tier.name]: Number(e.target.value) })} />
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
              {plan && <p className="text-xs text-muted-foreground">{plan.is_active ? "Active" : "Disabled"} · {plan.duration_months}mo</p>}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/* ---------------- BROADCAST ---------------- */
function BroadcastTab() {
  const [form, setForm] = useState({ title: "", message: "", type: "info" });
  const [sending, setSending] = useState(false);

  async function send() {
    if (!form.title || !form.message) return toast.error("Title & message required");
    setSending(true);
    try {
      const { data: profiles, error: profilesErr } = await supabase.from("profiles").select("id");
      if (profilesErr) throw profilesErr;
      if (!profiles || profiles.length === 0) { toast.info("No members to notify."); return; }
      const rows = profiles.map((p: any) => ({ user_id: p.id, title: form.title, message: form.message, type: form.type }));
      const { error } = await supabase.from("notifications").insert(rows);
      if (error) throw error;
      toast.success(`Broadcast sent to ${profiles.length} member${profiles.length !== 1 ? "s" : ""}`);
      setForm({ title: "", message: "", type: "info" });
    } catch (err: any) {
      toast.error(err.message || "Failed to send broadcast");
    } finally {
      setSending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-primary" /> Broadcast notification
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">Sends a notification to every member's inbox individually.</p>
        <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Gym closed tomorrow" /></div>
        <div><Label>Message</Label><Textarea rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Write your message here…" /></div>
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
        <Button onClick={send} disabled={sending} className="bg-gradient-red text-primary-foreground">
          <Megaphone className="mr-1.5 h-4 w-4" />
          {sending ? "Sending…" : "Send to all members"}
        </Button>
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
  const [adding, setAdding] = useState(false);

  async function add() {
    if (!form.date || !form.title) return toast.error("Date & title required");
    setAdding(true);
    try {
      const { error } = await supabase.from("holidays").insert(form);
      if (error) throw error;
      const { data: profiles, error: pErr } = await supabase.from("profiles").select("id");
      if (pErr) throw pErr;
      if (profiles && profiles.length > 0) {
        const rows = profiles.map((p: any) => ({
          user_id: p.id, title: `Holiday: ${form.title}`,
          message: `Gym closed on ${form.date}.${form.description ? " " + form.description : ""}`, type: "holiday",
        }));
        await supabase.from("notifications").insert(rows);
      }
      setForm({ date: "", title: "", description: "" });
      qc.invalidateQueries({ queryKey: ["a-holidays"] });
      toast.success("Holiday added & broadcast sent");
    } catch (err: any) {
      toast.error(err.message || "Failed to add holiday");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base">Add holiday</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
          <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><Label>Description</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <Button onClick={add} disabled={adding} className="bg-gradient-red text-primary-foreground">
            {adding ? "Adding…" : "Add holiday"}
          </Button>
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
                {h.description && <div className="text-xs text-muted-foreground mt-0.5">{h.description}</div>}
              </div>
              <DeleteBtn onConfirm={async () => {
                await supabase.from("holidays").delete().eq("id", h.id);
                qc.invalidateQueries({ queryKey: ["a-holidays"] });
              }} />
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
  a.href = url; a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  URL.revokeObjectURL(url);
}