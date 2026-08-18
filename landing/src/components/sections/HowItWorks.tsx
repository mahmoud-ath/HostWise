import { Lightbulb, Search, Upload } from "lucide-react";
import { Reveal } from "@/components/Reveal";

const STEPS = [
  {
    icon: Upload,
    title: "Import your data",
    body: "Upload CSV exports from Airbnb, Booking.com, or your own spreadsheets, plus iCal calendars.",
  },
  {
    icon: Search,
    title: "See the whole picture",
    body: "HostWise computes your KPIs, health scores, and trends instantly from your own data.",
  },
  {
    icon: Lightbulb,
    title: "Decide with confidence",
    body: "Use the AI advisor and professional reports to act on what the numbers show.",
  },
] as const;

/**
 * #how-it-works anchor (target of the hero secondary CTA). A vertical stack
 * with hairline separators - verb-noun headings, no fake "Step 1" labels.
 */
export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="relative scroll-mt-24 border-t border-white/10 px-6 py-24 lg:px-[120px] lg:py-32"
    >
      <div className="mx-auto max-w-[1400px]">
        <Reveal>
          <div className="max-w-3xl">
            <h2 className="font-serif text-4xl leading-[1.1] text-white md:text-5xl">
              From your data to your next decision.
            </h2>
            <p className="mt-4 max-w-[560px] font-sans text-lg leading-relaxed text-white/75">
              A simple workflow, built for a single host managing a handful of
              properties, not an operations team.
            </p>
          </div>
        </Reveal>

        <div className="mt-12">
          {STEPS.map((step, index) => (
            <Reveal key={step.title} delay={index * 80}>
              <div className="flex flex-col gap-4 border-t border-white/10 py-8 first:border-t-0 sm:flex-row sm:items-start sm:gap-6">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] bg-primary/15 text-primary">
                  <step.icon size={24} strokeWidth={1.75} aria-hidden="true" />
                </span>
                <div>
                  <h3 className="font-manrope text-xl font-semibold text-white">
                    {step.title}
                  </h3>
                  <p className="mt-2 max-w-[560px] font-sans text-[15px] leading-relaxed text-white/70">
                    {step.body}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
