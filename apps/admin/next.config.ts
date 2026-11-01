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
  async headers() {
    const headers = securityHeaders({ admin: true, dev });
    return [{ source: "/:path*", headers: Object.entries(headers).map(([key, value]) => ({ key, value })) }];
  },
};

export default config;
