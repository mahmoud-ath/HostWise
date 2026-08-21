import { ArrowRight } from "lucide-react";
import HostWiseVideoBg from "./HostWiseVideoBg";
import HeroPanel from "./HeroPanel";
import { navigateToSection } from "../lib/navigation";

/**
 * Full-viewport hero: boomerang property video as the environment, headline +
 * copy, two CTAs, and a product-intelligence panel anchored to the bottom.
 */
export default function Hero() {
  return (
    <section
      id="home"
      className="relative flex min-h-[100svh] flex-col items-center overflow-hidden"
    >
      <HostWiseVideoBg />

      <div className="relative z-10 flex w-full flex-col items-center px-4 pb-6 pt-20 text-center sm:px-6 sm:pb-8 sm:pt-24 md:pt-28">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#191919]/60">
          Stop managing
          blind
        </p>

        <h1 className="mt-4 font-serif text-4xl font-normal leading-[1.05] tracking-tighter text-[#191919] sm:text-5xl md:text-6xl lg:text-7xl">
          Know your numbers.
          <br />
          Grow your properties.
        </h1>

        <div className="mt-6 flex flex-col items-center gap-3 sm:mt-6 sm:flex-row md:mt-7">
          <button
            type="button"
            onClick={() => navigateToSection("product")}
            className="group inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#191919] px-6 py-3 text-sm font-medium text-white transition-colors duration-200 hover:bg-[#191919]/90 sm:px-8 sm:py-3.5"
          >
            Explore HostWise
            <ArrowRight
              size={16}
              strokeWidth={2}
              className="transition-transform duration-200 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </button>
          <button
            type="button"
            onClick={() => navigateToSection("features")}
            className="rounded-full border border-[#191919]/15 bg-white/80 px-6 py-3 text-sm font-medium text-[#191919] backdrop-blur-sm transition-colors duration-200 hover:bg-white sm:px-8 sm:py-3.5"
          >
            See features
          </button>
        </div>
      </div>

      <HeroPanel />
    </section>
  );
}
