import { BlobPreconditionFailedError } from "@vercel/blob";
import { randomInt } from "node:crypto";
import { createWorkshopArchive } from "../src/archive.js";
import { normalizeEventCode } from "../src/event-code.js";
import { validHostKey } from "./host-auth.js";

const MAX_BYTES = 32_768;
const error = (status, message) => ({ status, body: { error: message } });

export function eventSnapshot(snapshot) {
  const archive = createWorkshopArchive("saved-event", snapshot);
  if (!archive) return null;
  // Only persist settings approved for public workshop replay. No SIP, Wi-Fi or host credentials.
  if (Object.values(archive.snapshot.config).some(value => value.length > 2048)) return null;
  return archive.snapshot;
}

export function generateEventCode() {
  return normalizeEventCode(String(randomInt(1_000_000)).padStart(6, "0"));
}

export async function handleEvents({ method, query = new URLSearchParams(), hostKey, body }, {
  store, env = process.env, generateCode = generateEventCode, now = () => new Date().toISOString()
}) {
  if (!["GET", "POST", "PUT"].includes(method)) return error(405, "Method not allowed");
  const isAuth = method === "GET" && query.get("auth") === "1";
  const isRead = method === "GET" && query.has("code") && !isAuth;
  if (!isRead && !validHostKey(hostKey, env)) return error(401, "Invalid host key");
  if (isAuth) return { status: 200, body: { authenticated: true } };
  const code = normalizeEventCode(query.get("code"));
  if ((isRead || method === "PUT") && !code) return error(400, "Enter a six-digit event code, such as 482-193.");
  try {
    if (isRead) {
      const stored = await store.read(code);
      if (!stored) return error(404, "This event code was not found. Check the code and try again.");
      const snapshot = eventSnapshot(stored.event.snapshot);
      if (!snapshot) return error(502, "This saved event could not be loaded.");
      return { status: 200, body: { event: { version: 1, code, name: stored.event.name, createdAt: stored.event.createdAt, updatedAt: stored.event.updatedAt, snapshot }, etag: stored.etag } };
    }
    if (method === "GET") {
      const cursor = query.get("cursor");
      if (cursor && cursor.length > 2048) return error(400, "Invalid cursor");
      return { status: 200, body: await store.list(cursor) };
    }
    if (!body || typeof body !== "object" || Buffer.byteLength(JSON.stringify(body)) > MAX_BYTES) return error(400, "Invalid event data");
    const snapshot = eventSnapshot(body.snapshot);
    if (!snapshot) return error(400, "Invalid workshop settings");
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 120) return error(400, "Enter an event name of up to 120 characters.");
    if (method === "PUT") {
      if (typeof body.etag !== "string" || !body.etag || body.etag.length > 256) return error(400, "Reload the saved event before updating it.");
      const current = await store.read(code);
      if (!current) return error(404, "This event no longer exists.");
      if (current.etag !== body.etag) return error(409, "This event changed in another window. Reopen it before saving.");
      const event = { version: 1, code, name, createdAt: current.event.createdAt, updatedAt: now(), snapshot };
      const etag = await store.write(code, event, body.etag);
      return { status: 200, body: { event, etag } };
    }
    for (let attempt = 0; attempt < 10; attempt++) {
      const newCode = generateCode();
      const timestamp = now();
      const event = { version: 1, code: newCode, name, createdAt: timestamp, updatedAt: timestamp, snapshot };
      try {
        const etag = await store.write(newCode, event);
        return { status: 201, body: { event, etag } };
      } catch (cause) {
        // A create is atomic (allowOverwrite: false). On a collision, try a fresh code.
        // The SDK currently reports an existing pathname as a generic BlobError.
        if (!(await store.read(newCode))) throw cause;
      }
    }
    return error(503, "Could not allocate an event code. Try again.");
  } catch (cause) {
    if (cause instanceof BlobPreconditionFailedError) return error(409, "This event changed in another window. Reopen it before saving.");
    return error(503, "Event storage is unavailable. Try again shortly or contact the host.");
  }
}
