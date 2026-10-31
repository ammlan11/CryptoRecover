import { describe, expect, it } from "vitest";
import { isAdPage } from "@/lib/ads";

describe("ad tags", () => {
  it("are allowed on campaign landing pages only", () => {
    expect(isAdPage("/lp/broker-scams")).toBe(true);
    for (const p of ["/", "/scams/pig-butchering", "/account/reports", "/login", "/lp", "/privacy"]) expect(isAdPage(p)).toBe(false);
  });
});
