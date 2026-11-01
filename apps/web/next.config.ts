import { existsSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";
import { securityHeaders } from "@kurotrace/core/headers";

// One .env at the repo root serves both apps (Next.js only looks in the app's own folder).
// Values already set in the environment (servers, CI, Docker) always win.
const rootEnv = path.resolve(process.cwd(), "../../.env");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const dev = process.env.NODE_ENV === "development";

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@kurotrace/core", "@kurotrace/db", "@kurotrace/services"],
  serverExternalPackages: ["@node-rs/argon2", "@prisma/client"],
  experimental: {
    // Evidence uploads: up to 10 MB per file, 25 MB per request.
    serverActions: { bodySizeLimit: "26mb" },
  },
  async headers() {
    const headers = securityHeaders({ dev });
    const noStore = [{ key: "Cache-Control", value: "no-store" }];
    return [
      { source: "/:path*", headers: Object.entries(headers).map(([key, value]) => ({ key, value })) },
      // Private pages are never stored by browsers or shared caches.
      ...["/account/:path*", "/login/:path*", "/login", "/signup", "/forgot-password", "/reset-password", "/verify-email", "/continue"].map((source) => ({ source, headers: noStore })),
    ];
  },
};

export default config;
