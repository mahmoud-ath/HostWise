/**
 * Shared dev helpers.
 */
import net from "node:net";

/** True if something is already listening on 127.0.0.1:port. */
export function isPortInUse(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const sock = net.connect({ host, port });
    sock.once("connect", () => {
      sock.destroy();
      resolve(true);
    });
    sock.once("error", () => {
      sock.destroy();
      resolve(false);
    });
  });
}
