import { CalendarDays, Gauge, TrendingUp } from "lucide-react";
import { Reveal } from "@/components/Reveal";

const ITEMS = [
  {
    icon: TrendingUp,
    label: "Portfolio KPIs",
    body: "Revenue, expenses, and profitability across all your properties.",
  },
  {
    icon: Gauge,
    label: "Property health",
    body: "A 0-100 health score that flags underperformers at a glance.",
  },
  {
    icon: CalendarDays,
    label: "Trends and seasonality",
    body: "See how demand and cash flow move month to month.",
  },
] as const;

/**
 * #analytics anchor. A full-width statement with a hairline-divided strip
 * (gap-px over a 1px background) - a deliberately different layout family
 * from the Features cards.
 */
export function Analytics() {
  return (
    <section
      id="analytics"
      className="relative scroll-mt-24 border-t border-white/10 px-6 py-24 lg:px-[120px] lg:py-32"
    >
      <div className="mx-auto max-w-[1400px]">
        <Reveal>
          <div className="text-center">
            <h2 className="mx-auto max-w-3xl font-serif text-4xl leading-[1.1] text-white md:text-5xl">
              Understand your portfolio at a glance.
            </h2>
            <p className="mx-auto mt-4 max-w-[620px] font-sans text-lg leading-relaxed text-white/75">
              Analytics are computed from your real data, so the picture is
              always current and always yours.
            </p>
          </div>
        </Reveal>

        <Reveal className="mt-14">
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 md:grid-cols-3">
            {ITEMS.map((item) => (
              <div key={item.label} className="bg-[#0d0817] p-7 text-center">
                <item.icon
                  size={26}
                  strokeWidth={1.75}
                  className="mx-auto text-primary"
                  aria-hidden="true"
                />
                <h3 className="mt-4 font-manrope text-base font-semibold text-white">
                  {item.label}
                </h3>
                <p className="mt-2 font-sans text-sm leading-relaxed text-white/70">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
