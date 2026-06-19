import { createFileRoute } from "@tanstack/react-router";
import { Star } from "lucide-react";

export const Route = createFileRoute("/stories")({
  head: () => ({
    meta: [
      { title: "Success Stories — SRGYM" },
      { name: "description", content: "Real transformations from members of SRGYM AND FITNESS CENTRE." },
      { property: "og:title", content: "SRGYM Success Stories" },
      { property: "og:description", content: "Real members. Real results." },
    ],
  }),
  component: Stories,
});

const stories = [
  { name: "Aman Sharma", role: "Fat loss — 18 kg in 6 months", quote: "The coaching at SRGYM is on another level. Felt accountable from day one. The plan worked because someone was always checking on me." },
  { name: "Priya Nair", role: "First powerlifting meet", quote: "I went from scared of the squat rack to competing at a state meet. The vibe and the coaches got me there." },
  { name: "Rahul Iyer", role: "Body recomposition", quote: "Their diet and lift programming finally made everything click. Best decision I made this year." },
  { name: "Sneha Patil", role: "Postnatal strength", quote: "The trainers respected my pace and built me back stronger than before. Forever grateful." },
  { name: "Vikram Joshi", role: "20 kg muscle gain", quote: "Came in skinny. Two years later I deadlift double my bodyweight. SRGYM is family." },
  { name: "Meera Krishnan", role: "Marathon prep", quote: "Strength work here transformed my running. PR'd my last half-marathon by 11 minutes." },
];

function Stories() {
  return (
    <div>
      <section className="border-b border-border/50 bg-gradient-dark py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Stories</p>
          <h1 className="mt-3 font-display text-5xl font-extrabold sm:text-6xl">
            Real members. <span className="text-gradient-red">Real results.</span>
          </h1>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 md:grid-cols-2 lg:grid-cols-3">
          {stories.map((s) => (
            <figure key={s.name} className="glass rounded-2xl p-6">
              <div className="flex gap-1 text-primary">
                {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}
              </div>
              <blockquote className="mt-4 text-sm text-foreground/90">"{s.quote}"</blockquote>
              <figcaption className="mt-5 border-t border-border pt-4">
                <div className="font-semibold">{s.name}</div>
                <div className="text-xs text-primary">{s.role}</div>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
    </div>
  );
}
