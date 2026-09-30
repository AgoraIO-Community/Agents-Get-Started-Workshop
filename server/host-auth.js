import { timingSafeEqual } from "node:crypto";

export function validHostKey(value, env = process.env) {
  const expected = env.WORKSHOP_HOST_KEY || "AgoraWorkshop2026";
  const left = Buffer.from(typeof value === "string" ? value : "");
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
