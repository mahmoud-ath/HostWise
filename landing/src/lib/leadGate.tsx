import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Check, Loader2, Mail, X } from "lucide-react";
import { LEAD_SHEET_URL } from "./constants";
import { detectPlatform } from "./downloads";

export type DownloadRequest = {
  /** File to download (or URL to open) once the email is captured. */
  href: string;
  /** Open in a new tab instead of downloading a local file (e.g. AUR). */
  external?: boolean;
  /** Human label shown in the modal, e.g. "macOS". */
  os?: string;
  /** Which button/card triggered the gate, e.g. "Debian / Ubuntu". */
  source?: string;
};

type DownloadGateCtx = {
  openDownload: (request: DownloadRequest) => void;
};

const Ctx = createContext<DownloadGateCtx | null>(null);

/** Access the email-gate modal from any component. */
export function useDownloadGate() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useDownloadGate must be used inside <DownloadGateProvider>");
  }
  return ctx;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function LeadModal({
  request,
  onClose,
}: {
  request: DownloadRequest;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [formError, setFormError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Lock page scroll while the modal is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const triggerDownload = () => {
    if (request.external) {
      window.open(request.href, "_blank", "noopener,noreferrer");
      return;
    }
    const a = document.createElement("a");
    a.href = request.href;
    a.download = "";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const finish = () => {
    setStatus("done");
    // Let the success state read for a beat, then hand over the download.
    window.setTimeout(() => {
      triggerDownload();
      onClose();
    }, 750);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!EMAIL_RE.test(value)) {
      setFormError("Please enter a valid email address.");
      return;
    }
    setFormError(null);
    setStatus("sending");

    const payload = {
      email: value,
      os: request.os ?? detectPlatform(),
      source: request.source ?? "website",
      page: window.location.hash || "/",
      timestamp: new Date().toISOString(),
    };

    try {
      if (LEAD_SHEET_URL) {
        // Google Apps Script expects a plain-text body and allows CORS via
        // no-cors; the response is opaque, so a resolve is "sent".
        await fetch(LEAD_SHEET_URL, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(payload),
        });
      }
    } catch {
      /* Never block a download on lead-capture failure — proceed anyway. */
    }
    finish();
  };

  const headline = request.os
    ? `Get HostWise for ${request.os}.`
    : "Get HostWise.";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Enter your email to download HostWise"
      className="fixed inset-0 z-[60] flex items-center justify-center px-4"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-pointer bg-[#121212]/60 backdrop-blur-sm"
      />

      {/* Card */}
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="h-1.5 w-full bg-gradient-to-r from-accent to-[#7B39FC]" />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-[#191919]/50 transition-colors duration-200 hover:bg-gray-100 hover:text-[#191919]"
        >
          <X size={18} strokeWidth={2} aria-hidden="true" />
        </button>

        {status === "done" ? (
          <div className="px-7 py-10 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent">
              <Check size={26} strokeWidth={2.5} aria-hidden="true" />
            </span>
            <h2 className="mt-5 font-serif text-2xl font-normal tracking-tight text-[#191919]">
              You're in. Download starting…
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#191919]/60">
              Keep an eye on your downloads folder. We'll only email you the
              occasional update worth reading.
            </p>
          </div>
        ) : (
          <div className="px-7 py-8 sm:px-8">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <Mail size={20} strokeWidth={1.75} aria-hidden="true" />
            </span>
            <h2 className="mt-4 font-serif text-2xl font-normal tracking-tight text-[#191919]">
              {headline}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#191919]/60">
              One quick step: drop your email and we'll start your download
              right away — plus keep you posted on new features.
            </p>

            <form onSubmit={submit} className="mt-6" noValidate>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-[#191919]">
                  Email address
                </span>
                <input
                  ref={inputRef}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  disabled={status === "sending"}
                  autoComplete="email"
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-[#191919] placeholder:text-[#191919]/40 focus:border-accent/50 focus:outline-none disabled:opacity-60"
                />
              </label>

              {formError && (
                <p className="mt-2 text-sm text-red-600" role="alert">
                  {formError}
                </p>
              )}

              <button
                type="submit"
                disabled={status === "sending"}
                className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-[#191919] px-6 py-3 text-sm font-medium text-white transition-colors duration-200 hover:bg-[#191919]/90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {status === "sending" ? (
                  <>
                    <Loader2
                      size={15}
                      strokeWidth={2}
                      className="animate-spin"
                      aria-hidden="true"
                    />
                    Saving…
                  </>
                ) : (
                  "Download HostWise"
                )}
              </button>
            </form>

            <p className="mt-4 text-xs leading-relaxed text-[#191919]/45">
              No spam, ever. Your email is only used to send you the download
              link and product updates. Unsubscribe anytime.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function DownloadGateProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<DownloadRequest | null>(null);

  const openDownload = useCallback(
    (req: DownloadRequest) => setRequest(req),
    []
  );
  const close = useCallback(() => setRequest(null), []);

  const value = useMemo(() => ({ openDownload }), [openDownload]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {request && <LeadModal request={request} onClose={close} />}
    </Ctx.Provider>
  );
}
