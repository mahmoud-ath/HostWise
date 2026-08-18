import { HeroVideo } from "./HeroVideo";
import { AnnouncementBadge } from "./AnnouncementBadge";
import { LINKS } from "@/lib/links";

/**
 * Cinematic full-viewport hero. Content is centered (flex), sits above the
 * video (z-10), and is capped at 1000px so it never stretches on ultrawide.
 * Hero stack is exactly 4 elements: announcement pill, headline, subtext,
 * CTAs.
 */
export function Hero() {
  return (
    <section
      id="home"
      className="relative flex min-h-[100svh] items-center justify-center overflow-hidden"
    >
      <HeroVideo />

      <div className="relative z-10 mx-auto flex w-full max-w-[1000px] flex-col items-center px-6 pb-16 pt-20 text-center">
        <div className="animate-fade-up">
          <AnnouncementBadge />
        </div>

        <h1
          className="animate-fade-up mt-7 max-w-[1000px] font-serif text-[clamp(2.75rem,7vw,6rem)] leading-[1.08] tracking-[-0.01em] text-white"
          style={{ animationDelay: "80ms" }}
        >
          Run your vacation rental business{" "}
          <em className="inline-block pb-[0.06em] italic">smarter</em>.
        </h1>

        <p
          className="animate-fade-up mt-6 max-w-[680px] font-sans text-base leading-relaxed text-white/80 md:text-lg"
          style={{ animationDelay: "160ms" }}
        >
          Track revenue, expenses, reservations, profitability, and property
          performance in one powerful desktop app, with your data staying under
          your control.
        </p>

        <div
          className="animate-fade-up mt-9 flex w-full flex-col items-center justify-center gap-3.5 sm:w-auto sm:flex-row"
          style={{ animationDelay: "240ms" }}
        >
          <a
            href={LINKS.download}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-2 rounded-[10px] bg-primary px-8 py-4 font-cabin text-base font-medium text-white shadow-[0_18px_40px_-16px_rgba(123,57,252,0.85)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#8c4cff] active:translate-y-0 active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:w-auto"
          >
            Get HostWise
          </a>
          <a
            href="#how-it-works"
            className="inline-flex w-full items-center justify-center gap-2 rounded-[10px] border border-white/15 bg-[#2B2344] px-8 py-4 font-cabin text-base font-medium text-[#F6F7F9] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#372b57] active:translate-y-0 active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:w-auto"
          >
            See How It Works
          </a>
        </div>
      </div>
    </section>
  );
}
