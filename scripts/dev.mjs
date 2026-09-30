import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { createTokenResponse } from "../api/rtm-token.js";
import { createPhoneClaimResponse } from "../api/phone-number-claim.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const port = Number(process.env.PORT || 4173);
const contentTypes = {
  ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8", ".ico": "image/x-icon",
  ".jpg": "image/jpeg", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml"
};

function sendJson(response, status, body) {
  response.writeHead(status, { "cache-control": "no-store", "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

async function tokenRequest(request, response) {
  if (request.method !== "POST") return sendJson(response, 405, { error: "Method not allowed" });
  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 8_192) return sendJson(response, 413, { error: "Request too large" });
  }
  let body;
  try { body = JSON.parse(raw || "{}"); } catch { return sendJson(response, 400, { error: "Invalid JSON" }); }
  const result = createTokenResponse(body);
  sendJson(response, result.status, result.body);
}

async function phoneClaimRequest(request, response) {
  if (request.method !== "POST") return sendJson(response, 405, { error: "Method not allowed" });
  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 8_192) return sendJson(response, 413, { error: "Request too large" });
  }
  let body;
  try { body = JSON.parse(raw || "{}"); } catch { return sendJson(response, 400, { error: "Invalid JSON" }); }
  const result = await createPhoneClaimResponse(body);
  sendJson(response, result.status, result.body);
}

async function staticRequest(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";
  if (pathname === "/audience" || pathname === "/audience/") pathname = "/audience.html";
  if (pathname === "/host" || pathname === "/host/") pathname = "/host.html";
  if (pathname === "/host-notes" || pathname === "/host-notes/") pathname = "/host-notes.html";
  const relative = normalize(pathname).replace(/^[/\\]+/, "");
  const path = join(root, relative);
  if (!path.startsWith(root)) return sendJson(response, 403, { error: "Forbidden" });
  try {
    if (!(await stat(path)).isFile()) throw new Error("Not a file");
    const content = await readFile(path);
    response.writeHead(200, { "content-type": contentTypes[extname(path)] || "application/octet-stream" });
    response.end(content);
  } catch {
    sendJson(response, 404, { error: "Not found" });
  }
}

createServer((request, response) => {
  const task = request.url?.startsWith("/api/rtm-token")
    ? tokenRequest(request, response)
    : (request.url?.startsWith("/api/phone-number-claim") ? phoneClaimRequest(request, response) : staticRequest(request, response));
  Promise.resolve(task).catch((error) => sendJson(response, 500, { error: error.message }));
}).listen(port, () => console.log(`Workshop running at http://localhost:${port}`));
