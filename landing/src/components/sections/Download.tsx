import { useState } from "react";
import { ArrowRight, Check, Copy, Sparkles } from "lucide-react";
import { DOWNLOAD_VERSION, SITE_ORIGIN } from "../../lib/constants";
import { useDownloadGate } from "../../lib/leadGate";
import { LINKS } from "../../lib/links";
import { scrollToId } from "../../lib/navigation";

/** Local files served from public/downloads/ so they download directly. */
const file = (name: string) => `/downloads/${name}`;

/**
 * GitHub "latest" asset URLs — releases/latest/download/<asset> always points
 * to the newest published release, so the links stay current after version
 * bumps without touching the site.
 */
const release = (name: string) =>
  `https://github.com/mahmoud-ath/HostWise/releases/latest/download/${name}`;

/** What's new in the current release. */
const RELEASE_FEATURES = [
  "AI Financial Advisor — actionable recommendations with business impact, offline rules engine + BYOK LLM (OpenAI/Anthropic/DeepSeek/Ollama)",
  "Financial Dashboard & Portfolio — real-time KPIs, property health scores, expense tracking with per-record currency",
  "Professional PDF Reports — executive summaries, portfolio performance, and AI insights",
  "Idempotent Data Import — CSV + iCal, natural-key dedupe, never corrupts your books",
  "Automatic Daily Backups — SQLite with restore and verification",
  "Smart Notifications — profit drops, revenue spikes, report-ready alerts (deduplicated)" 
] as const;

const PLATFORMS = [
  {
    os: "macOS",
    format: "Installer (.dmg)",
    img: file("apple-icon.png"),
    href: release(`HostWise_${DOWNLOAD_VERSION}_aarch64.dmg`),
    available: true,
  },
  {
    os: "Windows",
    format: "Installer (.exe)",
    img: file("windows.png"),
    href: release(`HostWise_${DOWNLOAD_VERSION}_x64-setup.exe`),
    available: true,
  },
  {
    os: "Debian / Ubuntu",
    format: "Package (.deb)",
    img: file("Linux.png"),
    href: release(`HostWise_${DOWNLOAD_VERSION}_amd64.deb`),
    available: true,
  },
  {
    os: "Fedora / RHEL",
    format: "AppImage",
    img: file("Linux.png"),
    href: release(`HostWise_${DOWNLOAD_VERSION}_amd64.AppImage`),
    available: true,
  },
  {
    os: "Linux",
    format: "AppImage",
    img: file("Linux.png"),
    href: release(`HostWise_${DOWNLOAD_VERSION}_amd64.AppImage`),
    available: true,
  },
  {
    os: "Manjaro / Arch",
    format: "Coming soon",
    img: file("Linux.png"),
    href: "#",
    available: false,
  },
] as const;

export default function Download() {
  const { openDownload } = useDownloadGate();
  const [copied, setCopied] = useState(false);

  const installCmd = `curl -fsSL ${SITE_ORIGIN}/install.sh | sh`;

  const copyInstall = async () => {
    try {
      await navigator.clipboard.writeText(installCmd);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const startDownload = (platform: (typeof PLATFORMS)[number]) => {
    if (!platform.available) return; // Don't allow download for coming soon items
    
    openDownload({
      href: platform.href,
      external: false, // direct file downloads (GitHub assets)
      os: platform.os,
      source: platform.format,
    });
  };

  return (
    <section
      id="download"
      className="scroll-mt-24 border-t border-gray-200 px-6 py-20 sm:py-24 lg:px-14 lg:py-28"
    >
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <h2 className="font-serif text-3xl font-normal tracking-tight text-[#191919] sm:text-4xl md:text-5xl">
              Download HostWise.
            </h2>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[#191919]/70 md:text-base">
              Free to try, built for your machine. Pick your platform and the
              installer downloads straight from GitHub.
            </p>
          </div>
          <a
            href={LINKS.download}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-accent transition-colors duration-200 hover:underline"
          >
            Older releases on GitHub
            <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
          </a>
        </div>

        {/* What's in this release */}
        <div className="mt-10 rounded-2xl border border-gray-200 bg-soft p-6 sm:p-8">
          <div>
            <span className="text-xs font-medium uppercase tracking-[0.22em] text-accent">
              What's new in v{DOWNLOAD_VERSION}
            </span>
            <h3 className="mt-2 font-serif text-2xl font-normal tracking-tight text-[#191919]">
              Everything in this release.
            </h3>
          </div>
          <ul className="mt-5 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
            {RELEASE_FEATURES.map((feature) => (
              <li
                key={feature}
                className="flex items-start gap-2.5 text-sm leading-relaxed text-[#191919]/80"
              >
                <Sparkles
                  size={15}
                  strokeWidth={2}
                  className="mt-0.5 shrink-0 text-accent"
                  aria-hidden="true"
                />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PLATFORMS.map((platform) => (
            <button
              key={platform.os}
              type="button"
              onClick={() => startDownload(platform)}
              disabled={!platform.available}
              className={`group cursor-pointer rounded-2xl border border-gray-200 bg-white p-5 text-left transition-colors duration-200 ${
                platform.available 
                  ? "hover:border-gray-300 hover:bg-soft" 
                  : "opacity-60 cursor-not-allowed"
              }`}
            >
              <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-gray-200">
                <img
                  src={platform.img}
                  alt=""
                  loading="lazy"
                  className="h-9 w-9 object-contain"
                />
              </span>
              <h3 className="mt-4 font-semibold text-[#191919]">
                {platform.os}
              </h3>
              <p className="mt-1 text-sm text-[#191919]/60">
                {platform.format}
              </p>
              <span className={`mt-4 inline-flex items-center gap-1 text-sm font-medium ${
                platform.available 
                  ? "text-[#191919]/80 group-hover:text-accent" 
                  : "text-[#191919]/40"
              } transition-colors duration-200`}>
                {platform.available ? "Download" : "Coming Soon"}
                {platform.available && (
                  <ArrowRight
                    size={14}
                    strokeWidth={2}
                    className="transition-transform duration-200 group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                )}
              </span>
            </button>
          ))}
        </div>

        {/* One-line terminal install */}
        <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
          <div>
            <h3 className="font-serif text-xl font-normal tracking-tight text-[#191919]">
              Prefer the terminal?
            </h3>
            <p className="mt-1 text-sm text-[#191919]/60">
              One command detects your OS and installs the right build — macOS
              &amp; Linux.
            </p>
          </div>
          <div className="mt-4 flex items-center gap-2 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 p-1 pl-4">
            <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-[13px] text-[#191919]">
              {installCmd}
            </code>
            <button
              type="button"
              onClick={copyInstall}
              className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-[#191919] px-3 py-2 font-mono text-xs text-white transition-colors duration-200 hover:bg-[#191919]/90"
            >
              {copied ? (
                <Check size={13} strokeWidth={2} aria-hidden="true" />
              ) : (
                <Copy size={13} strokeWidth={2} aria-hidden="true" />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="mt-3 text-xs text-[#191919]/45">
            Windows? Grab the .exe above — or run it in Git Bash / WSL.
          </p>
        </div>

        <p className="mt-6 text-sm text-[#191919]/50">
          Installers are hosted on GitHub Releases and download automatically.{" "}
          <button
            type="button"
            onClick={() => scrollToId("product")}
            className="cursor-pointer font-medium text-[#191919]/70 underline-offset-2 transition-colors duration-200 hover:text-[#191919] hover:underline"
          >
            See the app first
          </button>{" "}
          or read the{" "}
          <a
            href="#/docs"
            className="font-medium text-[#191919]/70 underline-offset-2 transition-colors duration-200 hover:text-[#191919] hover:underline"
          >
            guide
          </a>
          .
        </p>
      </div>
    </section>
  );
}