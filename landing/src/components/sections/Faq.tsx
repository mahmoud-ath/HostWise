import { Plus } from "lucide-react";

const FAQS = [
  {
    q: "Is my data stored in the cloud?",
    a: "No. HostWise is local-first. Your bookings, revenue, and expenses stay in a database on your machine. There is no account and no cloud upload.",
  },
  {
    q: "Which platforms does HostWise run on?",
    a: "Windows, macOS, and Linux. Linux users can install from a .deb, an AppImage, or the AUR package hostwise-bin on Arch and Manjaro.",
  },
  {
    q: "How do I get my data in?",
    a: "Import CSV exports from Airbnb, Booking.com, or your own spreadsheets, plus iCal calendars. Re-importing the same file skips duplicates.",
  },
  {
    q: "Is HostWise free?",
    a: "Yes. Download it from the GitHub Releases page and use it on your own machine at no cost.",
  },
  {
    q: "Can I export reports as PDF?",
    a: "Yes. Reports render as structured, paginated PDFs locally, ready to share with owners, lenders, or your accountant.",
  },
  {
    q: "What if I run into a problem?",
    a: "Check the documentation, email support, or open an issue on GitHub. We build HostWise for hosts and read every message.",
  },
] as const;

export default function Faq() {
  return (
    <section
      id="faq"
      className="scroll-mt-24 border-t border-gray-200 px-6 py-20 sm:py-24 lg:px-14 lg:py-28"
    >
      <div className="mx-auto max-w-3xl">
        <h2 className="font-serif text-3xl font-normal tracking-tight text-[#191919] sm:text-4xl">
          Frequently asked questions
        </h2>
        <p className="mt-4 text-[15px] text-[#191919]/70">
          The short answers, in plain language.
        </p>

        <div className="mt-10 divide-y divide-gray-200 border-y border-gray-200">
          {FAQS.map((faq) => (
            <details key={faq.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-base font-medium text-[#191919] [&::-webkit-details-marker]:hidden">
                {faq.q}
                <Plus
                  size={18}
                  strokeWidth={2}
                  className="shrink-0 text-[#191919]/50 transition-transform duration-200 group-open:rotate-45"
                  aria-hidden="true"
                />
              </summary>
              <p className="mt-3 text-[15px] leading-relaxed text-[#191919]/70">
                {faq.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
