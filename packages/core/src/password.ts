/**
 * Password hashing with Argon2id (the library default), using the OWASP-recommended
 * baseline: 19 MiB memory, 2 iterations, 1 lane.
 */
import { hash, verify } from "@node-rs/argon2";

export const PASSWORD_MIN = 12;
/** Upper bound stops attackers sending megabyte passwords to burn CPU. */
export const PASSWORD_MAX = 128;

const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export type PasswordProblem = "too_short" | "too_long" | "single_character";

export function checkPasswordPolicy(password: string): PasswordProblem | null {
  const length = [...password].length;
  if (length < PASSWORD_MIN) return "too_short";
  if (length > PASSWORD_MAX) return "too_long";
  if (new Set(password).size === 1) return "single_character";
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  const problem = checkPasswordPolicy(password);
  if (problem) throw new Error(`Password rejected: ${problem}`);
  return hash(password, OPTIONS);
}

/** Never throws on a malformed stored hash; returns false instead. */
export async function verifyPassword(storedHash: string, password: string): Promise<boolean> {
  if ([...password].length > PASSWORD_MAX) return false;
  try {
    return await verify(storedHash, password);
  } catch {
    return false;
  }
}
