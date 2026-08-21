import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Copy,
  Search,
} from "lucide-react";
import { LINKS } from "../lib/links";
import { DOWNLOAD_VERSION, SITE_ORIGIN } from "../lib/constants";
import { defaultDownload } from "../lib/downloads";
import { useDownloadGate } from "../lib/leadGate";
import { navigateToSection, scrollToId } from "../lib/navigation";

const DOC_OFFSET = 188;

const NAV = [
  {
    group: "Get started",
    items: [
      { id: "overview", title: "Overview" },
      { id: "benefits", title: "Benefits" },
      { id: "installation", title: "Installation" },
      { id: "first-run", title: "First run" },
    ],
  },
  {
    group: "Use HostWise",
    items: [
      { id: "dashboard", title: "Dashboard" },
      { id: "properties", title: "Properties" },
      { id: "finance", title: "Finance" },
      { id: "analytics", title: "Analytics" },
      { id: "ai-advisor", title: "AI Advisor" },
      { id: "reports", title: "Reports" },
      { id: "importing", title: "Import" },
      { id: "settings", title: "Settings" },
      { id: "feedback", title: "Feedback" },
    ],
  },
  {
    group: "Advice",
    items: [{ id: "tips", title: "Best tips & advice" }],
  },
  {
    group: "Support",
    items: [
      { id: "backups", title: "Backups & privacy" },
      { id: "faq", title: "FAQ" },
      { id: "contact", title: "Contact & licensing" },
    ],
  },
] as const;

const ALL_ITEMS: { id: string; title: string }[] = NAV.flatMap((group) =>
  group.items.map((item) => ({ id: item.id, title: item.title }))
);
const ALL_IDS: string[] = ALL_ITEMS.map((item) => item.id);

/** Tracks which section heading is currently in view. */
function useScrollSpy(ids: string[]) {
  const [active, setActive] = useState(ids[0] ?? "");
  useEffect(() => {
    const els = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (!els.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [ids]);
  return active;
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="scroll-mt-44 border-t border-gray-200 pt-10 first:border-t-0 first:pt-0">
      <h2
        id={id}
        className="group flex items-center gap-2 font-serif text-2xl font-normal tracking-tight text-[#191919] md:text-3xl"
      >
        {title}
        <button
          type="button"
          onClick={() => scrollToId(id, DOC_OFFSET)}
          aria-label={`Link to ${title}`}
          className="cursor-pointer text-accent/70 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        >
          #
        </button>
      </h2>
      {children}
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 text-[15px] leading-relaxed text-[#191919]/70">
      {children}
    </p>
  );
}

function Ul({ items }: { items: string[] }) {
  return (
    <ul className="mt-4 space-y-2">
      {items.map((item) => (
        <li
          key={item}
          className="flex gap-3 text-[15px] leading-relaxed text-[#191919]/70"
        >
          <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent/60" />
          {item}
        </li>
      ))}
    </ul>
  );
}

function CodeBlock({
  title = "terminal",
  code,
}: {
  title?: string;
  code: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-100/70 px-4 py-2">
        <span className="font-mono text-xs text-[#191919]/50">{title}</span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex cursor-pointer items-center gap-1.5 font-mono text-xs text-[#191919]/60 transition-colors duration-200 hover:text-[#191919]"
        >
          {copied ? (
            <Check size={13} strokeWidth={2} aria-hidden="true" />
          ) : (
            <Copy size={13} strokeWidth={2} aria-hidden="true" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-[#191919]">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function Docs() {
  const { openDownload } = useDownloadGate();
  const active = useScrollSpy(ALL_IDS);
  const [query, setQuery] = useState("");

  const startDownload = () => {
    const def = defaultDownload();
    openDownload({ href: def.href, os: def.os, source: "docs" });
  };

  const q = query.trim().toLowerCase();
  const filteredNav: {
    group: string;
    items: { id: string; title: string }[];
  }[] = NAV.map((group) => ({
    group: group.group,
    items: group.items
      .map((item) => ({ id: item.id, title: item.title }))
      .filter((item) => item.title.toLowerCase().includes(q)),
  })).filter((group) => group.items.length > 0);

  return (
    <main className="px-6 pt-28 sm:px-10 md:pt-36 lg:px-14">
      <div className="mx-auto max-w-7xl">
        {/* Docs toolbar: search + actions, sticky below the global pill header */}
        <div className="sticky top-20 z-30 mb-10 flex items-center gap-2 rounded-2xl border border-gray-200 bg-white/80 p-2 shadow-sm backdrop-blur-xl">
          <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl bg-gray-100 px-3.5 py-2.5">
            <Search
              size={16}
              strokeWidth={2}
              className="shrink-0 text-[#191919]/40"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the guide…"
              className="w-full bg-transparent text-sm text-[#191919] outline-none placeholder:text-[#191919]/40"
            />
          </div>
          <a
            href={LINKS.email}
            className="hidden items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-sm text-[#191919]/70 transition-colors duration-200 hover:bg-soft hover:text-[#191919] sm:inline-flex"
          >
            Support
            <ArrowUpRight size={15} strokeWidth={2} aria-hidden="true" />
          </a>
          <a
            href="#/feedback"
            className="hidden items-center rounded-xl px-3.5 py-2.5 text-sm text-[#191919]/70 transition-colors duration-200 hover:bg-soft hover:text-[#191919] md:inline-flex"
          >
            Feedback
          </a>
          <button
            type="button"
            onClick={startDownload}
            className="inline-flex cursor-pointer items-center rounded-full bg-[#191919] px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-[#191919]/90"
          >
            Install
          </button>
        </div>

        <div className="grid gap-12 lg:grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[250px_minmax(0,1fr)_190px]">
          {/* Sidebar navigation */}
          <aside className="hidden lg:block">
            <nav
              className="sticky top-40 max-h-[calc(100vh-12rem)] space-y-6 overflow-y-auto pb-10"
              aria-label="Documentation"
            >
              {filteredNav.map((group) => (
                <div key={group.group}>
                  <p className="mb-2 px-3 text-[11px] font-medium uppercase tracking-[0.18em] text-[#191919]/40">
                    {group.group}
                  </p>
                  <ul className="space-y-0.5">
                    {group.items.map((item) => {
                      const isActive = active === item.id;
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => scrollToId(item.id, DOC_OFFSET)}
                            className={`w-full cursor-pointer rounded-lg px-3 py-1.5 text-left text-sm transition-colors duration-200 ${
                              isActive
                                ? "bg-accent/10 font-medium text-accent"
                                : "text-[#191919]/70 hover:bg-soft hover:text-[#191919]"
                            }`}
                          >
                            {item.title}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
              {filteredNav.length === 0 && (
                <p className="px-3 text-sm text-[#191919]/50">No results.</p>
              )}
            </nav>
          </aside>

          {/* Main content */}
          <div className="min-w-0 max-w-3xl">
            <a
              href="#/"
              className="inline-flex items-center gap-1.5 text-sm text-[#191919]/60 transition-colors duration-200 hover:text-[#191919]"
            >
              <ArrowLeft size={16} strokeWidth={2} aria-hidden="true" />
              Back to home
            </a>

            <div className="mt-6">
              <h1 className="font-serif text-4xl font-normal tracking-tight text-[#191919] md:text-5xl">
                The HostWise Guide.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#191919]/70">
                Everything you need to get the most out of HostWise — install
                it, get your data in, and follow the same modules as the app:
                Dashboard, Properties, Finance, Analytics, AI Advisor, Reports,
                Import, Settings, and Feedback.
              </p>
            </div>

            <div className="mt-10 space-y-0">
              <Section id="overview" title="Overview">
                <P>
                  HostWise sits above your booking platforms — Airbnb,
                  Booking.com, Vrbo — and turns raw rental data into financial
                  clarity. It collects revenue, expenses, and occupancy from the
                  exports and calendars you already have, then shows you exactly
                  what each property makes: profit margins, health scores,
                  trends, and cashflow.
                </P>
                <P>
                  It answers the question your platforms never do:{" "}
                  <span className="font-medium text-[#191919]">
                    what is this actually making?
                  </span>{" "}
                  And because it lives on your machine — not in someone's cloud —
                  your data stays yours, forever.
                </P>
                <P>HostWise is built for:</P>
                <Ul
                  items={[
                    "Individual hosts managing a handful of properties",
                    "Property managers who need portfolio-level visibility",
                    "Owners and investors who receive executive summaries and tax-ready reports",
                  ]}
                />
              </Section>

              <Section id="benefits" title="Benefits">
                <P>Here is what changes when your numbers stop hiding:</P>
                <div className="mt-5 overflow-hidden rounded-xl border border-gray-200">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-100/70 text-[#191919]/60">
                      <tr>
                        <th className="px-4 py-2.5 font-medium">
                          Before HostWise
                        </th>
                        <th className="px-4 py-2.5 font-medium">
                          After HostWise
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {[
                        [
                          "4–8 hours on every financial report",
                          "Instant, straight from your real data",
                        ],
                        [
                          "Finding underperformers by guesswork",
                          "Health scores + data-driven ranking",
                        ],
                        [
                          "No idea what each property really nets",
                          "Per-property profit margins",
                        ],
                        [
                          "Tax prep scattered across spreadsheets",
                          "One clean export / PDF reports",
                        ],
                        [
                          "Manual trend charting",
                          "Built-in dashboards + AI explanations",
                        ],
                        [
                          "Data locked across half a dozen SaaS tools",
                          "One offline file on your disk",
                        ],
                      ].map(([before, after]) => (
                        <tr key={before}>
                          <td className="px-4 py-2.5 text-[#191919]/60">
                            {before}
                          </td>
                          <td className="px-4 py-2.5 font-medium text-[#191919]">
                            {after}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <P>
                  The bottom line: less time on bookkeeping, more confidence in
                  every decision you make.
                </P>
              </Section>

              <Section id="installation" title="Installation">
                <P>
                  Get HostWise on your machine in minutes. Installers are
                  hosted on the HostWise site and download automatically, and
                  every build is 64-bit and works fully offline.
                </P>
                <P>
                  <span className="font-medium text-[#191919]">macOS:</span>{" "}
                  Download the <span className="font-mono text-[13px]">.dmg</span>, open it, and drag
                  HostWise into Applications. If Gatekeeper asks the first
                  time, right-click the app and choose Open.
                </P>
                <P>
                  <span className="font-medium text-[#191919]">Windows:</span>{" "}
                  Download the <span className="font-mono text-[13px]">.exe</span> installer and run it.
                  Follow the on-screen steps — no other setup needed.
                </P>
                <P>
                  <span className="font-medium text-[#191919]">Debian / Ubuntu:</span>{" "}
                  Download the <span className="font-mono text-[13px]">.deb</span> package and install it:
                </P>
                <CodeBlock
                  code={`sudo apt install ./hostwise_${DOWNLOAD_VERSION}_amd64.deb`}
                />
                <P>
                  <span className="font-medium text-[#191919]">Fedora / RHEL:</span>{" "}
                  Download the <span className="font-mono text-[13px]">.rpm</span> package and install it:
                </P>
                <CodeBlock
                  code={`sudo dnf install ./hostwise-${DOWNLOAD_VERSION}-1.x86_64.rpm`}
                />
                <P>
                  <span className="font-medium text-[#191919]">Linux (AppImage):</span>{" "}
                  Make it executable and run it — no installation required:
                </P>
                <CodeBlock
                  code={`chmod +x HostWise_${DOWNLOAD_VERSION}_amd64.AppImage
./HostWise_${DOWNLOAD_VERSION}_amd64.AppImage`}
                />
                <P>
                  <span className="font-medium text-[#191919]">Arch / Manjaro:</span>{" "}
                  Install from the AUR:
                </P>
                <CodeBlock code="yay -S hostwise-bin" />
                <P>
                  Prefer a single command? This one-liner detects your system
                  and installs the right build for you (macOS &amp; Linux):
                </P>
                <CodeBlock
                  code={`curl -fsSL ${SITE_ORIGIN}/install.sh | sh`}
                />
                <P>
                  Head back to the{" "}
                  <button
                    type="button"
                    onClick={() => navigateToSection("download")}
                    className="cursor-pointer font-medium text-accent hover:underline"
                  >
                    download page
                  </button>{" "}
                  to grab the right file for your system.
                </P>
              </Section>

              <Section id="first-run" title="First run">
                <P>
                  When you open HostWise for the first time, set up your
                  business profile so your numbers, currency, and reports are
                  right from day one:
                </P>
                <Ul
                  items={[
                    "Open Settings → Business and add your business name, email, and country",
                    "Choose your default currency, language, tax rate, and fiscal year start",
                    "Your data lives in a local database, and automatic daily backups begin immediately",
                  ]}
                />
                <P>
                  Then head to{" "}
                  <span className="font-medium text-[#191919]">Import Data</span> to bring in your
                  bookings and expenses — your dashboard starts filling in as
                  soon as the first file lands.
                </P>
              </Section>

              <Section id="importing" title="Import">
                <P>
                  HostWise reads the data you already have. Import CSV exports
                  from Airbnb, Booking.com, or your own spreadsheets, plus iCal
                  calendars from your booking platforms.
                </P>
                <P>
                  Imports are idempotent: re-importing the same file skips
                  duplicates instead of corrupting your books, so you can
                  refresh a month later without worry.
                </P>
                <Ul
                  items={[
                    "Open Import Data and choose your source (CSV or iCal)",
                    "Select the file from your computer",
                    "Review the preview, then import",
                    "Repeat for expenses, other platforms, or calendar feeds",
                  ]}
                />
              </Section>

              <Section id="dashboard" title="Dashboard">
                <P>
                  One screen, every number that matters. Once your data is in,
                  the dashboard becomes the one screen you check — gross and net
                  revenue, expenses, profit margin, cashflow, and your property
                  count for the period you choose.
                </P>
                <Ul
                  items={[
                    "KPI cards: gross revenue, net revenue, profit margin, total expenses, cashflow, and property count",
                    "A revenue vs expenses chart, month by month",
                    "AI recommendations with confidence scores",
                    "An expense breakdown by category, so you can see where money goes",
                  ]}
                />
                <P>
                  Every number is computed from your real data and traceable
                  back to its source — nothing is estimated.
                </P>
              </Section>

              <Section id="properties" title="Properties">
                <P>
                  Manage your whole portfolio from one place. Each property gets
                  a card with its type, location, bedrooms, guest capacity, and a
                  live Health Score out of 100.
                </P>
                <Ul
                  items={[
                    "Add, edit, and organize properties and their listings across platforms",
                    "A 0–100 Health Score flags underperformers at a glance",
                    "Per-property analytics with a combined monthly revenue & expenses chart",
                  ]}
                />
              </Section>

              <Section id="finance" title="Finance">
                <P>
                  Record revenue and expenses per property and watch your
                  cashflow update in real time — net amounts are computed
                  automatically.
                </P>
                <Ul
                  items={[
                    "Revenue entries with gross amount, commission, and auto-calculated net",
                    "Expense entries with vendor, payment method, and automatic categorization",
                    "Summary cards: gross, net, expenses, cashflow, and margin across your portfolio",
                  ]}
                />
              </Section>

              <Section id="analytics" title="Analytics">
                <P>
                  Go deeper than the dashboard. Compare periods, spot
                  seasonality, and rank your properties by what they actually
                  earn.
                </P>
                <Ul
                  items={[
                    "Portfolio KPIs for any year or custom range",
                    "Expense trends month by month, so cost spikes are easy to plan for",
                    "Property ranking by net revenue, plus period-over-period comparison",
                  ]}
                />
              </Section>

              <Section id="reports" title="Reports">
                <P>
                  Impress owners and investors without the all-nighters.
                  Generate clean, professional financial reports — monthly
                  summaries, annual reports, executive overviews, and
                  portfolio breakdowns.
                </P>
                <P>
                  Reports render as structured, paginated PDFs on your machine
                  — ready to share with owners, lenders, or your accountant.
                  Use Print / Save PDF from the Reports screen.
                </P>
              </Section>

              <Section id="ai-advisor" title="AI Advisor">
                <P>
                  The built-in AI Advisor reads your own data and explains what
                  changed in plain language: revenue drops, unusual expenses,
                  underperforming properties, and what to do next.
                </P>
                <P>
                  You get a business health score, structured recommendations,
                  and a what-if simulator. Power users can connect their own
                  LLM key in Settings for richer summaries — the numbers always
                  come from your real data.
                </P>
              </Section>

              <Section id="settings" title="Settings">
                <P>
                  Set HostWise up the way you work — everything in one place.
                </P>
                <Ul
                  items={[
                    "Business: name, email, country, default currency, language, tax rate, and fiscal year start",
                    "AI: the built-in rules engine, or connect your own LLM key",
                    "Data & housekeeping: backups, import, maintenance, and logs",
                  ]}
                />
              </Section>

              <Section id="feedback" title="Feedback">
                <P>
                  Questions, feedback, or a bug? Reach us however you like.
                </P>
                <Ul
                  items={[
                    "Send feedback from inside the app — it opens a pre-filled email draft",
                    "Open an issue on GitHub for bugs and feature requests",
                    "Email support directly at support@hostwise.app",
                  ]}
                />
              </Section>

              <Section id="tips" title="Best tips & advice">
                <P>
                  Practical habits that get the most out of HostWise — and out
                  of your numbers.
                </P>
                <Ul
                  items={[
                    "Check in weekly, not monthly — a five-minute dashboard review catches problems early",
                    "Import as you go, so analytics and AI advice stay accurate all year",
                    "Trust the Health Score over raw revenue when deciding what to scale",
                    "Describe expenses clearly — HostWise creates the category automatically",
                    "Re-imports are safe: idempotent, never duplicated",
                    "Back up before big changes, so you can roll back instantly",
                  ]}
                />
              </Section>

              <Section id="backups" title="Backups & privacy">
                <P>
                  HostWise is local-first. Your data stays on your device in a
                  single SQLite file, and works fully offline.
                </P>
                <Ul
                  items={[
                    "Linux: ~/.local/share/hostwise",
                    "macOS: ~/Library/Application Support/hostwise",
                    "Windows: %APPDATA%\\hostwise",
                  ]}
                />
                <P>
                  Automatic daily backups plus manual backup and restore keep
                  your books safe. Sync is optional — your data is never locked
                  inside someone else's cloud.
                </P>
              </Section>

              <Section id="faq" title="FAQ">
                <P>
                  <span className="font-medium text-[#191919]">Is my data stored in the cloud?</span>{" "}
                  No. Everything stays in a local database on your machine. No
                  account, no cloud upload.
                </P>
                <P>
                  <span className="font-medium text-[#191919]">Which platforms does HostWise run on?</span>{" "}
                  Windows, macOS, and Linux (Debian, Fedora, AppImage, and the
                  AUR on Arch).
                </P>
                <P>
                  <span className="font-medium text-[#191919]">How do I get my data in?</span>{" "}
                  Import CSV exports or iCal feeds. Re-importing the same file
                  skips duplicates.
                </P>
                <P>
                  <span className="font-medium text-[#191919]">Can I export reports as PDF?</span>{" "}
                  Yes — monthly, annual, executive, and portfolio reports, all
                  rendered locally.
                </P>
                <P>
                  <span className="font-medium text-[#191919]">Do I need an account?</span>{" "}
                  No. HostWise works without one.
                </P>
              </Section>

              <Section id="contact" title="Contact & licensing">
                <P>
                  HostWise is a paid desktop product. A license unlocks the
                  full app on your machine, with your data staying local. Email
                  us for pricing, team licenses, and invoicing.
                </P>
                <P>
                  Questions, feedback, or a bug? Reach us however you like:
                </P>
                <div className="mt-5 flex flex-wrap gap-3">
                  <a
                    href={LINKS.email}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#191919] px-5 py-2.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-[#191919]/90"
                  >
                    Email support
                  </a>
                  <a
                    href={LINKS.issues}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-5 py-2.5 text-sm font-medium text-[#191919] transition-colors duration-200 hover:bg-soft"
                  >
                    Open an issue
                    <ArrowUpRight size={15} strokeWidth={2} aria-hidden="true" />
                  </a>
                  <a
                    href="#/feedback"
                    className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-5 py-2.5 text-sm font-medium text-[#191919] transition-colors duration-200 hover:bg-soft"
                  >
                    Send feedback
                  </a>
                </div>
              </Section>
            </div>

            {/* Docs footer */}
            <div className="mt-14 flex flex-col items-start justify-between gap-3 border-t border-gray-200 pt-6 sm:flex-row sm:items-center">
              <p className="text-sm text-[#191919]/50">
                Spot a mistake in this guide?
              </p>
              <a
                href={LINKS.repo}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-accent transition-colors duration-200 hover:underline"
              >
                Suggest an edit on GitHub
                <ArrowUpRight size={15} strokeWidth={2} aria-hidden="true" />
              </a>
            </div>
          </div>

          {/* On this page */}
          <aside className="hidden xl:block">
            <nav className="sticky top-40 space-y-1" aria-label="On this page">
              <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-[#191919]/40">
                On this page
              </p>
              {ALL_IDS.map((id) => {
                const title = ALL_ITEMS.find((item) => item.id === id)?.title ?? id;
                const isActive = active === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => scrollToId(id, DOC_OFFSET)}
                    className={`block w-full cursor-pointer rounded-lg px-3 py-1.5 text-left text-sm transition-colors duration-200 ${
                      isActive
                        ? "text-accent"
                        : "text-[#191919]/50 hover:text-[#191919]"
                    }`}
                  >
                    {title}
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      </div>
    </main>
  );
}
