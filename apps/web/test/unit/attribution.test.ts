import { describe, expect, it } from "vitest";
import { attributionFromUrl, parseAttribution } from "@/lib/attribution";

describe("ad attribution", () => {
  it("reads utm, gclid and fbclid from a landing URL", () => {
    const a = attributionFromUrl(new URL("https://kurotrace.example/lp/broker-scams?utm_source=meta&utm_campaign=q4&fbclid=abc&other=x"));
    expect(a).toEqual({ utm_source: "meta", utm_campaign: "q4", fbclid: "abc", landing: "/lp/broker-scams" });
    expect(attributionFromUrl(new URL("https://kurotrace.example/scams"))).toBeNull();
  });

  it("ignores tampered or oversized cookie values", () => {
    expect(parseAttribution("not json")).toEqual({});
    expect(parseAttribution(JSON.stringify({ utm_source: "x".repeat(300) }))).toEqual({});
    expect(parseAttribution(JSON.stringify({ utm_source: "google", evil: "<script>" }))).toEqual({ utm_source: "google" });
  });
});
