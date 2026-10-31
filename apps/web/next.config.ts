import type { NextConfig } from "next";
import { securityHeaders } from "@demo/core/headers";

const dev = process.env.NODE_ENV === "development";

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@demo/core", "@demo/db"],
  serverExternalPackages: ["@node-rs/argon2", "@prisma/client"],
  async headers() {
    const headers = securityHeaders({ dev });
    return [{ source: "/:path*", headers: Object.entries(headers).map(([key, value]) => ({ key, value })) }];
  },
};

export default config;
