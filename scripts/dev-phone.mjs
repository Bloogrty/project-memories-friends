// `npm run dev:phone`: starts the dev server on this laptop's Wi-Fi address, so a phone can open it.
// It uses HTTPS because phones only allow the in-app camera on a secure address.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";

// Adapters that have an address but can't be reached from a phone on the same Wi-Fi.
const VIRTUAL_ADAPTER = /warp|cloudflare|tailscale|vethernet|wsl|vmware|virtualbox|docker|bluetooth|loopback|vpn/i;
const CERT_DAYS = 365;
const CERT_RENEW_AFTER_MS = 300 * 24 * 60 * 60 * 1000;
const OPENSSL_PATHS = ["openssl", "C:\\Program Files\\Git\\usr\\bin\\openssl.exe", "C:\\Program Files\\Git\\mingw64\\bin\\openssl.exe"];

const root = path.join(import.meta.dirname, "..");

const candidates = Object.entries(os.networkInterfaces())
  .filter(([name]) => !VIRTUAL_ADAPTER.test(name))
  .flatMap(([name, addresses]) =>
    (addresses ?? [])
      .filter((address) => address.family === "IPv4" && !address.internal && !address.address.startsWith("169.254."))
      .map((address) => ({ name, ip: address.address })),
  )
  // Prefer the Wi-Fi adapter when the laptop is also plugged into a network.
  .sort((a, b) => Number(/wi-?fi|wlan/i.test(b.name)) - Number(/wi-?fi|wlan/i.test(a.name)));

if (candidates.length === 0) {
  console.error("Couldn't find a Wi-Fi address. Connect this laptop to Wi-Fi and try again.");
  process.exit(1);
}
const { ip } = candidates[0];

/** Self-signed, so nothing gets installed on this laptop. Returns null if OpenSSL is missing. */
function ensureCertificate() {
  const dir = path.join(root, ".certs");
  const key = path.join(dir, `${ip}-key.pem`);
  const cert = path.join(dir, `${ip}.pem`);
  if (existsSync(key) && existsSync(cert) && Date.now() - statSync(cert).mtimeMs < CERT_RENEW_AFTER_MS) return { key, cert };

  mkdirSync(dir, { recursive: true });
  for (const openssl of OPENSSL_PATHS) {
    try {
      execFileSync(
        openssl,
        ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", key, "-out", cert, "-days", String(CERT_DAYS), "-subj", `/CN=${ip}`, "-addext", `subjectAltName=IP:${ip},DNS:localhost`],
        // Stops Git Bash's OpenSSL from rewriting "/CN=..." as a Windows path.
        { stdio: "ignore", env: { ...process.env, MSYS_NO_PATHCONV: "1" } },
      );
      return { key, cert };
    } catch {
      // Try the next location.
    }
  }
  return null;
}

const args = process.argv.slice(2);
const portFlag = args.indexOf("-p");
const port = portFlag >= 0 ? args[portFlag + 1] : "3000";
const certificate = ensureCertificate();

if (certificate) {
  console.log(`
  On your phone (same Wi-Fi), open: https://${ip}:${port}

  The first time, the browser warns that the connection isn't private.
  That's expected for this local test: tap Advanced, then Proceed (Show Details, then visit on iPhone).
`);
} else {
  console.log(`
  On your phone (same Wi-Fi), open: http://${ip}:${port}

  OpenSSL wasn't found, so this runs without HTTPS: the phone's own camera opens, and video won't work.
`);
}

const httpsArgs = certificate
  ? ["--experimental-https", "--experimental-https-key", certificate.key, "--experimental-https-cert", certificate.cert]
  : [];
const next = path.join(root, "node_modules", "next", "dist", "bin", "next");
const child = spawn(process.execPath, [next, "dev", "-H", ip, ...httpsArgs, ...args], { stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 0));
