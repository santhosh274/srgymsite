import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/trainers")({
  head: () => ({
    meta: [
      { title: "Our Trainers — SRGYM" },
      { name: "description", content: "Meet the certified coaches behind SRGYM AND FITNESS CENTRE." },
      { property: "og:title", content: "SRGYM Trainers" },
      { property: "og:description", content: "Certified, competitive, and committed to your results." },
    ],
  }),
  component: Trainers,
});

function Trainers() {
  const { data: trainers = [] } = useQuery({
    queryKey: ["trainers-all"],
    queryFn: async () => {
      const { data } = await supabase.from("trainers").select("*").eq("is_active", true);
      return data ?? [];
    },
  });

  return (
    <div>
      <section className="border-b border-border/50 bg-gradient-dark py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Coaches</p>
          <h1 className="mt-3 font-display text-5xl font-extrabold sm:text-6xl">
            Meet your <span className="text-gradient-red">trainers.</span>
          </h1>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 md:grid-cols-2 lg:grid-cols-3">
          {trainers.map((t) => (
            <article key={t.id} className="group overflow-hidden rounded-2xl border border-border bg-surface transition hover:border-primary/40">
              <div className="aspect-[4/5] overflow-hidden bg-muted">
                <img src={t.photo_url ?? ""} alt={t.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" />
              </div>
              <div className="p-6">
                <h2 className="font-display text-2xl font-bold">{t.name}</h2>
                <p className="mt-1 text-sm font-medium text-primary">{t.specialty}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t.experience_years}+ years experience</p>
                {t.bio && <p className="mt-4 text-sm text-muted-foreground">{t.bio}</p>}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
