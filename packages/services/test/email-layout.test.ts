import { describe, expect, it, vi } from "vitest";
import { escapeHtml, renderEmail } from "../src/email-layout";

vi.mock("server-only", () => ({}));

describe("branded email HTML", () => {
  it("escapes everything it is given and only links to http(s) URLs", () => {
    const html = renderEmail(
      { preheader: "<p>", heading: "Hi <script>alert(1)</script>", intro: ['"quoted" & <b>bold</b>'], button: { label: "Go", url: "javascript:alert(1)" } },
      "https://kurotrace.com",
    );
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>bold</b>");
    expect(html).toContain(escapeHtml('"quoted" & <b>bold</b>'));
    expect(html).not.toMatch(/href="javascript:/i);
  });

  it("every template has a text and an HTML version carrying the same link or code", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://kurotrace.com";
    vi.resetModules();
    const { templates } = await import("../src/email");
    const reset = templates.resetPassword("https://kurotrace.com/reset-password?token=abc");
    expect(reset.text).toContain("https://kurotrace.com/reset-password?token=abc");
    expect(reset.html).toContain('href="https://kurotrace.com/reset-password?token=abc"');
    expect(reset.html).toContain("https://kurotrace.com/brand/kuro-trace-horizontal-white.png");
    const welcome = templates.verifyEmail("https://kurotrace.com/verify-email?token=xyz");
    expect(welcome.subject).toBe("Welcome to Kuro Trace: confirm your email");
    expect(welcome.html).toContain("Welcome to Kuro Trace");
    expect(welcome.html).toContain("verify-email?token=xyz");
    const code = templates.loginCode("123456", 10);
    expect(code.text).toMatch(/code is:\s+123456/);
    expect(code.html).toContain("123456");
    for (const t of [templates.passwordChanged(), templates.twoStepChanged(true), templates.newMessage("DM-ABCDE"), templates.reportReceived("DM-ABCDE")]) {
      expect(t.html).toMatch(/^<!doctype html>/);
      expect(t.text).toContain("never asks for payment");
    }
  });
});
