import { it, expect, vi } from "vitest";
const blob = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), list: vi.fn() }));
vi.mock("@vercel/blob", () => blob);
import { eventStore } from "../server/event-store.js";

it("reads current JSON by deterministic filename, bypassing the Blob CDN cache", async () => {
  blob.get.mockResolvedValue({ stream: new Response(JSON.stringify({ name: "Latest" })).body, blob: { etag: "v2" } });
  expect(await eventStore.read("001-002")).toEqual({ event: { name: "Latest" }, etag: "v2" });
  expect(blob.get).toHaveBeenCalledWith("001-002.json", { access: "private", useCache: false });
});
it("creates without overwrite and conditionally replaces an existing JSON", async () => {
  blob.put.mockResolvedValue({ etag: "v2" });
  await eventStore.write("001-002", { version: 1 });
  expect(blob.put).toHaveBeenLastCalledWith("001-002.json", '{"version":1}', expect.objectContaining({ addRandomSuffix: false, allowOverwrite: false }));
  await eventStore.write("001-002", { version: 2 }, "v1");
  expect(blob.put).toHaveBeenLastCalledWith("001-002.json", '{"version":2}', expect.objectContaining({ allowOverwrite: true, ifMatch: "v1" }));
});
it("lists only event JSON filenames and preserves pagination", async () => {
  blob.list.mockResolvedValue({ blobs: [{ pathname: "001-002.json", uploadedAt: new Date("2026-09-30") }, { pathname: "unrelated.png" }], hasMore: true, cursor: "page-2" });
  expect(await eventStore.list("page-1")).toEqual({ events: [{ code: "001-002", updatedAt: "2026-09-30T00:00:00.000Z" }], cursor: "page-2" });
});
