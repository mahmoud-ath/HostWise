import { Check, FileDown } from "lucide-react";
import { Reveal } from "@/components/Reveal";

const REPORT_TYPES = [
  "Monthly summaries",
  "Annual reports",
  "Executive overviews",
  "Portfolio breakdowns",
] as const;

/**
 * #reports anchor. The page's single split layout: headline + list on the
 * left, a PDF highlight panel on the right. No fake product preview - the
 * list is real report types, not a mocked screenshot.
 */
export function Reports() {
  return (
    <section
      id="reports"
      className="relative scroll-mt-24 border-t border-white/10 px-6 py-24 lg:px-[120px] lg:py-32"
    >
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 items-center gap-12 md:grid-cols-2 md:gap-16">
        <Reveal>
          <div>
            <h2 className="font-serif text-4xl leading-[1.1] text-white md:text-5xl">
              Reports that look as good as your business.
            </h2>
            <p className="mt-4 max-w-[520px] font-sans text-lg leading-relaxed text-white/75">
              Generate period-based financial reports and export them as PDF,
              ready to share with owners, lenders, or your accountant.
            </p>
            <ul className="mt-8">
              {REPORT_TYPES.map((type) => (
                <li
                  key={type}
                  className="flex items-center gap-3 border-t border-white/10 py-3.5 last:border-b"
                >
                  <Check
                    size={18}
                    strokeWidth={2.25}
                    className="shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <span className="font-manrope text-base font-medium text-white/90">
                    {type}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div className="rounded-xl border border-primary/30 bg-primary/[0.07] p-8 md:p-10">
            <span className="flex h-12 w-12 items-center justify-center rounded-[10px] bg-primary text-white">
              <FileDown size={24} strokeWidth={1.75} aria-hidden="true" />
            </span>
            <h3 className="mt-5 font-manrope text-xl font-semibold text-white">
              Real PDF export, built in
            </h3>
            <p className="mt-2 font-sans text-[15px] leading-relaxed text-white/70">
              Reports render as structured, paginated PDFs on your machine.
              No account, no email required, no cloud round-trip.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
