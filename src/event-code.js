export function normalizeEventCode(value) {
  if (typeof value !== "string") return null;
  const digits = value.trim().replace(/^(\d{3})-(\d{3})$/, "$1$2");
  return /^\d{6}$/.test(digits) ? `${digits.slice(0, 3)}-${digits.slice(3)}` : null;
}

export function eventEntryMode(search) {
  const params = new URLSearchParams(search);
  if (params.has("code")) return { mode: "saved", code: normalizeEventCode(params.get("code")) };
  return { mode: params.get("join") === "active" ? "live" : "choose" };
}

export function eventUrl(href, code) {
  const normalized = normalizeEventCode(code);
  if (!normalized) throw new Error("Enter a six-digit event code, such as 482-193.");
  const url = new URL("/", href);
  url.searchParams.set("code", normalized);
  return url.href;
}
