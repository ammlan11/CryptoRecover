import "server-only";
import { headers } from "next/headers";
import { PHONE_COUNTRY_CODES } from "./phone-countries";

/** The visitor's country as Cloudflare sees it ("LK"), to pre-select phone forms. "" if unknown. */
export async function visitorCountry(): Promise<string> {
  const code = (await headers()).get("cf-ipcountry")?.toUpperCase() ?? "";
  return PHONE_COUNTRY_CODES.has(code) ? code : "";
}
