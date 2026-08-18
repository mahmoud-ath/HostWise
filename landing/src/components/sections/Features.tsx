import {
  CalendarCheck,
  Coins,
  FileText,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Reveal } from "@/components/Reveal";

const FEATURES = [
  {
    icon: Coins,
    title: "Revenue and expenses",
    body: "Record income and costs per property, with categories that actually make sense.",
  },
  {
    icon: CalendarCheck,
    title: "Reservations",
    body: "Import bookings from CSV or your calendar and see the full picture in one place.",
  },
  {
    icon: TrendingUp,
    title: "Analytics and health",
    body: "Profit margins, occupancy, trends, and a health score for every property.",
  },
  {
    icon: ShieldCheck,
    title: "Local-first by design",
    body: "Your data stays on your machine. No account, no cloud, no lock-in.",
  },
  {
    icon: Sparkles,
    title: "AI-assisted insights",
    body: "A built-in advisor that explains what changed and what to do next.",
  },
  {
    icon: FileText,
    title: "Financial reports",
    body: "Generate clean, professional reports you can export as PDF.",
  },
] as const;

/**
 * #features anchor. A 2-column card grid (not the cliché 3 equal cards) with
 * a real brand-purple icon tile per row.
 */
export function Features() {
  return (
    <section
      id="features"
      className="relative scroll-mt-24 px-6 py-24 lg:px-[120px] lg:py-32"
    >
      <div className="mx-auto max-w-[1400px]">
        <Reveal>
          <div className="max-w-3xl">
            <h2 className="font-serif text-4xl leading-[1.1] text-white md:text-5xl">
              Everything your numbers need, in one place.
            </h2>
            <p className="mt-4 max-w-[560px] font-sans text-lg leading-relaxed text-white/75">
              HostWise brings your whole financial picture together in a single
              desktop app, built for the way hosts actually work.
            </p>
          </div>
        </Reveal>

        <ul className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-2">
          {FEATURES.map((feature, index) => (
            <li key={feature.title}>
              <Reveal delay={index * 60}>
                <div className="flex h-full items-start gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-6 transition-colors duration-300 hover:border-primary/40 hover:bg-white/[0.05]">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-primary/15 text-primary">
                    <feature.icon size={22} strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="font-manrope text-lg font-semibold text-white">
                      {feature.title}
                    </h3>
                    <p className="mt-1.5 font-sans text-[15px] leading-relaxed text-white/70">
                      {feature.body}
                    </p>
                  </div>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
