import { ArrowRight } from "lucide-react";
import HostWiseLogo from "./HostWiseLogo";
import { defaultDownload } from "../lib/downloads";
import { useDownloadGate } from "../lib/leadGate";
import { LINKS } from "../lib/links";
import { navigateToSection } from "../lib/navigation";

const FOOTER_LINKS = [
  { label: "Product", action: () => navigateToSection("product") },
  { label: "Features", action: () => navigateToSection("features") },
  { label: "Download", action: () => navigateToSection("download") },
  { label: "FAQ", action: () => navigateToSection("faq") },
  { label: "Guide", href: "#/docs" },
  { label: "Feedback", href: "#/feedback" },
] as const;

/**
 * Enhanced dark footer: a giant serif wordmark sits behind the content like a
 * print plate, and the "Back home" pill borrows the chevron-link style.
 */
export default function Footer() {
  const { openDownload } = useDownloadGate();

  const startDownload = () => {
    const def = defaultDownload();
    openDownload({ href: def.href, os: def.os, source: "footer" });
  };

  return (
    <footer className="relative overflow-hidden bg-[#121212] px-6 pb-10 pt-16 text-white lg:px-14">
      {/* Giant decorative wordmark */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 select-none whitespace-nowrap text-center font-serif text-[24vw] leading-none text-white/[0.04]"
      >
        HostWise
      </div>

      <div className="relative mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-10 md:flex-row md:items-start">
          <div className="max-w-sm">
            <a
              href="#/"
              className="flex items-center gap-2.5"
              aria-label="HostWise home"
            >
              <HostWiseLogo size={28} />
              <span className="text-base font-semibold tracking-tight text-white">
                HostWise
              </span>
            </a>
            <p className="mt-4 text-sm leading-relaxed text-white/60">
              Own your data. Know your numbers. Grow your portfolio.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={startDownload}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-[#7B39FC] px-5 py-2.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-[#6a2fe0]"
              >
                Get HostWise
                <ArrowRight size={15} strokeWidth={2} aria-hidden="true" />
              </button>
              
            </div>
          </div>

          <nav aria-label="Footer">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-white/40">
              Site
            </p>
            <ul className="grid grid-cols-2 gap-x-10 gap-y-2.5 sm:grid-cols-3">
              {FOOTER_LINKS.map((link) =>
                "href" in link ? (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-white/60 transition-colors duration-200 hover:text-white"
                    >
                      {link.label}
                    </a>
                  </li>
                ) : (
                  <li key={link.label}>
                    <button
                      type="button"
                      onClick={link.action}
                      className="cursor-pointer text-sm text-white/60 transition-colors duration-200 hover:text-white"
                    >
                      {link.label}
                    </button>
                  </li>
                )
              )}
            </ul>
          </nav>
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 sm:flex-row">
          <p className="text-xs text-white/50">© 2026 HostWise</p>
          <div className="flex items-center gap-6 text-xs text-white/50">
            <a
              href={LINKS.repo}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors duration-200 hover:text-white"
            >
              GitHub
            </a>
            <a
              href={LINKS.email}
              className="transition-colors duration-200 hover:text-white"
            >
              Email
            </a>
            <a
              href="#/"
              className="transition-colors duration-200 hover:text-white"
            >
              Back to top
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

