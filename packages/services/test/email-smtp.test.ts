import { createServer, type AddressInfo, type Socket } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/** A tiny SMTP server that refuses to go further without TLS, proving we never send in clear text. */
let port = 0;
const seen: string[] = [];
const server = createServer((socket: Socket) => {
  socket.write("220 test ESMTP\r\n");
  socket.on("data", (d) => {
    const line = d.toString();
    seen.push(line.trim());
    if (/^EHLO/i.test(line)) socket.write("250-test\r\n250 STARTTLS\r\n");
    else if (/^STARTTLS/i.test(line)) socket.end("454 TLS not available\r\n");
    else if (/^(AUTH|MAIL)/i.test(line)) socket.end("530 Must issue STARTTLS first\r\n");
    else if (/^QUIT/i.test(line)) socket.end("221 bye\r\n");
  });
});
beforeAll(() => new Promise<void>((r) => server.listen(0, "127.0.0.1", () => { port = (server.address() as AddressInfo).port; r(); })));
afterAll(() => new Promise<void>((r) => server.close(() => r())));

describe("SMTP email (e.g. Hostinger)", () => {
  it("refuses to send without encryption on port 587 and never sends the password in clear", async () => {
    Object.assign(process.env, { EMAIL_PROVIDER: "smtp", SMTP_HOST: "127.0.0.1", SMTP_PORT: String(port), SMTP_USER: "no-reply@example.com", SMTP_PASS: "secret-pass", EMAIL_FROM: "Kuro Trace <no-reply@example.com>" });
    // Port isn't 465, so STARTTLS is required; the server can't offer it, so sending must fail.
    const { sendEmail } = await import("../src/email");
    await expect(sendEmail({ to: "a@example.com", subject: "s", text: "t" })).rejects.toThrow();
    expect(seen.some((l) => /AUTH|secret-pass/i.test(l))).toBe(false);
  });
});
