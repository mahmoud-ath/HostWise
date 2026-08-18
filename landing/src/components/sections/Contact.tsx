import { ArrowUpRight, Mail } from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { LINKS } from "@/lib/links";

/**
 * #contact anchor. Contact intent only: email + issue tracker. This is the
 * only place on the page with "contact" intent (the hero uses the separate
 * "download" intent).
 */
export function Contact() {
  return (
    <section
      id="contact"
      className="relative scroll-mt-24 border-t border-white/10 px-6 py-24 lg:px-[120px] lg:py-32"
    >
      <div className="mx-auto max-w-[760px] text-center">
        <Reveal>
          <h2 className="font-serif text-4xl leading-[1.1] text-white md:text-5xl">
            Questions or feedback?
          </h2>
          <p className="mx-auto mt-4 max-w-[520px] font-sans text-lg leading-relaxed text-white/75">
            We build HostWise for hosts. Reach out any time.
          </p>
        </Reveal>

        <Reveal delay={120} className="mt-9">
          <div className="flex flex-col items-center justify-center gap-3.5 sm:flex-row">
            <a
              href={LINKS.email}
              className="inline-flex w-full items-center justify-center gap-2 rounded-[10px] bg-primary px-7 py-3.5 font-cabin text-base font-medium text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#8c4cff] active:translate-y-0 active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:w-auto"
            >
              <Mail size={18} strokeWidth={1.75} aria-hidden="true" />
              Email support
            </a>
            <a
              href={LINKS.issues}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-[10px] border border-white/15 bg-[#2B2344] px-7 py-3.5 font-cabin text-base font-medium text-[#F6F7F9] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#372b57] active:translate-y-0 active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:w-auto"
            >
              Open an issue
              <ArrowUpRight size={18} strokeWidth={1.75} aria-hidden="true" />
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
