import { HERO_FALLBACK_GRADIENT, HERO_VIDEO_URL } from "@/lib/constants";

/**
 * Full-screen hero background video. Always muted + playsInline (autoplay
 * policy + mobile). A gradient sits *behind* the video as a graceful fallback
 * if the MP4 cannot load; there is deliberately no overlay on top of the
 * video. A short bottom scrim (height ~160px) only helps the hero seam into
 * the dark section below.
 */
export function HeroVideo() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* Fallback background (only visible if the video fails to load). */}
      <div
        className="absolute inset-0"
        style={{ background: HERO_FALLBACK_GRADIENT }}
      />
      <video
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        disablePictureInPicture
        disableRemotePlayback
        tabIndex={-1}
        aria-hidden="true"
      >
        <source src={HERO_VIDEO_URL} type="video/mp4" />
      </video>
      {/* Bottom seam scrim, not a full overlay. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#0d0817] to-transparent" />
    </div>
  );
}
