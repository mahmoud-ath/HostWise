import { DOWNLOAD_VERSION } from "./constants";

export type PlatformId = "mac" | "windows" | "linux";

/**
 * Default installer per platform. Used when a generic "Install / Get
 * HostWise" button needs to start a real download without the user having
 * clicked a specific platform card.
 */
export const PLATFORM_DOWNLOADS: Record<PlatformId, string> = {
  mac: `/downloads/HostWise_${DOWNLOAD_VERSION}_universal.dmg`,
  windows: `/downloads/HostWise_${DOWNLOAD_VERSION}_x64-setup.exe`,
  // AppImage runs on any Linux distro, so it is the safest generic default.
  linux: `/downloads/HostWise_${DOWNLOAD_VERSION}_amd64.AppImage`,
};

export const PLATFORM_LABEL: Record<PlatformId, string> = {
  mac: "macOS",
  windows: "Windows",
  linux: "Linux",
};

/** Best-effort OS detection from the user agent (falls back to macOS). */
export function detectPlatform(): PlatformId {
  if (typeof navigator === "undefined") return "mac";
  const ua = navigator.userAgent;
  if (/Mac|iPhone|iPad|iPod/.test(ua)) return "mac";
  if (/Windows/.test(ua)) return "windows";
  return "linux";
}

/** Pick the most likely installer for the current visitor's machine. */
export function defaultDownload(): {
  href: string;
  os: string;
  platform: PlatformId;
} {
  const platform = detectPlatform();
  return {
    href: PLATFORM_DOWNLOADS[platform],
    os: PLATFORM_LABEL[platform],
    platform,
  };
}
