"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Logo } from "./Logo";
import { LINKS, NAV_ITEMS } from "@/lib/links";

/**
 * Transparent navbar floating above the hero video. Desktop: horizontal nav +
 * actions. Mobile: white hamburger that opens a full-screen, keyboard
 * accessible menu (Escape closes, focus moves to the close button, body
 * scroll is locked while open).
 */
export function Navbar() {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const navLinkClasses =
    "font-manrope text-sm font-medium text-white/85 transition-opacity duration-200 hover:opacity-60 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white";
  const signInClasses =
    "rounded-lg border border-[#D4D4D4] bg-white px-5 py-2 font-manrope text-sm font-semibold text-[#171717] transition-colors duration-200 hover:bg-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";
  const getStartedClasses =
    "rounded-lg bg-primary px-5 py-2 font-manrope text-sm font-semibold text-white shadow-[0_8px_24px_-10px_rgba(123,57,252,0.8)] transition-colors duration-200 hover:bg-[#8c4cff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

  return (
    <header className="absolute inset-x-0 top-0 z-20">
      <nav
        aria-label="Main"
        className="mx-auto flex h-[72px] max-w-[1600px] items-center justify-between px-6 lg:px-[120px]"
      >
        <Link
          href="#home"
          aria-label="HostWise home"
          className="flex items-center gap-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          <Logo size={30} />
          <span className="font-manrope text-base font-semibold tracking-tight text-white">
            HostWise
          </span>
        </Link>

        <ul className="hidden items-center gap-8 lg:flex">
          {NAV_ITEMS.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className={navLinkClasses}>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-3 lg:flex">
          <Link
            href={LINKS.download}
            target="_blank"
            rel="noopener noreferrer"
            className={signInClasses}
          >
            Sign In
          </Link>
          <Link
            href={LINKS.download}
            target="_blank"
            rel="noopener noreferrer"
            className={getStartedClasses}
          >
            Get Started
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="mobile-menu"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-white transition-colors duration-200 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white lg:hidden"
        >
          <Menu size={26} strokeWidth={2} aria-hidden="true" />
        </button>
      </nav>

      {open ? (
        <div
          id="mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className="fixed inset-0 z-50 flex flex-col bg-[#0d0817]/95 backdrop-blur-md"
        >
          <div className="flex h-[72px] items-center justify-between px-6">
            <div className="flex items-center gap-2.5">
              <Logo size={30} />
              <span className="font-manrope text-base font-semibold text-white">
                HostWise
              </span>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="flex h-11 w-11 items-center justify-center rounded-lg text-white transition-colors duration-200 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <X size={26} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>

          <ul className="flex flex-1 flex-col justify-center gap-1 px-6">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block py-3 font-manrope text-3xl font-medium text-white/90 transition-colors duration-200 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-3 px-6 pb-12">
            <Link
              href={LINKS.download}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center rounded-lg border border-[#D4D4D4] bg-white py-3.5 font-manrope text-base font-semibold text-[#171717] transition-colors duration-200 hover:bg-white/90"
            >
              Sign In
            </Link>
            <Link
              href={LINKS.download}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center rounded-lg bg-primary py-3.5 font-manrope text-base font-semibold text-white shadow-[0_8px_24px_-10px_rgba(123,57,252,0.8)] transition-colors duration-200 hover:bg-[#8c4cff]"
            >
              Get Started
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
