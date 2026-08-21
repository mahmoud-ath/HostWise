  import { useEffect, useRef } from "react";
  import gsap from "gsap";
  import {
    ArrowUpRight,
    Boxes,
    Database,
    LayoutDashboard,
    WifiOff,
  } from "lucide-react";

  const STATS = [
    {
      icon: LayoutDashboard,
      value: "01",
      label: "Workspace",
      description: "Everything in one place",
    },
    {
      icon: WifiOff,
      value: "100%",
      label: "Offline",
      description: "Always ready to work",
    },
    {
      icon: Boxes,
      value: "06+",
      label: "Core modules",
      description: "Built into HostWise",
    },
    {
      icon: Database,
      value: "LOCAL",
      label: "Database",
      description: "Your data stays yours",
    },
  ] as const;

  export default function HeroPanel() {
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const panel = panelRef.current;
      if (!panel) return;

      if (
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        return;
      }

      const ctx = gsap.context(() => {
        gsap.from(panel, {
          y: 40,
          opacity: 0,
          duration: 0.85,
          ease: "power3.out",
          delay: 0.3,
          clearProps: "transform,opacity",
        });

        gsap.from(".hero-stat", {
          y: 14,
          opacity: 0,
          stagger: 0.07,
          duration: 0.55,
          ease: "power2.out",
          delay: 0.65,
          clearProps: "transform,opacity",
        });
      }, panel);

      return () => ctx.revert();
    }, []);

    return (
      <div
        ref={panelRef}
        className="mt-auto w-full max-w-6xl px-4 sm:px-6"
      >
        <div
          className="
            overflow-hidden
            border
            border-gray-200
            border-b-0
            bg-white/90
            shadow-sm
            backdrop-blur-md
          "
        >
          {/* ───────────────── Header ───────────────── */}
          <div
            className="
              grid
              gap-6
              px-6
              pb-6
              pt-7
              sm:px-8
              sm:pb-7
              sm:pt-8
              md:grid-cols-[1.05fr_0.95fr]
              md:gap-12
              md:px-12
              md:pb-8
              md:pt-9
            "
          >
            {/* Heading */}
            <div>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#191919]/50" />

                <p
                  className="
                    text-[10px]
                    font-medium
                    uppercase
                    tracking-[0.22em]
                    text-[#191919]/50
                  "
                >
                  What is HostWise?
                </p>
              </div>

              <h2
                className="
                  mt-3
                  max-w-xl
                  font-serif
                  text-[1.7rem]
                  font-normal
                  leading-[1.05]
                  tracking-[-0.025em]
                  text-[#191919]
                  sm:text-[2rem]
                  md:text-[2.3rem]
                "
              >
                One place to run
                <br />
                your properties.
              </h2>
            </div>

            {/* Description */}
            <div className="flex items-end">
              <p
                className="
                  max-w-md
                  text-[14px]
                  leading-[1.7]
                  text-[#191919]/60
                  sm:text-[15px]
                "
              >
                Bookings, expenses, guests, occupancy, and profit —
                organized in one private workspace that stays with you,
                even when you're offline.
              </p>
            </div>
          </div>

          {/* ───────────────── Divider ───────────────── */}
          <div className="mx-6 h-px bg-gray-200 sm:mx-8 md:mx-12" />

          {/* ───────────────── Stats ───────────────── */}
          <div
            className="
              grid
              grid-cols-2
              sm:grid-cols-4
            "
          >
            {STATS.map((stat, index) => {
              const Icon = stat.icon;

              return (
                <div
                  key={stat.label}
                  className={`
                    hero-stat
                    group
                    relative
                    min-w-0
                    cursor-pointer
                    px-5
                    py-3.5
                    transition-colors
                    duration-300
                    hover:bg-[#f7f7f7]
                    sm:px-6
                    sm:py-4
                    md:px-8
                  `}
                >
                  {/* Vertical separator */}
                  {index > 0 && (
                    <div
                      className="
                        absolute
                        left-0
                        top-5
                        hidden
                        h-[calc(100%-2.5rem)]
                        w-px
                        bg-gray-200
                        sm:block
                      "
                    />
                  )}

                  {/* Top line */}
                  <div className="flex items-center justify-between">
                    <div
                      className="
                        flex
                        h-8
                        w-8
                        items-center
                        justify-center
                        rounded-md
                        border
                        border-gray-200
                        bg-white
                        text-[#191919]/70
                        transition-transform
                        duration-300
                        group-hover:-translate-y-0.5
                      "
                    >
                      <Icon
                        size={15}
                        strokeWidth={1.7}
                        aria-hidden="true"
                      />
                    </div>

                    <ArrowUpRight
                      className="
                        h-4
                        w-4
                        text-[#191919]/25
                        transition-all
                        duration-300
                        group-hover:-translate-y-0.5
                        group-hover:translate-x-0.5
                        group-hover:text-[#191919]/70
                      "
                      strokeWidth={1.5}
                      aria-hidden="true"
                    />
                  </div>

                  {/* Value */}
                  <div className="mt-4">
                    <span
                      className="
                        block
                        text-[1.25rem]
                        font-medium
                        leading-none
                        tracking-[-0.03em]
                        text-[#191919]
                        sm:text-[1.4rem]
                      "
                    >
                      {stat.value}
                    </span>

                    <span
                      className="
                        mt-2
                        block
                        truncate
                        text-[12px]
                        font-medium
                        text-[#191919]/75
                      "
                    >
                      {stat.label}
                    </span>

                    <span
                      className="
                        mt-1
                        block
                        truncate
                        text-[11px]
                        leading-relaxed
                        text-[#191919]/40
                      "
                    >
                      {stat.description}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }