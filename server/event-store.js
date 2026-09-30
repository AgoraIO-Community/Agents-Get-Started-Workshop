import { get, put, list } from "@vercel/blob";

// Read past the Blob cache so an overwritten event is immediately available.
export const eventStore = {
  async read(code) {
    const result = await get(`${code}.json`, { access: "private", useCache: false });
    if (!result) return null;
    return { event: await new Response(result.stream).json(), etag: result.blob.etag };
  },
  async write(code, event, etag) {
    const result = await put(`${code}.json`, JSON.stringify(event), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: Boolean(etag),
      ...(etag ? { ifMatch: etag } : {}),
      contentType: "application/json",
      cacheControlMaxAge: 60
    });
    return result.etag;
  },
  async list(cursor) {
    const result = await list({ limit: 100, ...(cursor ? { cursor } : {}) });
    return {
      events: result.blobs.filter(blob => /^\d{3}-\d{3}\.json$/.test(blob.pathname)).map(blob => ({
        code: blob.pathname.slice(0, -5), updatedAt: blob.uploadedAt.toISOString()
      })),
      cursor: result.hasMore ? result.cursor : null
    };
  }
};
