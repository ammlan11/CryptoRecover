/**
 * Admin IP allow-list. Runs in the request proxy before any admin page renders,
 * so it uses only web-standard APIs (no node:* imports).
 */

type Rule = { kind: "v4"; base: number; mask: number } | { kind: "v6"; value: string } | { kind: "any" };

export function parseIpv4(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let out = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    out = (out << 8) + n;
  }
  return out >>> 0;
}

/** Lower-cases IPv6 and unwraps IPv4-mapped addresses (::ffff:1.2.3.4 → 1.2.3.4). */
export function normalizeIp(ip: string): string {
  const trimmed = ip.trim().replace(/^\[|\]$/g, "").toLowerCase();
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(trimmed);
  return mapped ? mapped[1]! : trimmed;
}

export function parseAllowList(spec: string | undefined): Rule[] {
  if (!spec) return [];
  const rules: Rule[] = [];
  for (const raw of spec.split(",")) {
    const entry = raw.trim();
    if (!entry) continue;
    // "*" = any address. Must be written out on purpose: an empty list still blocks everyone.
    if (entry === "*") { rules.push({ kind: "any" }); continue; }
    const [addr, bitsRaw] = entry.split("/") as [string, string | undefined];
    const v4 = parseIpv4(normalizeIp(addr));
    if (v4 !== null) {
      const bits = bitsRaw === undefined ? 32 : Number(bitsRaw);
      if (!Number.isInteger(bits) || bits < 0 || bits > 32) throw new Error(`Invalid CIDR "${entry}"`);
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
      rules.push({ kind: "v4", base: (v4 & mask) >>> 0, mask });
    } else if (addr.includes(":") && bitsRaw === undefined) {
      rules.push({ kind: "v6", value: normalizeIp(addr) });
    } else {
      throw new Error(`Unsupported allow-list entry "${entry}" (IPv6 ranges are not supported; list exact addresses)`);
    }
  }
  return rules;
}

export function isIpAllowed(ip: string | null | undefined, rules: readonly Rule[]): boolean {
  if (!ip || rules.length === 0) return false;
  const normalized = normalizeIp(ip);
  const v4 = parseIpv4(normalized);
  return rules.some((rule) =>
    rule.kind === "any" ? true : rule.kind === "v4" ? v4 !== null && ((v4 & rule.mask) >>> 0) === rule.base : rule.value === normalized,
  );
}

/**
 * Reads the client IP from the header your edge proxy sets.
 * For x-forwarded-for the RIGHT-most entry is used: it is the one appended by your own
 * proxy, while entries to its left can be forged by the client.
 */
export function clientIpFromHeaders(headers: Headers, headerName: string): string | null {
  const value = headers.get(headerName);
  if (!value) return null;
  if (headerName.toLowerCase() === "x-forwarded-for") {
    const parts = value.split(",").map((p) => p.trim()).filter(Boolean);
    return parts.at(-1) ?? null;
  }
  return value.trim() || null;
}
