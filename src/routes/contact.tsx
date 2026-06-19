import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { MapPin, Phone, Mail, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — SRGYM" },
      { name: "description", content: "Get in touch with SRGYM AND FITNESS CENTRE. Visit, call, or send us a message." },
      { property: "og:title", content: "Contact SRGYM" },
      { property: "og:description", content: "Visit. Call. Lift." },
    ],
  }),
  component: Contact,
});

const schema = z.object({
  name: z.string().trim().min(1, "Name required").max(100),
  email: z.string().trim().email("Invalid email").max(200),
  phone: z.string().trim().max(20).optional(),
  message: z.string().trim().min(1, "Message required").max(2000),
});

function Contact() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("contact_messages").insert(parsed.data);
    setLoading(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Message sent! We'll be in touch.");
      setForm({ name: "", email: "", phone: "", message: "" });
    }
  }

  return (
    <div>
      <section className="border-b border-border/50 bg-gradient-dark py-16">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Get in touch</p>
          <h1 className="mt-3 font-display text-5xl font-extrabold sm:text-6xl">Let's <span className="text-gradient-red">talk.</span></h1>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 md:grid-cols-5">
          <div className="md:col-span-2 space-y-6">
            {[
              { icon: MapPin, title: "Visit", body: "Main Road, Sector 12, Your City" },
              { icon: Phone, title: "Call", body: "+91 98765 43210" },
              { icon: Mail, title: "Email", body: "hello@srgym.fit" },
            ].map((c) => (
              <div key={c.title} className="flex gap-4 rounded-xl border border-border bg-surface p-5">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gradient-red">
                  <c.icon className="h-4 w-4 text-primary-foreground" />
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{c.title}</div>
                  <div className="mt-1 font-medium">{c.body}</div>
                </div>
              </div>
            ))}
            <div className="aspect-video overflow-hidden rounded-xl border border-border">
              <iframe title="Map" src="https://www.google.com/maps?q=fitness+gym&output=embed" className="h-full w-full" loading="lazy" />
            </div>
          </div>

          <form onSubmit={submit} className="md:col-span-3 space-y-4 rounded-2xl border border-border bg-surface p-7">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={100} />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={20} />
              </div>
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required maxLength={200} />
            </div>
            <div>
              <Label htmlFor="message">Message</Label>
              <Textarea id="message" rows={6} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required maxLength={2000} />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-gradient-red text-primary-foreground shadow-red">
              <Send className="mr-2 h-4 w-4" />
              {loading ? "Sending..." : "Send message"}
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}
