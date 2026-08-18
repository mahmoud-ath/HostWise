/**
 * Glass announcement pill above the headline: semi-transparent dark surface,
 * backdrop blur, subtle purple border. The inner "New" badge uses the brand
 * purple (#7B39FC).
 */
export function AnnouncementBadge() {
  return (
    <a
      href="#features"
      className="group inline-flex h-[38px] items-center gap-2.5 rounded-[10px] border border-primary/40 bg-white/[0.07] py-1 pl-1 pr-3.5 backdrop-blur-md transition-colors duration-300 hover:bg-white/[0.12] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
    >
      <span className="inline-flex h-7 items-center rounded-md bg-primary px-2.5 font-cabin text-xs font-semibold tracking-wide text-white">
        New
      </span>
      <span className="font-cabin text-sm text-white/90 transition-colors duration-300 group-hover:text-white">
        Introducing smarter rental analytics with HostWise
      </span>
    </a>
  );
}
