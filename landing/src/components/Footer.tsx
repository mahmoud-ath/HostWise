import { useState } from "react";
import {
  ArrowRight,
  Download,
  Mail,
  
} from "lucide-react";
import HostWiseLogo from "./HostWiseLogo";
import { submitLead } from "../lib/leadGate";
import { LINKS } from "../lib/links";
import { navigateToSection } from "../lib/navigation";

const FOOTER_COLUMNS = {
  product: {
    title: "Product",
    links: [
      { label: "Features", action: () => navigateToSection("features") },
      { label: "Download", action: () => navigateToSection("download") },
      { label: "FAQ", action: () => navigateToSection("faq") },
    ],
  },
  company: {
    title: "Company",
    links: [
      { label: "GitHub", href: LINKS.repo },
      { label: "Email support", href: LINKS.email },
      { label: "Open an issue", href: LINKS.issues },
    ],
  },
  resources: {
    title: "Resources",
    links: [
      { label: "Guide", href: "#/docs" },
      { label: "Feedback", href: "#/feedback" },
      { label: "Releases", href: LINKS.download },
    ],
  },
} as const;

/**
 * Dark, marketing-focused footer: a rotated stretched watermark sits behind the
 * content, a "Get HostWise" card routes to the Download section, and the email
 * form saves leads to the same Google Sheet as the download gate.
 */
export default function Footer() {
  const [email, setEmail] = useState("");
  const [emailStatus, setEmailStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");

  const goToDownload = () => navigateToSection("download");

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!value) return;

    setEmailStatus("loading");
    // Same lead-capture flow as the download gate — saved to the Google Sheet.
    await submitLead({
      email: value,
      os: "Newsletter",
      source: "footer-subscribe",
    });
    setEmailStatus("success");
    setEmail("");
    window.setTimeout(() => setEmailStatus("idle"), 3000);
  };

  return (
    <footer className="relative overflow-hidden bg-[#0a0a0a] px-6 pb-6 pt-16 text-white lg:px-14">
      {/* Rotated stretched background watermark */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden select-none"
      >
        <span
          className="whitespace-nowrap font-serif text-[15vw] leading-none text-white/[0.03] md:text-[12vw] lg:text-[10vw]"
          style={{
            transform: "rotate(-8deg) scaleX(1.6)",
            letterSpacing: "0.15em",
            transformOrigin: "center",
          }}
        >
          HostWise
        </span>
      </div>

      <div className="relative mx-auto max-w-7xl">
        {/* Top section: brand + CTAs */}
        <div className="grid gap-10 md:grid-cols-3">
          {/* Brand + social */}
          <div>
            <a
              href="#/"
              className="flex items-center gap-2.5"
              aria-label="HostWise home"
            >
              <HostWiseLogo size={32} />
              <span className="text-xl font-bold tracking-tight text-white">
                HostWise
              </span>
            </a>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/60">
              Own your data. Know your numbers. Grow your portfolio.
            </p>
            <p className="mt-2 max-w-xs text-sm text-white/40">
              The desktop app for vacation rental hosts who want to understand
              their business performance.
            </p>
            
          </div>

          {/* Download CTA → Download section */}
          <div>
            <div className="relative flex h-full flex-col rounded-2xl border border-white/5 bg-white/5 p-6 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/40">
                <Download size={14} />
                <span>Download</span>
              </div>
              <h3 className="mt-2 text-lg font-semibold">Get HostWise</h3>
              <p className="mt-1 text-sm text-white/50">
                Available for macOS, Windows &amp; Linux.
              </p>
              <button
                type="button"
                onClick={goToDownload}
                className="mt-4 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#7B39FC] px-5 py-3 text-sm font-medium text-white transition-all hover:scale-[1.02] hover:bg-[#6a2fe0] active:scale-[0.98]"
              >
                <Download size={16} />
                Get HostWise
                <ArrowRight size={14} strokeWidth={2} />
              </button>
              <p className="mt-2 text-center text-xs text-white/30">
                No credit card required
              </p>
            </div>
          </div>

          {/* Email capture */}
          <div>
            <div className="relative flex h-full flex-col rounded-2xl border border-white/5 bg-white/5 p-6 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/40">
                <Mail size={14} />
                <span>Stay updated</span>
              </div>
              <h3 className="mt-2 text-lg font-semibold">Get early access</h3>
              <p className="mt-1 text-sm text-white/50">
                Product updates, tips, and exclusive offers.
              </p>
              <form onSubmit={handleEmailSubmit} className="mt-4">
                <div className="flex flex-col gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                    disabled={
                      emailStatus === "loading" || emailStatus === "success"
                    }
                    className="w-full rounded-xl bg-white/10 px-4 py-2.5 text-sm text-white outline-none transition-all placeholder:text-white/30 focus:ring-2 focus:ring-[#7B39FC] disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={
                      emailStatus === "loading" || emailStatus === "success"
                    }
                    className="w-full cursor-pointer rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-white/20 disabled:opacity-50"
                  >
                    {emailStatus === "loading" && "Subscribing..."}
                    {emailStatus === "success" && "✓ Subscribed!"}
                    {emailStatus === "error" && "Try again"}
                    {emailStatus === "idle" && "Subscribe"}
                  </button>
                </div>
                {emailStatus === "success" && (
                  <p className="mt-2 text-center text-xs text-green-400">
                    Thanks for subscribing! 🎉
                  </p>
                )}
                {emailStatus === "error" && (
                  <p className="mt-2 text-center text-xs text-red-400">
                    Something went wrong. Please try again.
                  </p>
                )}
              </form>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="my-12 border-t border-white/5" />

        {/* Middle section: navigation links */}
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {Object.entries(FOOTER_COLUMNS).map(([key, column]) => (
            <div key={key}>
              <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/30">
                {column.title}
              </p>
              <ul className="mt-3 space-y-2">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {"action" in link ? (
                      <button
                        type="button"
                        onClick={link.action}
                        className="text-sm text-white/40 transition-colors hover:text-white"
                      >
                        {link.label}
                      </button>
                    ) : (
                      <a
                        href={link.href}
                        className="text-sm text-white/40 transition-colors hover:text-white"
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-6 sm:flex-row">
          <p className="text-xs text-white/30">
            © 2026 HostWise. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center gap-4 text-xs text-white/30">
            <a href="#/privacy" className="transition-colors hover:text-white">
              Privacy Policy
            </a>
            <span className="h-3 w-px bg-white/10" aria-hidden="true" />
            <a href="#/terms" className="transition-colors hover:text-white">
              Terms of Service
            </a>
            <span className="h-3 w-px bg-white/10" aria-hidden="true" />
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="cursor-pointer transition-colors hover:text-white"
            >
              Back to top ↑
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
