import type { Metadata } from "next";
import { Instagram, Mail, MapPin } from "lucide-react";
import { Reveal } from "@/components/elite/Reveal";
import { ContactForm } from "@/components/elite/ContactForm";

export const metadata: Metadata = {
  title: "Contact · Strive Elite",
  description:
    "Get in touch with Strive Soccer FC about the Strive Elite development program.",
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-5xl px-5 pb-28 pt-32">
      <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
        <Reveal>
          <div>
            <div className="eyebrow mb-4">Get in touch</div>
            <h1 className="display text-balance text-[clamp(2.5rem,6vw,4rem)]">
              Let&apos;s build your player&apos;s development plan.
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-white/55">
              Tell us about your player and their goals. A Strive coach will
              reach out to find the right fit — whether that&apos;s a single
              session or the full Elite program.
            </p>

            <div className="mt-10 space-y-4">
              <ContactRow
                icon={<Mail className="h-5 w-5" />}
                label="Email"
                value="strivesoccerdevelope@gmail.com"
                href="mailto:strivesoccerdevelope@gmail.com"
              />
              <ContactRow
                icon={<Instagram className="h-5 w-5" />}
                label="Instagram"
                value="@strivesoccerfc"
                href="https://www.instagram.com/strivesoccerfc"
              />
              <ContactRow
                icon={<MapPin className="h-5 w-5" />}
                label="Area"
                value="DC · Maryland · Virginia"
              />
            </div>
          </div>
        </Reveal>

        <Reveal delay={120}>
          <ContactForm />
        </Reveal>
      </div>
    </div>
  );
}

function ContactRow({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
}) {
  const inner = (
    <div className="flex items-center gap-4 rounded-2xl border border-white/8 bg-white/[0.02] p-4 transition-colors hover:border-white/15">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
        {icon}
      </div>
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
          {label}
        </div>
        <div className="font-medium text-bone">{value}</div>
      </div>
    </div>
  );
  if (href)
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {inner}
      </a>
    );
  return inner;
}
