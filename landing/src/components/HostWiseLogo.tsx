/**
 * The official HostWise mark (copied from app/frontend/public/logo-1024.png):
 * a white rounded tile with the two gradient house loops. Reused as-is so the
 * landing page never invents a different brand identity.
 */
export default function HostWiseLogo({
  className = "",
  size = 28,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <img
      src="/logo.png"
      alt="HostWise"
      width={1024}
      height={1024}
      draggable={false}
      className={`shrink-0 rounded-xl object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
