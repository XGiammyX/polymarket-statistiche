import { createHash } from "crypto";

export function sha256(...parts: string[]): string {
  const hash = createHash("sha256");
  for (const p of parts) {
    hash.update(p);
  }
  return hash.digest("hex");
}
