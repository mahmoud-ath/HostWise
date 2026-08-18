import Link from "next/link";
import { Logo } from "./Logo";
import { LINKS, NAV_ITEMS } from "@/lib/links";

export function Footer() {
  return (
    <footer className="border-t border-white/10 px-6 pb-10 pt-14 lg:px-[120px]">
      <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-8 md:flex-row">
        <div className="flex items-center gap-2.5">
          <Logo size={24} />
          <span className="font-manrope text-sm font-semibold text-white">
            HostWise
          </span>
        </div>

        <p className="font-sans text-sm text-white/60">
          Own your data. Know your numbers.
        </p>

        <nav aria-label="Footer">
          <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="font-manrope text-sm text-white/70 transition-opacity duration-200 hover:opacity-60 hover:text-white"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="mx-auto mt-8 flex max-w-[1400px] items-center justify-between border-t border-white/10 pt-6">
        <p className="font-sans text-xs text-white/50">© 2026 HostWise</p>
        <a
          href={LINKS.repo}
          target="_blank"
          rel="noopener noreferrer"
          className="font-manrope text-xs text-white/50 transition-opacity duration-200 hover:opacity-60 hover:text-white"
        >
          GitHub
        </a>
      </div>
    </footer>
  );
}
