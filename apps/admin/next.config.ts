import type { NextConfig } from "next";
import { securityHeaders } from "@kurotrace/core/headers";

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
