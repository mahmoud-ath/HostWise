import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Check,
  CircleCheck,
  CircleX,
  KeyRound,
  Loader2,
  Mail,
  X,
} from "lucide-react";
import { LEAD_SHEET_URL } from "./constants";
import { detectPlatform } from "./downloads";
import { validateLicenseKey } from "./licenseKeys";

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

/**
 * Save a lead to the Google Sheet via the Apps Script web app. This is the
 * single lead-capture path used by the download gate AND the footer subscribe
 * form. Never throws — the caller decides how to present the result.
 */
export async function submitLead(payload: {
  email: string;
  os?: string;
  source?: string;
  page?: string;
  timestamp?: string;
  /** License key typed in the download gate ("" for the footer subscribe form). */
  key?: string;
  /** Whether the key matched the approved list. */
  keyValid?: boolean;
}): Promise<void> {
  try {
    if (!LEAD_SHEET_URL) return;
    // Google Apps Script expects a plain-text body and allows CORS via no-cors;
    // the response is opaque, so a resolve means "sent".
    await fetch(LEAD_SHEET_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        email: payload.email,
        os: payload.os ?? detectPlatform(),
        source: payload.source ?? "website",
        page:
          payload.page ??
          (typeof window !== "undefined" ? window.location.hash || "/" : "/"),
        timestamp: payload.timestamp ?? new Date().toISOString(),
        key: payload.key ?? "",
        keyValid: payload.keyValid ?? false,
      }),
    });
  } catch {
    /* Never block on lead-capture failure. */
  }
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
  const [licenseKey, setLicenseKey] = useState("");
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
    const emailValue = email.trim().toLowerCase();
    const badEmail = !EMAIL_RE.test(emailValue);
    const keyValid = validateLicenseKey(licenseKey);

    if (badEmail) {
      setFormError("Please enter a valid email address.");
      return;
    }

    // Log the attempt whether the key is right or wrong, so you can see who
    // tried to download and with what key. This never blocks on failures.
    setStatus("sending");
    await submitLead({
      email: emailValue,
      os: request.os,
      source: request.source,
      page: window.location.hash || "/",
      key: licenseKey.trim(),
      keyValid,
    });

    // Invalid key → block the download and keep the modal open.
    if (!keyValid) {
      setStatus("idle");
      setFormError(
        "That license key doesn't look right. Double-check it and try again — or email support@hostwise.app if you don't have one."
      );
      return;
    }

    setFormError(null);
    finish();
  };

  const headline = request.os
    ? `Get HostWise for ${request.os}.`
    : "Get HostWise.";

  // Live inline validity for the two fields (shown as a check / X icon).
  const emailLooksValid = EMAIL_RE.test(email.trim().toLowerCase());
  const keyLooksValid = validateLicenseKey(licenseKey);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Enter your email and license key to download HostWise"
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
              Enter your email and the license key we sent you, and your
              download will start right away.
            </p>

            <form onSubmit={submit} className="mt-6" noValidate>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-[#191919]">
                  Email address
                </span>
                <span className="relative block">
                  <input
                    ref={inputRef}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    disabled={status === "sending"}
                    autoComplete="email"
                    aria-invalid={email.trim() !== "" && !emailLooksValid}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 pr-10 text-sm text-[#191919] placeholder:text-[#191919]/40 focus:border-accent/50 focus:outline-none disabled:opacity-60"
                  />
                  {email.trim() !== "" && (
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none absolute inset-y-0 right-3 flex items-center ${
                        emailLooksValid ? "text-emerald-500" : "text-red-500"
                      }`}
                    >
                      {emailLooksValid ? (
                        <CircleCheck size={18} strokeWidth={2} />
                      ) : (
                        <CircleX size={18} strokeWidth={2} />
                      )}
                    </span>
                  )}
                </span>
              </label>

              <label className="mt-4 block">
                <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-[#191919]">
                  <KeyRound size={14} strokeWidth={2} aria-hidden="true" />
                  License key
                </span>
                <span className="relative block">
                  <input
                    type="text"
                    value={licenseKey}
                    onChange={(e) => setLicenseKey(e.target.value)}
                    placeholder="XXXX-XXXX-XXXX-XXXX"
                    disabled={status === "sending"}
                    autoComplete="off"
                    spellCheck={false}
                    aria-invalid={licenseKey.trim() !== "" && !keyLooksValid}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 pr-10 text-sm text-[#191919] placeholder:text-[#191919]/40 focus:border-accent/50 focus:outline-none disabled:opacity-60"
                  />
                  {licenseKey.trim() !== "" && (
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none absolute inset-y-0 right-3 flex items-center ${
                        keyLooksValid ? "text-emerald-500" : "text-red-500"
                      }`}
                    >
                      {keyLooksValid ? (
                        <CircleCheck size={18} strokeWidth={2} />
                      ) : (
                        <CircleX size={18} strokeWidth={2} />
                      )}
                    </span>
                  )}
                </span>
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
              Don't have a license key? Email{" "}
              <a
                href="mailto:support@hostwise.app"
                className="font-medium text-[#191919]/60 underline underline-offset-2"
              >
                support@hostwise.app
              </a>
              . Your email is only used for the download link and product
              updates.
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
