import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { INR } from "@/lib/format";

export const Route = createFileRoute("/plans")({
  head: () => ({
    meta: [
      { title: "Membership Plans — SRGYM" },
      { name: "description", content: "Choose from monthly, quarterly and yearly memberships at SRGYM AND FITNESS CENTRE." },
      { property: "og:title", content: "SRGYM Membership Plans" },
      { property: "og:description", content: "Pick your plan. Start lifting." },
    ],
  }),
  component: Plans,
});

function Plans() {
  const { data: plans = [] } = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data } = await supabase.from("membership_plans").select("*").eq("is_active", true).order("price");
      return data ?? [];
    },
  });

  return (
    <div>
      <section className="border-b border-border/50 bg-gradient-dark py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Membership</p>
          <h1 className="mt-3 font-display text-5xl font-extrabold sm:text-6xl">
            Pick your <span className="text-gradient-red">plan.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-muted-foreground">
            Every plan includes premium equipment access, hygienic locker rooms and a welcoming community.
          </p>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 md:grid-cols-3">
          {plans.map((p, i) => {
            const featured = i === 1;
            const feats = Array.isArray(p.features) ? (p.features as string[]) : [];
            return (
              <div key={p.id} className={`relative rounded-2xl p-7 ${featured ? "border-2 border-primary bg-surface shadow-red" : "border border-border bg-surface"}`}>
                {featured && (
                  <span className="absolute -top-3 left-7 rounded-full bg-gradient-red px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary-foreground">
                    Most popular
                  </span>
                )}
                <h3 className="font-display text-2xl font-extrabold">{p.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{p.duration_months} month{p.duration_months > 1 ? "s" : ""}</p>
                <div className="mt-5 flex items-baseline gap-1">
                  <span className="font-display text-4xl font-extrabold">{INR(p.price)}</span>
                  <span className="text-sm text-muted-foreground">/{p.duration_months}mo</span>
                </div>
                <ul className="mt-6 space-y-2.5">
                  {feats.map((f) => (
                    <li key={f} className="flex gap-2 text-sm">
                      <Check className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button asChild className={`mt-7 w-full ${featured ? "bg-gradient-red text-primary-foreground" : "border border-border"}`}>
                  <Link to="/auth">Join {p.name}</Link>
                </Button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
