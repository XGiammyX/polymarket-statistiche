import { NextRequest } from "next/server";
import { getAdminSecret } from "./env";

export function checkAdminAuth(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  return token === getAdminSecret();
}
