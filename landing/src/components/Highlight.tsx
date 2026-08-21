import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Highlighter-mark text: a soft yellow marker draws in behind the words as
 * they scroll into view. Honors prefers-reduced-motion by showing the mark
 * fully highlighted with no animation.
 */
export default function Highlight({ children }: { children: React.ReactNode }) {
  const markRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const mark = markRef.current;
    if (!mark) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        mark,
        { scaleX: 0 },
        {
          scaleX: 1,
          duration: 0.9,
          ease: "power3.inOut",
          scrollTrigger: { trigger: mark, start: "top 85%" },
        }
      );
    }, mark);

    return () => ctx.revert();
  }, []);

  return (
    <span className="relative -mx-1 inline-block px-1.5">
      <span
        ref={markRef}
        aria-hidden="true"
        className="absolute inset-0 origin-left rounded-[0.2em] bg-[#FDE68A]"
      />
      <span className="relative">{children}</span>
    </span>
  );
}
