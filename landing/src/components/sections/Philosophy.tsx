import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Highlight from "../Highlight";

gsap.registerPlugin(ScrollTrigger);

const STATEMENT =
  "We believe your financial data belongs to you, not to the cloud. " +
  "HostWise is built on local-first principles: your books stay on your " +
  "device, work offline, and sync only when you choose. We build tools " +
  "that respect your privacy and give you real clarity over what your " +
  "properties are actually making.";

const WORDS = STATEMENT.split(" ");

/**
 * A scroll-driven manifesto: each word fades from muted to full ink as you
 * scroll, then settles. Honors prefers-reduced-motion by showing the text
 * fully visible instead of animating.
 */
export default function Philosophy() {
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const spans = el.querySelectorAll<HTMLElement>(".word");

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(spans, { color: "#191919" });
      return;
    }

    const ctx = gsap.context(() => {
      gsap.to(spans, {
        color: "#191919",
        stagger: 0.05,
        ease: "none",
        scrollTrigger: {
          trigger: el,
          start: "top 75%",
          end: "bottom 55%",
          scrub: 1,
        },
      });
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <section
      className="border-t border-gray-200 px-6 py-24 md:px-24 md:py-40"
    >
      <div className="mx-auto flex max-w-5xl flex-col items-center text-center ">
        <Highlight><span className="mb-10 text-xs font-medium uppercase tracking-widest text-[#191919]/40">
          Our philosophy
        </span></Highlight>
        <p
          ref={ref}
          className="flex w-full flex-wrap justify-center gap-x-3 gap-y-2 font-serif text-3xl leading-snug text-[#191919] md:text-5xl md:gap-y-4"
        >
          {WORDS.map((word, i) => (
            <span
              key={i}
              className="word text-[#191919]/[0.08] transition-colors duration-300"
            >
              {word}&nbsp;
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}
