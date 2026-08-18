/**
 * Real destinations only.
 *
 * HostWise is a local-first desktop app (auth-free by design), so there is no
 * hosted web app or hosted "sign in" yet. The conversion path today is the
 * GitHub Releases download. When a hosted web build / sign-in ships, swap
 * LINKS.download and LINKS.signIn for those URLs.
 */
export const LINKS = {
  /** Real download / get-started flow: the GitHub Releases page. */
  download: "https://github.com/mahmoud-ath/HostWise/releases",
  /** The product repo. */
  repo: "https://github.com/mahmoud-ath/HostWise",
  /** Real support channel used by the app's in-app feedback flow. */
  email: "mailto:support@hostwise.app",
  /** Real issue tracker for bugs / feature requests. */
  issues: "https://github.com/mahmoud-ath/HostWise/issues",
} as const;

export const NAV_ITEMS = [
  { label: "Home", href: "#home" },
  { label: "Features", href: "#features" },
  { label: "Analytics", href: "#analytics" },
  { label: "Reports", href: "#reports" },
  { label: "Contact", href: "#contact" },
] as const;
