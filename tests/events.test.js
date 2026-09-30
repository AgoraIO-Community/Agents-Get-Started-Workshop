import { describe, it, expect, vi } from "vitest";
import { BlobPreconditionFailedError } from "@vercel/blob";
import { handleEvents, generateEventCode } from "../server/events.js";
import { eventEntryMode, eventUrl, normalizeEventCode } from "../src/event-code.js";

const snapshot = { version: 1, slideId: "install-cli", config: { city: "nyc", track: "nextjs", theme: "dark", wifiPassword: "secret", sipPassword: "secret", hostKey: "secret" } };
const body = { name: "September workshop", snapshot };
const env = { WORKSHOP_HOST_KEY: "test-host" };
function setup() {
  const records = new Map();
  let version = 0;
  const store = {
    read: vi.fn(async code => records.get(code) || null),
    write: vi.fn(async (code, event, etag) => {
      if (!etag && records.has(code)) throw new Error("Blob already exists");
      if (etag && etag !== records.get(code)?.etag) throw new BlobPreconditionFailedError();
      const next = `etag-${++version}`;
      records.set(code, { event, etag: next });
      return next;
    }),
    list: vi.fn(async () => ({ events: Array.from(records.values(), ({ event }) => ({ code: event.code, updatedAt: event.updatedAt })), cursor: null }))
  };
  const codes = ["123-456", "123-456", "789-012"];
  const run = (request = {}) => handleEvents({ method: "POST", body, hostKey: "test-host", ...request }, { store, env, generateCode: () => codes.shift(), now: () => "2026-09-30T12:00:00Z" });
  return { store, records, run };
}

describe("saved events", () => {
  it("requires the host password for creates, updates and listing", async () => {
    const { run, store } = setup();
    for (const method of ["GET", "POST", "PUT"]) expect((await run({ method, hostKey: "wrong" })).status).toBe(401);
    expect((await run({ method: "GET", hostKey: "wrong", query: new URLSearchParams("auth=1&code=001-002") })).status).toBe(401);
    expect(store.write).not.toHaveBeenCalled();
    expect(store.list).not.toHaveBeenCalled();
  });
  it("authenticates independently of Agora and Blob availability", async () => {
    const { run, store } = setup();
    expect((await run({ method: "GET", query: new URLSearchParams("auth=1") })).status).toBe(200);
    expect(store.list).not.toHaveBeenCalled();
  });
  it("creates a public replay snapshot and allows reading it without a host password", async () => {
    const { run, records } = setup();
    const created = await run();
    expect(created.status).toBe(201);
    expect(created.body.event.code).toBe("123-456");
    expect(created.body.event.snapshot.slideId).toBe("welcome");
    expect(created.body.event.snapshot.config).toEqual({ city: "nyc", track: "nextjs", theme: "dark", packageManager: "pnpm" });
    const read = await run({ method: "GET", hostKey: undefined, query: new URLSearchParams("code=123456") });
    expect(read.body.event).toEqual(records.get("123-456").event);
    expect(JSON.stringify(read)).not.toContain("secret");
  });
  it("retries collisions without overwriting the existing event", async () => {
    const { run, records } = setup();
    await run();
    const original = records.get("123-456");
    expect((await run()).body.event.code).toBe("789-012");
    expect(records.get("123-456")).toBe(original);
  });
  it("overwrites only the selected code and rejects stale writes", async () => {
    const { run, records, store } = setup();
    const created = await run();
    const update = { method: "PUT", query: new URLSearchParams("code=123-456"), body: { ...body, name: "Revised", etag: created.body.etag } };
    expect((await run(update)).status).toBe(200);
    expect(records.size).toBe(1);
    expect(records.get("123-456").event.name).toBe("Revised");
    expect((await run(update)).status).toBe(409);
    store.write.mockRejectedValueOnce(new BlobPreconditionFailedError());
    expect((await run({ ...update, body: { ...update.body, etag: records.get("123-456").etag } })).status).toBe(409);
  });
  it("validates codes, content and missing versions; reports missing events and storage outages", async () => {
    const { run, store } = setup();
    expect((await run({ method: "GET", query: new URLSearchParams("code=../../secret") })).status).toBe(400);
    expect((await run({ method: "GET", query: new URLSearchParams("code=111-111") })).status).toBe(404);
    expect((await run({ body: { ...body, snapshot: {} } })).status).toBe(400);
    expect((await run({ body: { ...body, name: "" } })).status).toBe(400);
    expect((await run({ method: "PUT", query: new URLSearchParams("code=111-111") })).status).toBe(400);
    store.read.mockRejectedValue(new Error("private token in provider error"));
    const failed = await run({ method: "GET", query: new URLSearchParams("code=111-111") });
    expect(failed.status).toBe(503);
    expect(JSON.stringify(failed)).not.toContain("private token");
  });
  it("passes the host list cursor through", async () => {
    const { run, store } = setup();
    await run({ method: "GET", query: new URLSearchParams("cursor=next-page") });
    expect(store.list).toHaveBeenCalledWith("next-page");
  });
});

describe("event URLs", () => {
  it("normalizes exactly six digits and preserves leading zeros", () => {
    expect(normalizeEventCode(" 001002 ")).toBe("001-002");
    for (const code of ["", "12345", "1234567", "abc-def", "123--456"]) expect(normalizeEventCode(code)).toBeNull();
    for (let i = 0; i < 30; i++) expect(generateEventCode()).toMatch(/^\d{3}-\d{3}$/);
  });
  it("gives code links precedence over active mode, even for invalid codes", () => {
    expect(eventEntryMode("?code=bad&join=active")).toEqual({ mode: "saved", code: null });
    expect(eventEntryMode("?join=active").mode).toBe("live");
    expect(eventEntryMode("").mode).toBe("choose");
    expect(eventUrl("https://workshop.example/host?view=host&channel=test#slide-foo", "001002")).toBe("https://workshop.example/?code=001-002");
  });
});
