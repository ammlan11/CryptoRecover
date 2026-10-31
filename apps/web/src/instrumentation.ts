/**
 * Runs once when the server starts, before it handles requests: loads the
 * data-encryption keys (unwrapping them through KMS when configured). If that
 * fails the server refuses to start rather than run without encryption.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { loadKeys } = await import("@kurotrace/services/keys");
  const keys = await loadKeys();
  if (keys.source === "env" && process.env.NODE_ENV === "production" && process.env.KEYS_SOURCE !== "env") {
    console.warn("Encryption keys are plain environment variables. For production, wrap them with KMS (see docs/LAUNCH.md), or set KEYS_SOURCE=env to acknowledge.");
  }
}
