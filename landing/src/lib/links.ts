/**
 * Real destinations only.
 *
 * HostWise is a local-first desktop app (auth-free by design), so there is no
 * hosted web app or hosted "sign in" yet. The conversion path today is the
 * GitHub Releases download. When a hosted web build / sign-in ships, swap
 * LINKS.download for that URL.
 */
export const LINKS = {
  /** Real download / get-started flow: the GitHub Releases page. */
  download: "https://github.com/mahmoud-ath/HostWise/releases",
  /** The product repo. */
  repo: "https://github.com/mahmoud-ath/HostWise",
  /** Real support channel used by the app's in-app feedback flow. */
  email: "markuspub4@gmail.com",
  /** Real issue tracker for bugs / feature requests. */
  issues: "https://github.com/mahmoud-ath/HostWise/issues",
} as const;
