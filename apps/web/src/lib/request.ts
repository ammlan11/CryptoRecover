import "server-only";
import { headers } from "next/headers";
import { clientIpFromHeaders } from "@kurotrace/core/ip";

export async function clientIp(): Promise<string> {
  const h = await headers();
  return clientIpFromHeaders(h, process.env.TRUSTED_IP_HEADER ?? "x-forwarded-for") ?? "unknown";
}
