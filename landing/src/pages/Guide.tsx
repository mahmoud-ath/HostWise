import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
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

type GuideSection = { id: string; title: string };
type GuidePage = {
  id: string;
  group: string;
  title: string;
  sections: GuideSection[];
};

/**
 * The HostWise Guide — one page per module, mirroring the tabs inside the app.
 * Left sidebar = global guide nav (grouped). Right rail = "On this page" TOC
 * scoped to the current module only.
 */
const GUIDE: GuidePage[] = [
  {
    id: "overview",
    group: "Get started",
    title: "Overview",
    sections: [
      { id: "overview", title: "What it is" },
      { id: "benefits", title: "Benefits" },
    ],
  },
  {
    id: "installation",
    group: "Get started",
    title: "Installation",
    sections: [
      { id: "install", title: "Install per OS" },
      { id: "first-run", title: "First run" },
    ],
  },
  {
    id: "dashboard",
    group: "Use HostWise",
    title: "Dashboard",
    sections: [
      { id: "dashboard-kpis", title: "KPI cards" },
      { id: "dashboard-charts", title: "Charts" },
      { id: "dashboard-ai", title: "AI recommendations" },
    ],
  },
  {
    id: "properties",
    group: "Use HostWise",
    title: "Properties",
    sections: [
      { id: "properties-portfolio", title: "Your portfolio" },
      { id: "properties-health", title: "Health score" },
      { id: "properties-analytics", title: "Property analytics" },
    ],
  },
  {
    id: "finance",
    group: "Use HostWise",
    title: "Finance",
    sections: [
      { id: "finance-revenue", title: "Revenue" },
      { id: "finance-expenses", title: "Expenses" },
      { id: "finance-summary", title: "Summary" },
    ],
  },
  {
    id: "analytics",
    group: "Use HostWise",
    title: "Analytics",
    sections: [
      { id: "analytics-kpis", title: "Portfolio KPIs" },
      { id: "analytics-trends", title: "Expense trends" },
      { id: "analytics-ranking", title: "Seasonality & ranking" },
    ],
  },
  {
    id: "ai-advisor",
    group: "Use HostWise",
    title: "AI Advisor",
    sections: [
      { id: "ai-summary", title: "Executive summary" },
      { id: "ai-recommendations", title: "Recommendations" },
      { id: "ai-confidence", title: "Confidence scores" },
    ],
  },
  {
    id: "reports",
    group: "Use HostWise",
    title: "Reports",
    sections: [
      { id: "reports-period", title: "Period & currency" },
      { id: "reports-content", title: "Report contents" },
      { id: "reports-pdf", title: "PDF export" },
    ],
  },
  {
    id: "import",
    group: "Use HostWise",
    title: "Import",
    sections: [
      { id: "import-csv", title: "CSV upload" },
      { id: "import-templates", title: "Sample templates" },
      { id: "import-ical", title: "iCal feeds" },
    ],
  },
  {
    id: "settings",
    group: "Use HostWise",
    title: "Settings",
    sections: [
      { id: "settings-business", title: "Business" },
      { id: "settings-ai", title: "AI settings" },
      { id: "settings-data", title: "Data & housekeeping" },
    ],
  },
  {
    id: "feedback",
    group: "Use HostWise",
    title: "Feedback",
    sections: [
      { id: "feedback-send", title: "Send feedback" },
      { id: "feedback-contact", title: "Contact us" },
    ],
  },
  {
    id: "tips",
    group: "Advice",
    title: "Best tips & advice",
    sections: [
      { id: "tips-habits", title: "Smart habits" },
      { id: "tips-data", title: "Data hygiene" },
      { id: "tips-decisions", title: "Smarter decisions" },
    ],
  },
  {
    id: "backups",
    group: "Support",
    title: "Backups & privacy",
    sections: [
      { id: "backups-local", title: "Local-first" },
      { id: "backups-restore", title: "Backup & restore" },
    ],
  },
  {
    id: "faq",
    group: "Support",
    title: "FAQ",
    sections: [{ id: "faq", title: "Frequently asked" }],
  },
  {
    id: "contact",
    group: "Support",
    title: "Contact & licensing",
    sections: [{ id: "contact", title: "Contact & licensing" }],
  },
] as const;

const GUIDE_IDS: string[] = GUIDE.map((page) => page.id);
const GROUPS: string[] = [...new Set(GUIDE.map((page) => page.group))];

/** Tracks which section heading of the current page is in view. */
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

/** A rounded screenshot used to illustrate guide pages. */
function Shot({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="h-auto w-full object-cover"
      />
    </div>
  );
}

function PageContent({ page }: { page: GuidePage }) {
  switch (page.id) {
    case "overview":
      return (
        <>
          <Shot src="/screenshots/01_dashboard.webp" alt="HostWise dashboard" />
          <Section id="overview" title="What it is">
            <P>
              HostWise sits above your booking platforms — Airbnb, Booking.com,
              Vrbo — and turns raw rental data into financial clarity. It
              collects revenue, expenses, and occupancy from the exports and
              calendars you already have, then shows you exactly what each
              property makes: profit margins, health scores, trends, and
              cashflow.
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
                    <th className="px-4 py-2.5 font-medium">Before HostWise</th>
                    <th className="px-4 py-2.5 font-medium">After HostWise</th>
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
        </>
      );
    case "installation":
      return (
        <>
          <Section id="install" title="Install per OS">
            <P>
              Get HostWise on your machine in minutes. Installers are hosted on
              the HostWise site and download automatically, and every build is
              64-bit and works fully offline.
            </P>
            <P>
              <span className="font-medium text-[#191919]">macOS:</span>{" "}
              Download the <span className="font-mono text-[13px]">.dmg</span>, open it, and drag
              HostWise into Applications. If Gatekeeper asks the first time,
              right-click the app and choose Open.
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
              Prefer a single command? This one-liner detects your system and
              installs the right build for you (macOS &amp; Linux):
            </P>
            <CodeBlock code={`curl -fsSL ${SITE_ORIGIN}/install.sh | sh`} />
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
              When you open HostWise for the first time, set up your business
              profile so your numbers, currency, and reports are right from day
              one:
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
              bookings and expenses — your dashboard starts filling in as soon
              as the first file lands.
            </P>
          </Section>
        </>
      );
    case "dashboard":
      return (
        <>
          <Shot
            src="/screenshots/17_dashboard_dark_mode.webp"
            alt="HostWise dashboard in dark mode"
          />
          <Section id="dashboard-kpis" title="KPI cards">
            <P>
              One screen, every number that matters. Once your data is in, the
              dashboard becomes the one screen you check — gross revenue, net
              revenue, profit margin, total expenses, cashflow, and your
              property count, scoped to the period you choose.
            </P>
          </Section>
          <Section id="dashboard-charts" title="Charts">
            <P>
              A revenue vs expenses chart compares monthly net revenue against
              costs, so you can spot when expenses creep up and where your best
              months are. Every chart and KPI follows the selected period.
            </P>
          </Section>
          <Section id="dashboard-ai" title="AI recommendations">
            <P>
              The AI Financial Advisor scans your data and surfaces issues with
              confidence scores, plus an expense breakdown by category so you
              can see exactly where money goes. Every number is computed from
              your real data and traceable to its source — nothing is estimated.
            </P>
          </Section>
        </>
      );
    case "properties":
      return (
        <>
          <Shot src="/screenshots/02_Properties.webp" alt="HostWise properties" />
          <Section id="properties-portfolio" title="Your portfolio">
            <P>
              Manage your whole portfolio from one place. Each property gets a
              card with its type, location, bedrooms, guest capacity, and a
              live Health Score — and one property can hold multiple listings
              across platforms.
            </P>
          </Section>
          <Section id="properties-health" title="Health score">
            <P>
              A 0–100 Health Score flags underperformers at a glance. It weighs
              occupancy, profit margin, cancellations, and expense ratio —
              green means healthy, yellow means average, red means it needs
              attention.
            </P>
          </Section>
          <Section id="properties-analytics" title="Property analytics">
            <P>
              Open any property's analytics to see its key stats plus a
              combined monthly revenue &amp; expenses chart, so you can compare
              income and costs month by month.
            </P>
          </Section>
        </>
      );
    case "finance":
      return (
        <>
          <Shot src="/screenshots/05_Finance.webp" alt="HostWise finance" />
          <Section id="finance-revenue" title="Revenue">
            <P>
              Record income from each property — gross amount, commission, and
              description — and the net amount is computed automatically.
            </P>
          </Section>
          <Section id="finance-expenses" title="Expenses">
            <P>
              Track costs per property with vendor, payment method, and amount.
              Clear descriptions auto-categorize expenses, keeping your
              breakdown accurate without manual tagging.
            </P>
          </Section>
          <Section id="finance-summary" title="Summary">
            <P>
              Top summary cards show your overall financial health — gross, net,
              expenses, cashflow, and margin across all properties — updating in
              real time as you record entries.
            </P>
          </Section>
        </>
      );
    case "analytics":
      return (
        <>
          <Shot src="/screenshots/06_Analytics.webp" alt="HostWise analytics" />
          <Section id="analytics-kpis" title="Portfolio KPIs">
            <P>
              Deep-dive into portfolio performance for any year or custom range:
              property count, net revenue, profit margin, and average revenue
              per property.
            </P>
          </Section>
          <Section id="analytics-trends" title="Expense trends">
            <P>
              Monthly expenses tracked alongside revenue, so cost spikes by
              season are easy to spot — and easy to plan for.
            </P>
          </Section>
          <Section id="analytics-ranking" title="Seasonality & ranking">
            <P>
              Monthly revenue bars show your best months, properties are ranked
              by what they actually earn, and "Compare with previous period"
              measures growth against the equal-length preceding window.
            </P>
          </Section>
        </>
      );
    case "ai-advisor":
      return (
        <>
          <Shot src="/screenshots/08_AI_Advisor.webp" alt="HostWise AI Advisor" />
          <Section id="ai-summary" title="Executive summary">
            <P>
              The built-in AI Advisor reads your own data and explains what
              changed in plain language — revenue, margin, growth — without
              sending your numbers anywhere.
            </P>
          </Section>
          <Section id="ai-recommendations" title="Recommendations">
            <P>
              Each recommendation includes the cause, the business impact, the
              action to take, and the expected improvement — so you always know
              why and what to do next.
            </P>
          </Section>
          <Section id="ai-confidence" title="Confidence scores">
            <P>
              Every recommendation carries a confidence score from 0–100%.
              Power users can connect their own LLM key in Settings for richer
              summaries — the numbers always come from your real data.
            </P>
          </Section>
        </>
      );
    case "reports":
      return (
        <>
          <Shot src="/screenshots/09_Reports.webp" alt="HostWise reports" />
          <Section id="reports-period" title="Period & currency">
            <P>
              Pick a year or any custom date range and choose the currency. The
              report compares your period against the equal-length previous one,
              so you always see the trend, not just the total.
            </P>
          </Section>
          <Section id="reports-content" title="Report contents">
            <P>
              Clean, professional financial reports: monthly summaries, annual
              reports, executive overviews, and portfolio breakdowns — with KPI
              comparison, revenue by property, monthly trends, and expense
              breakdown.
            </P>
          </Section>
          <Section id="reports-pdf" title="PDF export">
            <P>
              Reports render as structured, paginated PDFs on your machine —
              ready to share with owners, lenders, or your accountant. Impress
              them without the all-nighters.
            </P>
          </Section>
        </>
      );
    case "import":
      return (
        <>
          <Shot src="/screenshots/10_Import_Data.webp" alt="HostWise data import" />
          <Section id="import-csv" title="CSV upload">
            <P>
              Import CSV exports from Airbnb, Booking.com, or your own
              spreadsheets. Upload the file, preview its columns, then import —
              missing properties are created automatically.
            </P>
            <P>
              Imports are idempotent: re-importing the same file skips
              duplicates instead of corrupting your books.
            </P>
          </Section>
          <Section id="import-templates" title="Sample templates">
            <P>
              On the Import page, download ready-to-use sample templates for
              reservations, revenues, and expenses and base your own files on
              them — the columns match the importer exactly.
            </P>
          </Section>
          <Section id="import-ical" title="iCal feeds">
            <P>
              Add iCal calendars from your booking platforms so occupancy and
              calendar data stay current without manual entry.
            </P>
          </Section>
        </>
      );
    case "settings":
      return (
        <>
          <Shot src="/screenshots/14_settings.webp" alt="HostWise settings" />
          <Section id="settings-business" title="Business">
            <P>
              Set your business name, contact email, country, default currency,
              language, tax rate, and fiscal year start. These apply across the
              whole app.
            </P>
          </Section>
          <Section id="settings-ai" title="AI settings">
            <P>
              Use the built-in rules engine, or connect your own LLM key (e.g.
              DeepSeek, OpenAI) for richer executive summaries — your data
              always stays on your machine.
            </P>
          </Section>
          <Section id="settings-data" title="Data & housekeeping">
            <P>
              Back up and restore, import data, run maintenance to optimize the
              database, clear cache, view logs, and restart the backend.
            </P>
          </Section>
        </>
      );
    case "feedback":
      return (
        <>
          <Shot src="/screenshots/16_feedback.webp" alt="HostWise feedback" />
          <Section id="feedback-send" title="Send feedback">
            <P>
              Pick a category (bug report, feature request, question), add your
              email and message, and submit — the app opens a pre-filled email
              draft in your mail client. Just press send.
            </P>
          </Section>
          <Section id="feedback-contact" title="Contact us">
            <P>
              Prefer email? Reach us directly at markuspub4@gmail.com. We
              usually respond within 1–2 business days.
            </P>
          </Section>
        </>
      );
    case "tips":
      return (
        <>
          <Shot src="/screenshots/13_best_tips.webp" alt="HostWise best tips" />
          <Section id="tips-habits" title="Smart habits">
            <Ul
              items={[
                "Check in weekly, not monthly — a five-minute dashboard review catches problems early",
                "Trust the Health Score over raw revenue when deciding what to scale",
              ]}
            />
          </Section>
          <Section id="tips-data" title="Data hygiene">
            <Ul
              items={[
                "Import as you go, so analytics and AI advice stay accurate all year",
                "Describe expenses clearly — HostWise creates the category automatically",
                "Re-imports are safe: idempotent, never duplicated",
              ]}
            />
          </Section>
          <Section id="tips-decisions" title="Smarter decisions">
            <Ul
              items={[
                "Back up before big changes, so you can roll back instantly",
                "Compare with the previous period before raising or cutting prices",
              ]}
            />
          </Section>
        </>
      );
    case "backups":
      return (
        <>
          <Section id="backups-local" title="Local-first">
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
          </Section>
          <Section id="backups-restore" title="Backup & restore">
            <P>
              Automatic daily backups plus manual backup and restore keep your
              books safe. Sync is optional — your data is never locked inside
              someone else's cloud.
            </P>
          </Section>
        </>
      );
    case "faq":
      return (
        <Section id="faq" title="Frequently asked">
          <P>
            <span className="font-medium text-[#191919]">
              Is my data stored in the cloud?
            </span>{" "}
            No. Everything stays in a local database on your machine. No
            account, no cloud upload.
          </P>
          <P>
            <span className="font-medium text-[#191919]">
              Which platforms does HostWise run on?
            </span>{" "}
            Windows, macOS, and Linux (Debian, Fedora, AppImage, and the AUR on
            Arch).
          </P>
          <P>
            <span className="font-medium text-[#191919]">
              How do I get my data in?
            </span>{" "}
            Import CSV exports or iCal feeds. Re-importing the same file skips
            duplicates.
          </P>
          <P>
            <span className="font-medium text-[#191919]">
              Can I export reports as PDF?
            </span>{" "}
            Yes — monthly, annual, executive, and portfolio reports, all
            rendered locally.
          </P>
          <P>
            <span className="font-medium text-[#191919]">
              Do I need an account?
            </span>{" "}
            No. HostWise works without one.
          </P>
        </Section>
      );
    case "contact":
      return (
        <Section id="contact" title="Contact & licensing">
          <P>
            HostWise is a paid desktop product. A license unlocks the full app
            on your machine, with your data staying local. Email us for pricing,
            team licenses, and invoicing.
          </P>
          <P>Questions, feedback, or a bug? Reach us however you like:</P>
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
      );
    default:
      return null;
  }
}

export default function Guide({ guideId }: { guideId: string | null }) {
  const { openDownload } = useDownloadGate();
  const [query, setQuery] = useState("");

  const currentId = GUIDE_IDS.includes(guideId ?? "")
    ? (guideId as string)
    : GUIDE[0].id;
  const page = GUIDE.find((p) => p.id === currentId) as GuidePage;
  const pageIndex = GUIDE.findIndex((p) => p.id === page.id);
  const prevPage = pageIndex > 0 ? GUIDE[pageIndex - 1] : null;
  const nextPage = pageIndex < GUIDE.length - 1 ? GUIDE[pageIndex + 1] : null;
  const sectionIds = page.sections.map((s) => s.id);
  const active = useScrollSpy(sectionIds);

  // Start each guide page at the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page.id]);

  const startDownload = () => {
    const def = defaultDownload();
    openDownload({ href: def.href, os: def.os, source: "guide" });
  };

  const q = query.trim().toLowerCase();
  const filtered = GUIDE.filter((p) => p.title.toLowerCase().includes(q));

  return (
    <main className="px-6 pt-28 sm:px-10 md:pt-36 lg:px-14">
      <div className="mx-auto max-w-7xl">
<div className="mb-6 flex items-center justify-center gap-3">
  <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#191919]/40">
          The HostWise Guide.
  </span>
</div>
            {/* Toolbar: search + actions, sticky below the global pill header */}
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
          {/* Global guide nav */}
          <aside className="hidden lg:block">
            <nav
              className="sticky top-40 space-y-5 pb-4"
              aria-label="Guide"
            >
              {GROUPS.map((group) => {
                const items = filtered.filter((p) => p.group === group);
                if (!items.length) return null;
                return (
                  <div key={group}>
                    <p className="mb-2 px-3 text-[11px] font-medium uppercase tracking-[0.18em] text-[#191919]/40">
                      {group}
                    </p>
                    <ul className="space-y-0.5">
                      {items.map((p) => {
                        const isActive = p.id === page.id;
                        return (
                          <li key={p.id}>
                            <a
                              href={`#/docs/${p.id}`}
                              className={`block rounded-lg px-3 py-1.5 text-sm transition-colors duration-200 ${
                                isActive
                                  ? "bg-accent/10 font-medium text-accent"
                                  : "text-[#191919]/70 hover:bg-soft hover:text-[#191919]"
                              }`}
                            >
                              {p.title}
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <p className="px-3 text-sm text-[#191919]/50">No results.</p>
              )}
            </nav>
          </aside>

          {/* Page content */}
          <div className="min-w-0 max-w-3xl">
            <a
              href="#/"
              className="inline-flex items-center gap-1.5 text-sm text-[#191919]/60 transition-colors duration-200 hover:text-[#191919]"
            >
              <ArrowLeft size={16} strokeWidth={2} aria-hidden="true" />
              Back to home
            </a>

            <div className="mt-6">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#191919]/40">
                {page.group}
              </p>
              <h1 className="mt-2 font-serif text-4xl font-normal tracking-tight text-[#191919] md:text-5xl">
                {page.title}.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#191919]/70">
                The HostWise Guide — everything you need to get the most out of
                the app, module by module.
              </p>
            </div>

            <div className="mt-10 space-y-0">
              <PageContent page={page} />
            </div>

            {/* Friendly prev / next navigation */}
            <div className="mt-12 grid gap-3 border-t border-gray-200 pt-6 sm:grid-cols-2">
              {prevPage ? (
                <a
                  href={`#/docs/${prevPage.id}`}
                  className="group inline-flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 transition-colors duration-200 hover:border-gray-300 hover:bg-soft"
                >
                  <ArrowLeft
                    size={16}
                    strokeWidth={2}
                    className="shrink-0 text-[#191919]/40 transition-transform duration-200 group-hover:-translate-x-0.5"
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-[#191919]/40">
                      {prevPage.group} · Previous
                    </span>
                    <span className="block truncate text-sm font-medium text-[#191919]">
                      {prevPage.title}
                    </span>
                  </span>
                </a>
              ) : (
                <span aria-hidden="true" />
              )}
              {nextPage ? (
                <a
                  href={`#/docs/${nextPage.id}`}
                  className="group inline-flex items-center justify-end gap-3 rounded-2xl border border-gray-200 bg-white p-4 text-right transition-colors duration-200 hover:border-gray-300 hover:bg-soft"
                >
                  <span className="min-w-0">
                    <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-[#191919]/40">
                      {nextPage.group} · Next
                    </span>
                    <span className="block truncate text-sm font-medium text-[#191919]">
                      {nextPage.title}
                    </span>
                  </span>
                  <ArrowRight
                    size={16}
                    strokeWidth={2}
                    className="shrink-0 text-[#191919]/40 transition-transform duration-200 group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </a>
              ) : (
                <span aria-hidden="true" />
              )}
            </div>

            {/* Page footer */}
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

          {/* On this page (current module only) */}
          <aside className="hidden xl:block">
            <nav className="sticky top-40 space-y-1" aria-label="On this page">
              <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-[#191919]/40">
                On this page
              </p>
              {page.sections.map((section) => {
                const isActive = active === section.id;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => scrollToId(section.id, DOC_OFFSET)}
                    className={`block w-full cursor-pointer rounded-lg px-3 py-1.5 text-left text-sm transition-colors duration-200 ${
                      isActive
                        ? "text-accent"
                        : "text-[#191919]/50 hover:text-[#191919]"
                    }`}
                  >
                    {section.title}
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
