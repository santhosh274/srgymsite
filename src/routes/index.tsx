import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Dumbbell, HeartPulse, Trophy, Users, Check, Star, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { INR } from "@/lib/format";
import hero from "@/assets/hero-gym.jpg";
import { gym } from "@/integrations/gym";

export const Route = createFileRoute("/")({

  head: () => ({
    meta: [
      { title: "SR GYM AND FITNESS CENTRE — Transform Your Body. Transform Your Life." },
      { name: "description", content: "Premium strength training, expert coaching and a community that pushes you forward. Join SRGYM today." },
      { property: "og:title", content: "SRGYM AND FITNESS CENTRE" },
      { property: "og:description", content: "Transform your body. Transform your life." },
    ],
  }),
  component: Home,
});

const reasons = [
  { icon: Dumbbell, title: "Premium Equipment", desc: "Top-of-the-line strength, cardio and functional gear — built for performance." },
  { icon: Users, title: "Expert Trainers", desc: "Certified coaches with national-level credentials guiding every step." },
  { icon: HeartPulse, title: "Personalised Plans", desc: "Custom workout & diet programs built around your body and goals." },
  { icon: Trophy, title: "Real Results", desc: "Hundreds of transformations. Data-driven progress tracking included." },
];

const testimonials = [
  { name: "Sriharish S", role: "Weight Gain", quote: "I joined SR Gym at 47 kg and struggled to gain muscle. With proper guidance and training, I reached 60 kg in just 12 months. The trainers kept me motivated throughout the journey!" },
  { name: "Balaji G", role: "Weight Gain", quote: "SR Gym helped me build strength and confidence. I gained 5 kg of healthy weight while improving my overall fitness. The supportive environment made a huge difference." },
  { name: "Priya", role: "Weight Loss", quote: "I wanted to lose weight and become healthier. After joining SR Gym, I lost 14 kg in 7 months through consistent workouts and expert guidance. I feel more energetic and confident than ever!" },
];

function Home() {
  const { data: plans } = useQuery({
    queryKey: ["home-plans"],
    queryFn: async () => {
      const { data } = await supabase.from("membership_plans").select("*").eq("is_active", true).order("price");
      return data ?? [];
    },
  });

  const { data: trainers } = useQuery({
    queryKey: ["home-trainers"],
    queryFn: async () => {
      const { data } = await supabase.from("trainers").select("*").eq("is_active", true).limit(3);
      return data ?? [];
    },
  });

  return (
    <div>
      
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <img src={hero} alt="" className="h-full w-full object-cover opacity-50" width={1920} height={1080} />
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />
          <div className="absolute inset-0 bg-gradient-hero" />
        </div>

        <div className="mx-auto flex min-h-[88vh] max-w-7xl flex-col justify-center px-4 py-24 sm:px-6">
          <div className="max-w-3xl animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-widest text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Premium Strength Lab
            </span>
            <h1 className="mt-6 font-display text-5xl font-extrabold leading-[1.05] text-balance sm:text-6xl md:text-7xl">
              Transform Your Body.<br />
              <span className="text-gradient-red">Transform Your Life.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
              SR GYM AND FITNESS CENTRE is where serious lifters and beginners alike build strength,
              confidence and lasting results — under one roof.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-gradient-red text-primary-foreground shadow-red hover:opacity-90">
                <Link to="/auth">Login<ArrowRight className="ml-1 h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-border bg-background/40 backdrop-blur">
                <Link to="/plans">Membership Plans</Link>
              </Button>
            </div>

            <dl className="mt-12 grid max-w-lg grid-cols-3 gap-6">
              {[
                { k: "500+", v: "Members" },
                { k: "7+ yrs", v: "Trusted" },
              ].map((s) => (
                <div key={s.v}>
                  <dt className="font-display text-3xl font-extrabold text-foreground">{s.k}</dt>
                  <dd className="text-xs uppercase tracking-wider text-muted-foreground">{s.v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* WHY */}
      <section className="border-t border-border/50 bg-surface/30 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Why SR GYM</p>
            <h2 className="mt-2 font-display text-4xl font-extrabold sm:text-5xl">Built for those who don't quit.</h2>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {reasons.map((r, i) => (
              <div
                key={r.title}
                className="glass group rounded-xl p-6 transition hover:-translate-y-1 hover:border-primary/40"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="grid h-11 w-11 place-items-center rounded-lg bg-gradient-red shadow-red">
                  <r.icon className="h-5 w-5 text-primary-foreground" />
                </div>
                <h3 className="mt-5 text-lg font-bold">{r.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>     
      {/* PLANS */}
     <section className="border-y border-border/50 bg-surface/30 py-24">
  <div className="mx-auto max-w-7xl px-4 sm:px-6">
    <div className="max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">Membership</p>
      <h2 className="mt-2 font-display text-4xl font-extrabold sm:text-5xl">Pick your plan. Start lifting.</h2>
    </div>
    <div className="mt-12 grid gap-6 md:grid-cols-4">
      {[
        {
          id: "monthly",
          name: "Monthly",
          duration_months: 1,
          price: 1000,
          featured: false,
          features: [
            "Full gym access",
          
            "Free weights & machines",
            "Cancel anytime",
          ],
        },
        {
          id: "quarterly",
          name: "Quarterly",
          duration_months: 3,
          price: 2800,
          featured: false,
          features: [
            "Full gym access",
          
            "Free weights & machines",
            "Save ₹200 vs monthly",
          ],
        },
        {
          id: "biannual",
          name: "6 Months",
          duration_months: 6,
          price: 4500,
          featured: true,
          features: [
            "Full gym access",
            
            "Free weights & machines",
            
            "Save ₹1,500 vs monthly",
          ],
        },
        {
          id: "annual",
          name: "Annual",
          duration_months: 12,
          price: 8000,
          featured: false,
          features: [
            "Full gym access",
            
            "Free weights & machines",
          
            
            "Save ₹4,000 vs monthly",
          ],
        },
      ].map((p) => {
        const INR = (amount: number) =>
          new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 0,
          }).format(amount);

        return (
          <div
            key={p.id}
            className={`relative rounded-2xl p-7 ${
              p.featured
                ? "border-2 border-primary bg-surface shadow-red"
                : "border border-border bg-surface"
            }`}
          >
            {p.featured && (
              <span className="absolute -top-3 left-7 rounded-full bg-gradient-red px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary-foreground">
                Most popular
              </span>
            )}
            <h3 className="font-display text-2xl font-extrabold">{p.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {p.duration_months} month{p.duration_months > 1 ? "s" : ""}
            </p>
            <div className="mt-5 flex items-baseline gap-1">
              <span className="font-display text-4xl font-extrabold">{INR(p.price)}</span>
            </div>
            <ul className="mt-6 space-y-2.5">
              {p.features.map((f) => (
                <li key={f} className="flex gap-2 text-sm">
                  <Check className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Button
              asChild
              className={`mt-7 w-full ${
                p.featured
                  ? "bg-gradient-red text-primary-foreground"
                  : "bg-surface border border-border"
              }`}
            >
              <Link to="/auth">Get started</Link>
            </Button>
          </div>
        );
      })}
    </div>
  </div>
</section>

      {/* TESTIMONIALS */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Member Stories</p>
          <h2 className="mt-2 font-display text-4xl font-extrabold sm:text-5xl">Results that speak.</h2>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {testimonials.map((t) => (
              <figure key={t.name} className="glass rounded-xl p-6">
                <div className="flex gap-1 text-primary">
                  {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}
                </div>
                <blockquote className="mt-4 text-sm text-foreground/90">"{t.quote}"</blockquote>
                <figcaption className="mt-5">
                  <div className="font-semibold">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.role}</div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT CTA */}
      <section className="border-t border-border/50 bg-surface/30 py-24">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 md:grid-cols-2">
          <div>
            <h2 className="font-display text-4xl font-extrabold sm:text-5xl">Visit us. <span className="text-gradient-red">Lift with us.</span></h2>
            <p className="mt-4 max-w-md text-muted-foreground">
              Walk in for a free tour. Our team will show you around and help pick the right plan.
            </p>
            <div className="mt-6 space-y-2 text-sm">
<p className="flex gap-2"><MapPin className="h-4 w-4 mt-0.5 text-primary" /> {gym.locationText}</p>
              <p>Open: 5:00 AM – 11:00 PM • Mon–Sun</p>
            </div>
            <div className="mt-6 flex gap-3">
              <Button asChild className="bg-gradient-red text-primary-foreground">
                <Link to="/contact">Contact us</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/auth">Become a member</Link>
              </Button>
            </div>
          </div>
          <div className="aspect-video overflow-hidden rounded-2xl border border-border">
            <iframe
              title="Map"
src={gym.mapsEmbedSrc}
              className="h-full w-full"
              loading="lazy"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
