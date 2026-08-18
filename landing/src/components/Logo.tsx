import Image from "next/image";

/**
 * The official HostWise mark (copied from frontend/public/logo-1024.png): a
 * white rounded tile with the two gradient house loops. Reused as-is so the
 * landing page never invents a different brand identity.
 */
export function Logo({
  className = "",
  size = 30,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <Image
      src="/logo.png"
      alt="HostWise"
      width={1024}
      height={1024}
      priority
      draggable={false}
      className={`shrink-0 rounded-xl object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
