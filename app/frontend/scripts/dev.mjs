#!/usr/bin/env node
/**
 * Combined browser-dev runner.
 *
 * Runs the Rust backend (`app/backend`, `cargo run` → 127.0.0.1:8000) and the
 * Next.js dev server (`app/frontend`, port 3000) together, so browser dev at
 * http://localhost:3000 works with ONE command and no `ECONNREFUSED` spam.
 *
 * It waits for the backend to be listening on 8000 BEFORE starting Next (Next's
 * dev proxy targets 127.0.0.1:8000 at boot). Ctrl+C stops both.
 *
 * Usage:  cd app/frontend && bun run dev:app
 */
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// scripts/ lives at app/frontend/scripts/ → repo root is 3 levels up.
const repoRoot = path.resolve(__dirname, "..", "..", "..");
const backendDir = path.join(repoRoot, "app", "backend");
const frontendDir = path.join(repoRoot, "app", "frontend");

const BACKEND_PORT = 8000;
const FRONTEND_PORT = 3000;

const children = [];

function run(name, cmd, args, cwd) {
  console.log(`\n▶ [${name}] ${cmd} ${args.join(" ")} (${cwd})\n`);
  const child = spawn(cmd, args, { cwd, shell: true });
  child.stdout?.on("data", (d) => process.stdout.write(`[${name}] ${d}`));
  child.stderr?.on("data", (d) => process.stderr.write(`[${name}] ${d}`));
  child.on("exit", (code, signal) => {
    console.log(`\n[${name}] exited (code=${code}, signal=${signal})`);
    killAll();
  });
  children.push(child);
  return child;
}

function killAll() {
  for (const c of children) {
    try {
      c.kill("SIGTERM");
    } catch {
      /* already gone */
    }
  }
}

function waitForBackend(host, port, timeoutMs) {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    const tryConnect = () => {
      const sock = net.connect({ host, port });
      sock.once("connect", () => {
        sock.destroy();
        resolve(true);
      });
      sock.once("error", () => {
        sock.destroy();
        if (Date.now() > deadline) resolve(false);
        else setTimeout(tryConnect, 500);
      });
    };
    tryConnect();
  });
}

process.on("SIGINT", () => {
  killAll();
  process.exit(130);
});
process.on("SIGTERM", () => {
  killAll();
  process.exit(143);
});

// If something else is already on 8000 (e.g. a leftover tauri:dev in-process
// backend), cargo run would fall back to a random port and the Next proxy
// (which targets 8000) would break. Warn early.
import { isPortInUse } from "./lib-port.mjs";

if (await isPortInUse(BACKEND_PORT)) {
  console.error(
    `\n⚠️  Port ${BACKEND_PORT} is already in use. Stop any running ` +
      "`bun run tauri:dev` / backend before `bun run dev:app`, otherwise the " +
      "proxy won't find the backend.\n"
  );
}

run("backend", "cargo", ["run"], backendDir);

const ready = await waitForBackend("127.0.0.1", BACKEND_PORT, 180_000);
if (!ready) {
  console.error(`\n✖ Backend did not come up on 127.0.0.1:${BACKEND_PORT} in time.`);
  killAll();
  process.exit(1);
}

run("frontend", "bun", ["run", "dev", "--", "--port", String(FRONTEND_PORT)], frontendDir);

console.log(
  `\n✔ Backend up on http://127.0.0.1:${BACKEND_PORT} — open ` +
    `http://localhost:${FRONTEND_PORT} in your browser. Ctrl+C stops both.\n`
);
