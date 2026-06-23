import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Calendar, CreditCard, ClipboardList, Apple, Activity,
  PlayCircle, LogOut, BellRing, CheckCircle2, Clock, AlertCircle,
  Download, User, ChevronRight, Dumbbell, Utensils,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { INR, fmtDate, daysBetween } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "My Dashboard — SRGYM" }] }),
  // Redirect admins straight to /admin
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", u.user.id);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    if (isAdmin) throw redirect({ to: "/admin" });
  },
  component: MemberDashboard,
});

/* ─────────────────────────────────────────────
   ROOT COMPONENT
───────────────────────────────────────────── */
function MemberDashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();

  /* ── Data fetching ── */
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () =>
      (await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle()).data,
    enabled: !!user,
  });

  const { data: authData } = useQuery({
    queryKey: ["auth-name", user?.email],
    queryFn: async () => {
      const userId = user!.email!.split("@")[0];
      return (await supabase.from("auth").select("name").eq("user_id", userId).maybeSingle()).data;
    },
    enabled: !!user,
  });

  const { data: membership } = useQuery({
    queryKey: ["membership", user?.id],
    queryFn: async () =>
      (
        await supabase
          .from("memberships")
          .select("*, membership_plans(name, price)")
          .eq("user_id", user!.id)
          .order("end_date", { ascending: false })
          .limit(1)
          .maybeSingle()
      ).data,
    enabled: !!user,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["payments", user?.id],
    queryFn: async () =>
      (
        await supabase
          .from("payments")
          .select("*")
          .eq("user_id", user!.id)
          .order("due_date", { ascending: false })
      ).data ?? [],
    enabled: !!user,
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ["attendance", user?.id],
    queryFn: async () =>
      (
        (await supabase
          .from("attendance")
          .select("*")
          .eq("user_id", user!.id)
          .order("date", { ascending: false })
          .limit(60)) as any
      ).data ?? [],
    enabled: !!user,
  });

  const { data: workouts = [] } = useQuery({
    queryKey: ["workouts", user?.id],
    queryFn: async () =>
      (
        await supabase
          .from("workout_plans")
          .select("*")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false })
      ).data ?? [],
    enabled: !!user,
  });

  const { data: diets = [] } = useQuery({
    queryKey: ["diets", user?.id],
    queryFn: async () =>
      (
        await supabase
          .from("diet_plans")
          .select("*")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false })
      ).data ?? [],
    enabled: !!user,
  });

  const { data: notifs = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () =>
      (
        await supabase
          .from("notifications")
          .select("*")
          .or(`user_id.eq.${user!.id},user_id.is.null`)
          .order("created_at", { ascending: false })
          .limit(30)
      ).data ?? [],
    enabled: !!user,
  });

  /* ── Real-time notifications ── */
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("notif-" + user.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => {
        qc.invalidateQueries({ queryKey: ["notifications", user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  /* ── Derived values ── */
  const displayName =
    authData?.name ?? profile?.full_name?.split(" ")[0] ?? "Athlete";
  const unread = notifs.filter((n) => !n.is_read).length;
  const daysLeft = membership ? daysBetween(membership.end_date) : null;
  const expired = daysLeft !== null && daysLeft < 0;
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayRecord = attendance.find((a: any) => a.date === todayStr);
  const todayMarked = !!todayRecord;
  const todayCheckedOut = !!todayRecord?.check_out;
  const sessions30 = attendance.filter((a: any) => daysBetween(a.date) > -30).length;
  const paymentStatus = payments.some((p) => p.status === "overdue")
    ? "overdue"
    : payments.some((p) => p.status === "pending")
    ? "pending"
    : "ok";

  /* ── Check-in ── */
  async function checkIn() {
    const { error } = await supabase
      .from("attendance")
      .insert({ user_id: user!.id, date: todayStr });
    if (error) toast.error(error.message);
    else {
      toast.success("Checked in 💪 Let's go!");
      qc.invalidateQueries({ queryKey: ["attendance", user!.id] });
    }
  }

  /* ── Check-out ── */
  async function checkOut() {
    if (!todayRecord) return;
    const now = new Date();
    const localISO = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString();
    const { error } = await supabase
      .from("attendance")
      .update({ check_out: localISO } as any)
      .eq("id", todayRecord.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Checked out. Great session! 🏁");
      qc.invalidateQueries({ queryKey: ["attendance", user!.id] });
    }
  }

  /* ── Mark notification read ── */
  async function markRead(id: string) {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["notifications", user?.id] });
  }

  return (
    <AppShell
      title={`Hey, ${displayName} 👋`}
      subtitle="Your training hub — stay consistent, stay strong."
      notifCount={unread}
    >
      {/* ── Membership expiry banner ── */}
      {membership && daysLeft !== null && daysLeft <= 7 && (
        <div
          className={`mb-4 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium ${
            expired
              ? "bg-destructive/10 text-destructive border border-destructive/20"
              : "bg-primary/10 text-primary border border-primary/20"
          }`}
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {expired
            ? "Your membership has expired. Visit reception to renew."
            : `Your membership expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}. Renew soon!`}
        </div>
      )}

      {/* ── Stat cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Calendar}
          label="Membership"
          value={membership?.membership_plans?.name ?? "No plan"}
          sub={
            membership
              ? expired
                ? "Expired"
                : `${daysLeft} days remaining`
              : "Visit reception to enroll"
          }
          tone={expired ? "danger" : daysLeft !== null && daysLeft < 14 ? "warn" : "ok"}
        />
        <StatCard
          icon={CreditCard}
          label="Payment"
          value={
            paymentStatus === "overdue"
              ? "Overdue"
              : paymentStatus === "pending"
              ? "Pending"
              : "Up to date"
          }
          sub={payments[0] ? `Last due: ${fmtDate(payments[0].due_date)}` : "No payments yet"}
          tone={paymentStatus === "overdue" ? "danger" : paymentStatus === "pending" ? "warn" : "ok"}
        />
        <StatCard
          icon={Activity}
          label="Sessions (30d)"
          value={`${sessions30}`}
          sub={`${Math.round((sessions30 / 30) * 100)}% attendance rate`}
          tone="ok"
        />
        <StatCard
          icon={BellRing}
          label="Notifications"
          value={`${unread}`}
          sub={unread === 0 ? "All caught up" : `${unread} unread`}
          tone={unread > 0 ? "warn" : "ok"}
        />
      </div>

      {/* ── Quick actions ── */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          onClick={checkIn}
          disabled={todayMarked}
          className="bg-gradient-red text-primary-foreground shadow-red"
        >
          <PlayCircle className="mr-2 h-4 w-4" />
          {todayMarked ? "Checked in today ✓" : "Check in now"}
        </Button>

        {todayMarked && !todayCheckedOut && (
          <Button
            onClick={checkOut}
            variant="outline"
            className="border-blue-400 text-blue-600 hover:bg-blue-50"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Check out
          </Button>
        )}

        {todayCheckedOut && (
          <div className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-4 py-2 text-sm font-medium text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            Checked out{todayRecord?.check_out
              ? ` at ${new Date(todayRecord.check_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
              : ""}
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="overview" className="mt-6">
        <TabsList className="bg-muted flex flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="workout">
            <Dumbbell className="mr-1.5 h-3.5 w-3.5" />Workout
          </TabsTrigger>
          <TabsTrigger value="diet">
            <Utensils className="mr-1.5 h-3.5 w-3.5" />Diet
          </TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="notifs">
            Notifications
            {unread > 0 && (
              <Badge variant="destructive" className="ml-1.5 text-xs px-1.5 py-0">
                {unread}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="profile">
            <User className="mr-1.5 h-3.5 w-3.5" />Profile
          </TabsTrigger>
        </TabsList>

        {/* ── OVERVIEW ── */}
        <TabsContent value="overview" className="mt-4 grid gap-4 md:grid-cols-2">
          {/* Membership card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" /> Membership
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {membership ? (
                <>
                  <Row label="Plan" value={membership.membership_plans?.name ?? "—"} />
                  <Row label="Start" value={fmtDate(membership.start_date)} />
                  <Row label="Expires" value={fmtDate(membership.end_date)} />
                  <Row
                    label="Status"
                    value={
                      <Badge variant={expired ? "destructive" : "default"}>
                        {expired ? "Expired" : membership.status}
                      </Badge>
                    }
                  />
                  {membership.frozen && (
                    <Row label="Frozen" value={<Badge variant="secondary">Yes</Badge>} />
                  )}
                </>
              ) : (
                <p className="text-muted-foreground text-sm py-2">
                  No active membership. Visit reception to enroll.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Recent notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BellRing className="h-4 w-4 text-primary" /> Recent updates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {notifs.slice(0, 5).map((n) => (
                <div
                  key={n.id}
                  className={`flex gap-3 rounded-lg border border-border p-3 text-sm transition-opacity ${
                    n.is_read ? "opacity-50" : ""
                  }`}
                >
                  <BellRing className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{n.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{n.message}</div>
                  </div>
                  {!n.is_read && (
                    <button
                      onClick={() => markRead(n.id)}
                      className="shrink-0 text-xs text-primary hover:underline"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              ))}
              {notifs.length === 0 && (
                <p className="text-sm text-muted-foreground">Nothing here yet.</p>
              )}
            </CardContent>
          </Card>

          {/* Attendance snapshot */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" /> Attendance — last 60 days
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AttendanceGrid dates={attendance.map((a: any) => a.date)} />
              <p className="mt-3 text-sm text-muted-foreground">
                {attendance.length} sessions logged.{" "}
                {sessions30 >= 20
                  ? "Fantastic consistency! 🔥"
                  : sessions30 >= 10
                  ? "Good work — keep pushing. 💪"
                  : "Room to grow — show up more! 🎯"}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── WORKOUT ── */}
        <TabsContent value="workout" className="mt-4">
          <PlansList
            icon={Dumbbell}
            items={workouts}
            empty="No workout plan assigned yet. Speak to your trainer."
          />
        </TabsContent>

        {/* ── DIET ── */}
        <TabsContent value="diet" className="mt-4">
          <PlansList
            icon={Utensils}
            items={diets}
            empty="No diet plan assigned yet. Ask your trainer."
          />
        </TabsContent>

        {/* ── PAYMENTS ── */}
        <TabsContent value="payments" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" /> Payment history
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Due date</th>
                    <th className="px-4 py-3 text-left">Amount</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Receipt</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-t border-border">
                      <td className="px-4 py-3">{fmtDate(p.due_date)}</td>
                      <td className="px-4 py-3 font-semibold">{INR(p.amount)}</td>
                      <td className="px-4 py-3">
                        <PayStatus s={p.status} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                        {p.receipt_no ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {p.status === "paid" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => downloadReceipt(p, profile?.full_name)}
                          >
                            <Download className="mr-1 h-3 w-3" /> Receipt
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {payments.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        No payment records yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── ATTENDANCE ── */}
        <TabsContent value="attendance" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" /> Attendance log — last 60 days
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AttendanceGrid dates={attendance.map((a: any) => a.date)} />

              {/* Day-by-day list */}
              <div className="mt-5 divide-y divide-border rounded-lg border border-border overflow-hidden">
                {attendance.slice(0, 20).map((a: any) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between px-4 py-2.5 text-sm"
                  >
                    <span className="font-medium">{fmtDate(a.date)}</span>
                    <Badge
                      variant="outline"
                      className="border-green-400 text-green-600 text-xs"
                    >
                      <CheckCircle2 className="mr-1 h-3 w-3" /> Present
                    </Badge>
                  </div>
                ))}
                {attendance.length === 0 && (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No attendance recorded yet. Check in to get started!
                  </div>
                )}
              </div>

              <p className="mt-3 text-sm text-muted-foreground">
                {attendance.length} total sessions logged.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── NOTIFICATIONS ── */}
        <TabsContent value="notifs" className="mt-4 space-y-2">
          {notifs.length === 0 && (
            <p className="text-sm text-muted-foreground">No notifications yet.</p>
          )}
          {notifs.map((n) => (
            <Card key={n.id} className={n.is_read ? "opacity-60" : ""}>
              <CardContent className="flex gap-3 py-4">
                <BellRing className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{n.title}</div>
                  <div className="mt-0.5 text-sm text-muted-foreground">{n.message}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{fmtDate(n.created_at)}</div>
                </div>
                {!n.is_read && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0"
                    onClick={() => markRead(n.id)}
                  >
                    Mark read
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ── PROFILE ── */}
        <TabsContent value="profile" className="mt-4">
          <ProfileForm profile={profile} userId={user?.id} onSaved={() => qc.invalidateQueries({ queryKey: ["profile", user?.id] })} />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

/* ─────────────────────────────────────────────
   SUB-COMPONENTS
───────────────────────────────────────────── */

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: any;
  label: string;
  value: string;
  sub: string;
  tone: "ok" | "warn" | "danger";
}) {
  const toneCls =
    tone === "danger"
      ? "text-destructive"
      : tone === "warn"
      ? "text-primary"
      : "text-foreground";
  return (
    <div className="glass rounded-xl p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <Icon className={`h-4 w-4 ${toneCls}`} />
      </div>
      <div className={`mt-3 font-display text-2xl font-extrabold ${toneCls}`}>{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/40 py-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function PayStatus({ s }: { s: string }) {
  if (s === "paid")
    return (
      <Badge className="bg-green-600/20 text-green-400 hover:bg-green-600/20">
        <CheckCircle2 className="mr-1 h-3 w-3" /> Paid
      </Badge>
    );
  if (s === "overdue")
    return (
      <Badge variant="destructive">
        <AlertCircle className="mr-1 h-3 w-3" /> Overdue
      </Badge>
    );
  return (
    <Badge variant="secondary">
      <Clock className="mr-1 h-3 w-3" /> Pending
    </Badge>
  );
}

function PlansList({
  icon: Icon,
  items,
  empty,
}: {
  icon: any;
  items: any[];
  empty: string;
}) {
  if (items.length === 0)
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {empty}
        </CardContent>
      </Card>
    );
  return (
    <div className="space-y-3">
      {items.map((p) => (
        <Card key={p.id}>
          <CardHeader className="flex flex-row items-start gap-3 space-y-0">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-red">
              <Icon className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base">{p.title}</CardTitle>
              <p className="text-xs text-muted-foreground">{fmtDate(p.created_at)}</p>
            </div>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">
            {p.content}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AttendanceGrid({ dates }: { dates: string[] }) {
  const set = new Set(dates);
  const days = Array.from({ length: 60 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (59 - i));
    return d.toISOString().slice(0, 10);
  });
  return (
    <div
      className="grid gap-1.5"
      style={{ gridTemplateColumns: "repeat(15, minmax(0, 1fr))" }}
    >
      {days.map((d) => (
        <div
          key={d}
          title={d}
          className={`aspect-square rounded ${
            set.has(d) ? "bg-gradient-red" : "bg-muted/60"
          }`}
        />
      ))}
    </div>
  );
}

function ProfileForm({
  profile,
  userId,
  onSaved,
}: {
  profile: any;
  userId?: string;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    full_name: profile?.full_name ?? "",
    phone: profile?.phone ?? "",
    address: profile?.address ?? "",
    emergency_contact: profile?.emergency_contact ?? "",
  });

  useEffect(() => {
    if (profile)
      setForm({
        full_name: profile.full_name ?? "",
        phone: profile.phone ?? "",
        address: profile.address ?? "",
        emergency_contact: profile.emergency_contact ?? "",
      });
  }, [profile]);

  async function save() {
    if (!userId) return;
    const { error } = await supabase
      .from("profiles")
      .update(form)
      .eq("id", userId);
    if (error) toast.error(error.message);
    else {
      toast.success("Profile saved");
      onSaved();
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <User className="h-4 w-4 text-primary" /> Your profile
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div>
          <Label>Full name</Label>
          <Input
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          />
        </div>
        <div>
          <Label>Phone</Label>
          <Input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
        <div className="md:col-span-2">
          <Label>Address</Label>
          <Textarea
            rows={2}
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </div>
        <div className="md:col-span-2">
          <Label>Emergency contact</Label>
          <Input
            value={form.emergency_contact}
            onChange={(e) =>
              setForm({ ...form, emergency_contact: e.target.value })
            }
          />
        </div>
        <div className="md:col-span-2">
          <Button
            onClick={save}
            className="bg-gradient-red text-primary-foreground"
          >
            Save profile
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Receipt download ── */
function downloadReceipt(p: any, name?: string) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${p.receipt_no ?? p.id}</title>
<style>
  body{font-family:system-ui;padding:40px;color:#111}
  h1{color:#dc2626;margin-bottom:4px}
  .sub{color:#666;margin-top:0;margin-bottom:24px}
  table{width:100%;border-collapse:collapse;margin-top:16px}
  td{padding:10px 8px;border-bottom:1px solid #eee}
  td:first-child{color:#666;width:40%}
  .footer{margin-top:40px;color:#999;font-size:13px}
</style></head>
<body>
  <h1>SRGYM AND FITNESS CENTRE</h1>
  <p class="sub">Official Payment Receipt</p>
  <table>
    <tr><td>Receipt No</td><td><strong>${p.receipt_no ?? p.id}</strong></td></tr>
    <tr><td>Member</td><td>${name ?? "—"}</td></tr>
    <tr><td>Amount</td><td><strong>₹ ${p.amount}</strong></td></tr>
    <tr><td>Due date</td><td>${p.due_date}</td></tr>
    <tr><td>Paid on</td><td>${p.paid_at ?? "—"}</td></tr>
    <tr><td>Status</td><td>${p.status}</td></tr>
  </table>
  <p class="footer">Thank you for training with us. Keep pushing! 💪</p>
</body></html>`;
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `receipt-${p.receipt_no ?? p.id}.html`;
  a.click();
  URL.revokeObjectURL(url);
}