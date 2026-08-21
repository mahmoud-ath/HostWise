import { useEffect, useRef, useState } from "react";
import { HERO_VIDEO_URL } from "../lib/constants";

const CAPTURE_WIDTH = 960;
const PLAYBACK_INTERVAL = 1000 / 30; // ~30fps

/**
 * Full-bleed hero background. Plays the source video exactly once while
 * capturing every presented frame to offscreen canvases (960px cap). On
 * `ended` it swaps to a display canvas and ping-pongs forward then reverse
 * at 30fps forever, so the footage loops smoothly in both directions.
 *
 * While frames are still being captured the live video is shown; once the
 * frame buffer is ready the video is hidden and the canvas takes over. The
 * transition is seamless.
 *
 * Honors prefers-reduced-motion: it stays on a static first frame instead of
 * autoplaying, and all animation loops are cleaned up on unmount.
 */
export default function HostWiseVideoBg() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const frames: HTMLCanvasElement[] = [];
    const seen = new Set<number>();
    const ctx = canvas.getContext("2d");
    const supportsVfc =
      typeof video.requestVideoFrameCallback === "function";

    let capturing = false;
    let rafId = 0;
    let vfcId = 0;
    let timer: number | undefined;
    let playIndex = 0;
    let playDir = 1;

    const captureFrame = (t: number) => {
      const key = Math.round(t * 1000);
      if (seen.has(key)) return;
      seen.add(key);
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) return;
      const w = Math.min(CAPTURE_WIDTH, vw);
      const h = Math.round((vh / vw) * w);
      const off = document.createElement("canvas");
      off.width = w;
      off.height = h;
      const offCtx = off.getContext("2d");
      if (offCtx) offCtx.drawImage(video, 0, 0, w, h);
      frames.push(off);
    };

    const drawCover = (img: HTMLCanvasElement) => {
      if (!ctx) return;
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      if (!cw || !ch) return;
      const scale = Math.max(cw / img.width, ch / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      ctx.clearRect(0, 0, cw, ch);
      ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    };

    const sizeCanvas = () => {
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      if (!cw || !ch) return;
      canvas.width = cw;
      canvas.height = ch;
      if (frames[playIndex]) drawCover(frames[playIndex]);
    };

    const paint = () => {
      drawCover(frames[playIndex]);
      playIndex += playDir;
      if (playIndex >= frames.length - 1) playDir = -1;
      else if (playIndex <= 0) playDir = 1;
    };

    const startPingPong = () => {
      if (!frames.length || timer !== undefined) return;
      video.style.display = "none";
      canvas.style.display = "block";
      playIndex = 0;
      playDir = 1;
      sizeCanvas();
      window.addEventListener("resize", sizeCanvas);
      paint();
      timer = window.setInterval(paint, PLAYBACK_INTERVAL);
      setReady(true);
    };

    const onVfc = (_now: number, meta: VideoFrameCallbackMetadata) => {
      if (capturing) captureFrame(meta.mediaTime ?? video.currentTime);
      if (!video.ended && !video.paused) {
        vfcId = video.requestVideoFrameCallback(onVfc);
      }
    };

    const onRaf = () => {
      if (capturing) captureFrame(video.currentTime);
      if (!video.ended) rafId = requestAnimationFrame(onRaf);
    };

    const onEnded = () => {
      capturing = false;
      cancelAnimationFrame(rafId);
      if (supportsVfc) video.cancelVideoFrameCallback(vfcId);
      if (frames.length) {
        startPingPong();
      } else if (!reduceMotion) {
        // Fallback: native loop if frame capture ever fails.
        video.loop = true;
        video.play().catch(() => {});
      }
    };

    const onLoaded = () => {
      if (reduceMotion) {
        // Static first frame for reduced-motion users.
        video.pause();
        return;
      }
      capturing = true;
      if (supportsVfc) {
        vfcId = video.requestVideoFrameCallback(onVfc);
      } else {
        rafId = requestAnimationFrame(onRaf);
      }
      video.play().catch(() => {});
    };

    video.addEventListener("loadeddata", onLoaded);
    video.addEventListener("ended", onEnded);

    return () => {
      video.removeEventListener("loadeddata", onLoaded);
      video.removeEventListener("ended", onEnded);
      cancelAnimationFrame(rafId);
      if (supportsVfc) video.cancelVideoFrameCallback(vfcId);
      if (timer !== undefined) window.clearInterval(timer);
      window.removeEventListener("resize", sizeCanvas);
      video.pause();
      frames.length = 0;
      seen.clear();
    };
  }, []);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
      <video
        ref={videoRef}
        src={HERO_VIDEO_URL}
        muted
        playsInline
        preload="auto"
        crossOrigin="anonymous"
        className="w-full h-full object-cover object-center"
        style={{ display: ready ? "none" : "block" }}
      />
      <canvas
        ref={canvasRef}
        className="block w-full h-full object-cover object-center"
        style={{ display: ready ? "block" : "none" }}
      />
      {/* Very subtle top gradient so the dark hero text stays readable. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/60 via-white/15 to-transparent" />
    </div>
  );
}
