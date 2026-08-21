import { useState } from "react";
import { ArrowLeft, ArrowUpRight, Send } from "lucide-react";
import { LINKS } from "../lib/links";

const FEEDBACK_TYPES = [
  "General feedback",
  "Bug report",
  "Feature request",
  "Suggestion",
] as const;

export default function Feedback() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [type, setType] = useState<string>(FEEDBACK_TYPES[0]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      setError("Please write a short message before sending.");
      return;
    }
    setError(null);
    const subject = `[${type}] ${name ? name : "HostWise feedback"}`;
    const body = `${message.trim()}\n\n---\nName: ${name.trim() || "-"}\nEmail: ${email.trim() || "-"}`;
    window.location.href = `mailto:${LINKS.email}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
  };

  const inputClasses =
    "w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-[#191919] placeholder:text-[#191919]/40 focus:border-[#191919]/40 focus:outline-none transition-colors duration-200";

  return (
    <main className="px-6 pb-24 pt-28 sm:px-10 md:px-14 md:pt-36">
      <div className="mx-auto max-w-7xl">
        <a
          href="#/"
          className="inline-flex items-center gap-1.5 text-sm text-[#191919]/60 transition-colors duration-200 hover:text-[#191919]"
        >
          <ArrowLeft size={16} strokeWidth={2} aria-hidden="true" />
          Back to home
        </a>

        <div className="mt-6 max-w-2xl">
          <h1 className="font-serif text-4xl font-normal tracking-tight text-[#191919] md:text-5xl">
            Feedback.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-[#191919]/70">
            We build HostWise for hosts. Tell us what is working, what is not,
            and what you need next.
          </p>
        </div>

        <div className="mt-14 grid gap-10 lg:grid-cols-[1fr_360px]">
          <form
            onSubmit={submit}
            className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8"
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-[#191919]">
                  Name <span className="text-[#191919]/40">(optional)</span>
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className={inputClasses}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-[#191919]">
                  Email <span className="text-[#191919]/40">(optional)</span>
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputClasses}
                />
              </label>
            </div>

            <label className="mt-5 block">
              <span className="mb-1.5 block text-sm font-medium text-[#191919]">
                Type
              </span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className={inputClasses}
              >
                {FEEDBACK_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-5 block">
              <span className="mb-1.5 block text-sm font-medium text-[#191919]">
                Message
              </span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                placeholder="What is on your mind?"
                className={`${inputClasses} resize-y`}
              />
            </label>

            {error && (
              <p className="mt-3 text-sm text-[#191919]/70" role="alert">
                {error}
              </p>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-[#191919]/50">
                Submitting opens your email app with the message prefilled. No
                data leaves your machine until you hit send.
              </p>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#191919] px-6 py-3 text-sm font-medium text-white transition-colors duration-200 hover:bg-[#191919]/90"
              >
                <Send size={15} strokeWidth={2} aria-hidden="true" />
                Send feedback
              </button>
            </div>
          </form>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <h2 className="font-serif text-xl font-normal tracking-tight text-[#191919]">
                Prefer GitHub?
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[#191919]/70">
                Bugs and feature requests are tracked publicly. Search first,
                then open an issue.
              </p>
              <a
                href={LINKS.issues}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent transition-colors duration-200 hover:underline"
              >
                Open an issue on GitHub
                <ArrowUpRight size={15} strokeWidth={2} aria-hidden="true" />
              </a>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-soft p-6">
              <h2 className="font-serif text-xl font-normal tracking-tight text-[#191919]">
                Inside the app
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[#191919]/70">
                HostWise includes a Feedback item in the sidebar that opens the
                same channel from the app, with no setup required.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
