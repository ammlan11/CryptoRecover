import { describe, expect, it } from "vitest";
import { domainCandidates, parseMetaMaskConfig, parseOfacList, parsePhishDestroy, walletCandidates } from "../src/threat-lists";

describe("free threat lists", () => {
  it("reads sanctions files, normalising addresses like checker input", () => {
    const list = parseOfacList("ETH", "0x0330070FD38Ec3bB94F58FA55D40368271E9e54A\n\n# comment\nTA3rH2A7iHnm6pKH8gr9cK1EZnShnmZdFg\n44AFFq5kSiGBoZ4NMDwYtN18obc8AemS33DBLWs3H7otXft3XjrpDtQGv7SqSsaBYBb98uNbr2VBBEt7f2wfn3RVGQBEP3A\n");
    expect(list).toEqual([
      { kind: "WALLET", value: "0x0330070fd38ec3bb94f58fa55d40368271e9e54a", chain: "ETH" },
      { kind: "WALLET", value: "TA3rH2A7iHnm6pKH8gr9cK1EZnShnmZdFg", chain: "ETH" }, // TRON stays case-sensitive
      { kind: "WALLET", value: "44AFFq5kSiGBoZ4NMDwYtN18obc8AemS33DBLWs3H7otXft3XjrpDtQGv7SqSsaBYBb98uNbr2VBBEt7f2wfn3RVGQBEP3A", chain: "ETH" }, // kept as listed
    ]);
  });

  it("reads scam-site lists, skipping junk, duplicates and shared hosting platforms", () => {
    const mm = parseMetaMaskConfig({ blacklist: ["opensea.support", "https://www.Fake-Uniswap.org/login", "vercel.app", 42, "not a domain"], whitelist: ["opensea.io"] });
    expect(mm.blocked.map((e) => e.value)).toEqual(["opensea.support", "fake-uniswap.org"]);
    expect(mm.allowed).toEqual(["opensea.io"]);
    expect(parsePhishDestroy(["a-scam.xyz", "A-SCAM.xyz", "github.io"]).map((e) => e.value)).toEqual(["a-scam.xyz"]);
    expect(() => parsePhishDestroy({ nope: true })).toThrow();
  });

  it("matches a subdomain to its listed parent, but never a whole shared platform", () => {
    expect(domainCandidates("login.app.evil-site.com")).toEqual(["login.app.evil-site.com", "app.evil-site.com", "evil-site.com"]);
    expect(domainCandidates("scam.vercel.app")).toEqual(["scam.vercel.app"]);
    expect(domainCandidates("fake.co.uk")).toEqual(["fake.co.uk"]);
    expect(walletCandidates("0xabc", " 0xABC ")).toEqual(["0xabc", "0xABC"]);
  });
});
