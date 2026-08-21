import {
  CalendarCheck,
  Coins,
  FileText,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import Highlight from "../Highlight";

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

export default function Features() {
  return (
    <section
      id="features"
      className="scroll-mt-24 border-t border-gray-200 px-6 py-20 sm:py-24 lg:px-14 lg:py-28"
    >
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <span className="text-xs font-medium uppercase tracking-[0.3em] text-accent">
            Features
          </span>
          <h2 className="mt-3 font-serif text-3xl font-normal tracking-tight text-[#191919] sm:text-4xl md:text-5xl">
            Everything your numbers need,{" "}
            <Highlight>in one place.</Highlight>
          </h2>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[#191919]/70 md:text-base">
            HostWise brings revenue, expenses, analytics, and AI insights into
            a single local-first desktop app, built for the way hosts actually
            work.
          </p>
        </div>

        <ul className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <li
              key={feature.title}
              className="rounded-2xl border border-gray-200 bg-white p-6 transition-colors duration-200 hover:border-gray-300 hover:bg-soft"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 text-[#191919]">
                <feature.icon size={22} strokeWidth={1.75} aria-hidden="true" />
              </span>
              <h3 className="mt-4 font-semibold text-[#191919]">
                {feature.title}
              </h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-[#191919]/70">
                {feature.body}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
