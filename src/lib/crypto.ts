import { createHash } from "crypto";

export function sha256(...parts: (string | number | null | undefined)[]): string {
  const hash = createHash("sha256");
  for (const p of parts) {
    hash.update(String(p ?? ""));
  }
  return hash.digest("hex");
}
