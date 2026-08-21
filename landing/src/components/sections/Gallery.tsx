import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const SCREENSHOTS = [
  {
    src: "/screenshots/overview_image.jpeg",
    title: "HOSTWISE",
    desc: "Own your data. Know your numbers. Grow your portfolio.",
  },
  {
    src: "/screenshots/01_dashboard.webp",
    title: "Dashboard",
    desc: "Revenue, expenses, cashflow, and AI insights on one screen.",
  },
  {
    src: "/screenshots/02_Properties.webp",
    title: "Properties",
    desc: "Manage listings and track per-property health scores.",
  },
  {
    src: "/screenshots/03_Properties_modal.webp",
    title: "Property analytics",
    desc: "Monthly revenue and expenses for a single property.",
  },
  {
    src: "/screenshots/05_Finance.webp",
    title: "Finance",
    desc: "Categorized revenue and expenses, per property.",
  },
  {
    src: "/screenshots/06_Analytics.webp",
    title: "Analytics",
    desc: "Trends, seasonality, and the why behind the numbers.",
  },
  {
    src: "/screenshots/08_AI_Advisor.webp",
    title: "AI Advisor",
    desc: "Insights, risks, and what-if scenarios from your data.",
  },
  {
    src: "/screenshots/09_Reports.webp",
    title: "Reports",
    desc: "PDF executive summaries, ready to share.",
  },
  {
    src: "/screenshots/14_settings.webp",
    title: "Settings",
    desc: "Business, AI, appearance, backups, and more.",
  },
  {
    src: "/screenshots/17_dashboard_dark_mode.webp",
    title: "Dark mode",
    desc: "The same dashboard, comfortable at night.",
  },
];

/**
 * Horizontal snap-scroll screenshot gallery with a lightbox, adapted for the
 * HostWise light theme. Only lucide icons are used; motion is a light GSAP
 * entrance that respects prefers-reduced-motion.
 */
export default function Gallery() {
  const trackRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [selected, setSelected] = useState<number | null>(null);

  const scroll = (direction: "left" | "right") => {
    const el = trackRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.8;
    el.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.from(".gallery-item", {
        x: 60,
        opacity: 0,
        duration: 0.8,
        stagger: 0.08,
        ease: "power2.out",
        scrollTrigger: { trigger: section, start: "top 80%" },
      });
    }, section);
    return () => ctx.revert();
  }, []);

  useEffect(() => {
    if (selected === null) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
      if (e.key === "ArrowRight")
        setSelected((s) =>
          s === null ? s : (s + 1) % SCREENSHOTS.length
        );
      if (e.key === "ArrowLeft")
        setSelected((s) =>
          s === null ? s : (s - 1 + SCREENSHOTS.length) % SCREENSHOTS.length
        );
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [selected]);

  const open = (i: number) => setSelected(i);
  const step = (dir: 1 | -1) =>
    setSelected((s) =>
      s === null ? s : (s + dir + SCREENSHOTS.length) % SCREENSHOTS.length
    );

  return (
    <section
      id="product"
      ref={sectionRef}
      className="scroll-mt-24 px-6 py-20 sm:py-24 lg:px-14 lg:py-28"
    >
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-12 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="text-xs font-medium uppercase tracking-[0.3em] text-accent">
              Visual interface
            </span>
            <h2 className="mt-3 font-serif text-4xl font-normal tracking-tight text-[#191919] md:text-5xl">
              Experience HostWise.
            </h2>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => scroll("left")}
              aria-label="Previous screenshot"
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-gray-200 text-[#191919] transition-colors duration-200 hover:border-accent/50 hover:bg-soft"
            >
              <ChevronLeft size={20} strokeWidth={2} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => scroll("right")}
              aria-label="Next screenshot"
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-gray-200 text-[#191919] transition-colors duration-200 hover:border-accent/50 hover:bg-soft"
            >
              <ChevronRight size={20} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div
          ref={trackRef}
          className="scrollbar-hide flex snap-x snap-mandatory gap-6 overflow-x-auto px-1 pb-12"
        >
          {SCREENSHOTS.map((shot, i) => (
            <div
              key={shot.title}
              onClick={() => open(i)}
              onKeyDown={(e) => e.key === "Enter" && open(i)}
              role="button"
              tabIndex={0}
              aria-label={`View ${shot.title} screenshot`}
              className="gallery-item group w-[85vw] flex-shrink-0 cursor-pointer snap-center md:w-[60vw] lg:w-[45vw]"
            >
              <div className="relative aspect-video overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-xl shadow-gray-900/5 transition-transform duration-500 group-hover:scale-[1.02]">
                <img
                  src={shot.src}
                  alt={`${shot.title} - HostWise`}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 z-10 bg-gradient-to-t from-white via-white/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <div className="absolute bottom-0 left-0 right-0 z-20 translate-y-4 p-6 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                  <h3 className="font-serif text-xl text-[#191919]">
                    {shot.title}
                  </h3>
                  <p className="mt-1 max-w-sm text-sm text-[#191919]/60">
                    {shot.desc}
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-accent">
                    <Maximize2 size={14} strokeWidth={2} aria-hidden="true" />
                    Full view
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selected !== null && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#191919]/90 p-6 backdrop-blur-xl md:p-20"
          onClick={() => setSelected(null)}
        >
          <button
            type="button"
            onClick={() => setSelected(null)}
            aria-label="Close"
            className="absolute right-8 top-8 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white transition-colors duration-200 hover:bg-white/20"
          >
            <X size={22} strokeWidth={2} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              step(-1);
            }}
            aria-label="Previous screenshot"
            className="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white transition-colors duration-200 hover:bg-white/20 md:left-8"
          >
            <ChevronLeft size={22} strokeWidth={2} aria-hidden="true" />
          </button>

          <div
            className="relative w-full max-w-6xl"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={SCREENSHOTS[selected].src}
              alt={SCREENSHOTS[selected].title}
              className="h-auto max-h-full w-full rounded-3xl border border-white/10 shadow-2xl"
            />
            <div className="mt-5 text-center">
              <h3 className="font-serif text-2xl text-white">
                {SCREENSHOTS[selected].title}
              </h3>
              <p className="mt-1 text-white/50">
                {SCREENSHOTS[selected].desc}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              step(1);
            }}
            aria-label="Next screenshot"
            className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white transition-colors duration-200 hover:bg-white/20 md:right-8"
          >
            <ChevronRight size={22} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      )}
    </section>
  );
}
