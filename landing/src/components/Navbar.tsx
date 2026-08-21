import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ArrowRight, Menu, X } from "lucide-react";
import HostWiseLogo from "./HostWiseLogo";
import { LINKS } from "../lib/links";
import { navigateToSection } from "../lib/navigation";

const DESKTOP_LINKS = [
  { label: "Product", id: "product" },
  { label: "Features", id: "features" },
  { label: "FAQ", id: "faq" },
] as const;

const DESKTOP_PAGES = [
  { label: "Guide", href: "#/docs" },
  { label: "Feedback", href: "#/feedback" },
] as const;

const MOBILE_SECTIONS = [
  { label: "Product", id: "product" },
  { label: "Download", id: "download" },
  { label: "Features", id: "features" },
  { label: "FAQ", id: "faq" },
] as const;

const MOBILE_PAGES = [
  { label: "Guide", href: "#/docs" },
  { label: "Feedback", href: "#/feedback" },
] as const;

/**
 * Floating rounded pill header with a frosted background, adapted for the
 * HostWise light theme. On load it animates in (width grow + staggered fade),
 * section links smooth-scroll via GSAP ScrollToPlugin, and a full-screen
 * animated mobile menu handles small screens. Honors prefers-reduced-motion.
 */
export default function Navbar() {
  const headerRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLAnchorElement>(null);
  const navItemsRef = useRef<(HTMLLIElement | null)[]>([]);
  const iconsRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const mobileLinksRef = useRef<(HTMLElement | null)[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const reduceMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Entrance animation (width grow + staggered fade-in), desktop vs mobile.
  useEffect(() => {
    const header = headerRef.current;
    const logo = logoRef.current;
    const icons = iconsRef.current;
    if (!header || !logo || !icons || reduceMotion()) return;

    const mm = gsap.matchMedia();
    mm.add(
      {
        isMobile: "(max-width: 767px)",
        isDesktop: "(min-width: 768px)",
      },
      (context) => {
        const isMobile = context.conditions?.isMobile ?? false;
        const navItems = navItemsRef.current.filter(
          (el): el is HTMLLIElement => el !== null
        );

        gsap.set(header, { width: "0px", opacity: 0, overflow: "hidden" });
        gsap.set(logo, { autoAlpha: 0, y: 15, scale: 0.95 });
        gsap.set(icons, { autoAlpha: 0, x: 10 });
        if (!isMobile) gsap.set(navItems, { autoAlpha: 0, y: 15 });

        const tl = gsap.timeline({ delay: 0.15 });
        tl.to(header, {
          width: isMobile ? "calc(100% - 2rem)" : "100%",
          maxWidth: "896px",
          opacity: 1,
          duration: 1.1,
          ease: "expo.inOut",
        }).to(
          logo,
          { autoAlpha: 1, y: 0, scale: 1, duration: 1.1, ease: "expo.out" },
          "-=0.2"
        );

        if (!isMobile) {
          tl.to(
            navItems,
            { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.08, ease: "power3.out" },
            "-=0.5"
          );
        }

        tl.to(icons, { autoAlpha: 1, x: 0, duration: 0.5, ease: "power2.out" }, "-=0.5");

        return () => {
          tl.kill();
        };
      }
    );

    return () => mm.revert();
  }, []);

  // Initialize the mobile menu to its closed state.
  useEffect(() => {
    const menu = mobileMenuRef.current;
    if (!menu || reduceMotion()) return;
    gsap.set(menu, { clipPath: "inset(0% 100% 0% 0%)", autoAlpha: 0 });
  }, []);

  const toggleMenu = () => {
    const menu = mobileMenuRef.current;
    if (!menu) return;

    if (reduceMotion()) {
      setIsOpen((o) => !o);
      return;
    }

    if (!isOpen) {
      setIsOpen(true);
      gsap.set(menu, { visibility: "visible", pointerEvents: "auto" });
      const links = mobileLinksRef.current.filter(
        (el): el is HTMLElement => el !== null
      );
      const tl = gsap.timeline();
      tl.to(menu, {
        autoAlpha: 1,
        clipPath: "inset(0% 0% 0% 0%)",
        duration: 0.7,
        ease: "power2.inOut",
      }).fromTo(
        links,
        { y: 24, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.7, stagger: 0.08, ease: "power2.out" },
        "-=0.35"
      );
    } else {
      setIsOpen(false);
      gsap.to(menu, {
        autoAlpha: 0,
        clipPath: "inset(0% 100% 0% 0%)",
        duration: 0.5,
        ease: "power2.inOut",
      });
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") toggleMenu();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  const goSection = (id: string) => {
    if (isOpen) toggleMenu();
    navigateToSection(id);
  };

  const goToDownload = () => navigateToSection("download");


  return (
    <>
      <div
        ref={headerRef}
        className="fixed top-4 left-1/2 z-50 h-[60px] w-[calc(100%-2rem)] max-w-[896px] -translate-x-1/2 whitespace-nowrap rounded-full border border-gray-200/80 bg-white/80 pl-5 pr-2 shadow-lg shadow-gray-900/5 backdrop-blur-xl"
      >
        <div className="flex h-full items-center justify-between">
          <a
            ref={logoRef}
            href="#/"
            className="flex flex-shrink-0 items-center gap-2.5"
            aria-label="HostWise home"
          >
            <HostWiseLogo size={28} />
            <span className="text-base font-semibold tracking-tight text-[#191919]">
              HostWise
            </span>
          </a>

          <div className="absolute left-1/2 hidden -translate-x-1/2 md:block">
            <ul className="flex items-center gap-1 text-sm font-medium">
              {DESKTOP_LINKS.map((link, i) => (
                <li key={link.label} ref={(el) => (navItemsRef.current[i] = el)}>
                  <button
                    type="button"
                    onClick={() => goSection(link.id)}
                    className="cursor-pointer rounded-full px-3.5 py-2 text-[#191919]/70 transition-colors duration-200 hover:bg-gray-100 hover:text-[#191919]"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
              {DESKTOP_PAGES.map((link, i) => (
                <li
                  key={link.href}
                  ref={(el) =>
                    (navItemsRef.current[DESKTOP_LINKS.length + i] = el)
                  }
                >
                  <a
                    href={link.href}
                    className="block rounded-full px-3.5 py-2 text-[#191919]/70 transition-colors duration-200 hover:bg-gray-100 hover:text-[#191919]"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div ref={iconsRef} className="flex items-center gap-2">
            <button
              type="button"
              onClick={goToDownload}
              className="hidden cursor-pointer rounded-full bg-[#191919] px-5 py-2.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-[#191919]/90 md:inline-flex"
            >
              Get HostWise
            </button>
            <button
              type="button"
              onClick={toggleMenu}
              aria-label={isOpen ? "Close menu" : "Open menu"}
              aria-expanded={isOpen}
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-[#191919]/80 transition-colors duration-200 hover:bg-gray-100 hover:text-[#191919] md:hidden"
            >
              {isOpen ? (
                <X size={20} strokeWidth={2} aria-hidden="true" />
              ) : (
                <Menu size={20} strokeWidth={2} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Full-screen mobile menu overlay */}
      <div
        ref={mobileMenuRef}
        className={`fixed inset-0 z-40 flex flex-col justify-center overflow-hidden bg-white/90 px-10 backdrop-blur-2xl transition-opacity duration-300 ${
          isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!isOpen}
      >
        <ul className="flex flex-col space-y-8">
          {MOBILE_SECTIONS.map((link, i) => (
            <li key={link.label} className="overflow-hidden">
              <button
                ref={(el) => (mobileLinksRef.current[i] = el)}
                type="button"
                onClick={() => goSection(link.id)}
                className="block cursor-pointer font-serif text-4xl font-normal tracking-tight text-[#191919]/80 transition-colors duration-200 hover:text-[#191919]"
              >
                {link.label}
              </button>
            </li>
          ))}
          {MOBILE_PAGES.map((link, i) => (
            <li key={link.href} className="overflow-hidden">
              <a
                ref={(el) =>
                  (mobileLinksRef.current[MOBILE_SECTIONS.length + i] = el)
                }
                href={link.href}
                onClick={() => {
                  if (isOpen) toggleMenu();
                }}
                className="block font-serif text-4xl font-normal tracking-tight text-[#191919]/80 transition-colors duration-200 hover:text-[#191919]"
              >
                {link.label}
              </a>
            </li>
          ))}
          <li className="overflow-hidden border-t border-gray-200 pt-6">
            <button
              ref={(el) =>
                (mobileLinksRef.current[
                  MOBILE_SECTIONS.length + MOBILE_PAGES.length
                ] = el)
              }
              type="button"
              onClick={goToDownload}
              className="inline-flex cursor-pointer items-center gap-2 text-xl font-medium text-[#191919] transition-colors duration-200 hover:text-accent"
            >
              Get HostWise
              <ArrowRight size={18} strokeWidth={2} aria-hidden="true" />
            </button>
          </li>
        </ul>

        <div className="absolute bottom-10 left-10 flex gap-6 text-xs font-medium uppercase tracking-widest text-[#191919]/40">
          <a
            href={LINKS.repo}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors duration-200 hover:text-[#191919]"
          >
            GitHub
          </a>
          <a
            href={LINKS.email}
            className="transition-colors duration-200 hover:text-[#191919]"
          >
            Email
          </a>
        </div>
      </div>
    </>
  );
}
