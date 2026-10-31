import type { NextConfig } from "next";
import { securityHeaders } from "@demo/core/headers";

const dev = process.env.NODE_ENV === "development";

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@demo/core", "@demo/db"],
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
