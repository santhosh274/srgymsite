import { createFileRoute } from "@tanstack/react-router";
import { Award, Heart, Target } from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — SR GYM AND FITNESS CENTRE" },
      { name: "description", content: "Learn the story behind SRGYM — a premium strength and fitness centre built for serious results." },
      { property: "og:title", content: "About SRGYM" },
      { property: "og:description", content: "Built by lifters, for lifters." },
    ],
  }),
  component: About,
});

function About() {
  return (
    <div>
      <section className="border-b border-border/50 bg-gradient-dark py-24">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">About us</p>
          <h1 className="mt-3 font-display text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">
            <span className="block">Built by lifters.</span>
            <span className="block text-gradient-red">For lifters.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-muted-foreground">
            SR GYM AND FITNESS CENTRE opened in 2019 with one mission — to give our city a serious
            strength facility with world-class coaching and a no-ego, all-effort culture.
          </p>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 md:grid-cols-3">
          {[
            { icon: Target, title: "Our Mission", body: "Make premium strength training accessible to every body, every goal, every level." },
            { icon: Heart, title: "Our Promise", body: "Personalised programs, accountable coaches and a community that pushes you forward." },
            { icon: Award, title: "Our Standard", body: "Best-in-class equipment, hygienic spaces, and trainers who actually walk the talk." },
          ].map((b) => (
            <div key={b.title} className="glass rounded-xl p-7">
              <div className="grid h-11 w-11 place-items-center rounded-lg bg-gradient-red shadow-red">
                <b.icon className="h-5 w-5 text-primary-foreground" />
              </div>
              <h3 className="mt-5 font-display text-xl font-bold">{b.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{b.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-border/50 bg-surface/30 py-20">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 md:grid-cols-2">
          <div>
            <h2 className="font-display text-4xl font-extrabold">Why we exist</h2>
            <div className="mt-6 space-y-4 text-muted-foreground">
              <p>Most gyms sell access. We sell results. From the first walkthrough to your transformation
                photo, every step is designed to keep you accountable and progressing.</p>
              <p>Whether you're chasing your first pull-up or your first powerlifting meet, our coaches and
                community are with you on the journey.</p>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-6">
            {[
              { k: "500+", v: "Active members" },
              { k: "300+", v: "Transformations" },
              { k: "4.8★", v: "Member rating" },
            ].map((s) => (
              <div key={s.v} className="rounded-xl border border-border bg-surface p-6">
                <dt className="font-display text-4xl font-extrabold text-gradient-red">{s.k}</dt>
                <dd className="mt-1 text-sm text-muted-foreground">{s.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </div>
  );
}