// @vitest-environment jsdom
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const signaling = vi.hoisted(() => ({ connect: vi.fn(async () => {}), disconnect: vi.fn(async () => {}), setBroadcasting: vi.fn(), connected: false }));
vi.mock("../src/signaling.js", () => ({ WorkshopSignaling: class { constructor() { return signaling; } } }));
const html = readFileSync("index.html", "utf8");
const inline = Array.from(html.matchAll(/<script>([\s\S]*?)<\/script>/g)).at(-1)[1];
const snapshot = { version: 1, slideId: "welcome", config: { city: "nyc", track: "go", theme: "light", packageManager: "make", eventDate: "2026-09-30" } };
const event = { version: 1, code: "001-002", name: "Saved workshop", snapshot };
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
let listeners = [];

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  const storageWindow = new JSDOM("", { url: "http://localhost" }).window;
  vi.stubGlobal("localStorage", storageWindow.localStorage);
  vi.stubGlobal("sessionStorage", storageWindow.sessionStorage);
  history.replaceState(null, "", "/");
  document.documentElement.innerHTML = new DOMParser().parseFromString(html, "text/html").documentElement.innerHTML;
  vi.stubGlobal("fetch", vi.fn(async () => json({ event, etag: "v1" })));
  // Track page listeners so repeated simulated page loads do not leak across tests.
  const add = window.addEventListener.bind(window);
  vi.spyOn(window, "addEventListener").mockImplementation((...args) => { listeners.push(args); add(...args); });
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.stubGlobal("requestAnimationFrame", vi.fn());
  signaling.connected = false;
});
afterEach(() => {
  listeners.forEach(args => window.removeEventListener(...args));
  listeners = [];
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
async function boot(url) {
  history.replaceState(null, "", url);
  new Function(inline)();
  await import("../src/browser.js");
  await tick();
}

describe("attendee entry", () => {
  it("shows choices before making any RTM request", async () => {
    await boot("/");
    expect(signaling.connect).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(document.getElementById("audienceWaitingTitle").textContent).toBe("Join a workshop");
  });
  it("connects the existing live flow only for Join active", async () => {
    await boot("/?join=active&channel=rehearsal");
    expect(signaling.connect).toHaveBeenCalledWith(expect.objectContaining({ role: "audience", sessionId: "rehearsal" }));
    expect(document.getElementById("audienceWaitingTitle").textContent).toContain("hasn’t started");
  });
  it("loads saved settings, preserves the slide URL on reload, and never connects RTM", async () => {
    await boot("/?code=001-002&join=active#slide-install-cli");
    expect(fetch).toHaveBeenCalledWith("/api/events?code=001-002", expect.anything());
    expect(signaling.connect).not.toHaveBeenCalled();
    expect(document.body.classList.contains("archive-open")).toBe(true);
    expect(document.getElementById("followHostButton").hidden).toBe(true);
    expect(window.workshopPresentation.getSnapshot().config.track).toBe("go");
    expect(window.workshopPresentation.getSnapshot().slideId).toBe("install-cli");
    expect(location.search).toContain("code=001-002");
    expect(location.hash).toBe("#slide-install-cli");
    window.dispatchEvent(new CustomEvent("workshop:remotesnapshot", { detail: { ...snapshot, config: { city: "sf", track: "python" } } }));
    expect(window.workshopPresentation.getSnapshot().config.track).toBe("go");
  });
  it("shows an invalid-code error without falling back to live", async () => {
    await boot("/?code=bad&join=active");
    expect(signaling.connect).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(document.getElementById("eventCodeError").textContent).toContain("six-digit");
    expect(document.getElementById("audienceJoinChoices").hidden).toBe(false);
  });
  it("shows missing-event errors and offers the code form again", async () => {
    fetch.mockResolvedValue(json({ error: "Event not found" }, 404));
    await boot("/?code=001-002");
    expect(signaling.connect).not.toHaveBeenCalled();
    expect(document.getElementById("eventCodeError").textContent).toBe("Event not found");
    expect(document.body.classList.contains("archive-open")).toBe(false);
  });
});

describe("host saved events", () => {
  it("authenticates and opens a previous event without Agora, then autosaves to its original code", async () => {
    let saved = event;
    let version = 1;
    fetch.mockImplementation(async (url, options) => {
      if (url.endsWith("auth=1")) return json({ authenticated: true });
      if (url === "/api/events") return json({ events: [{ code: event.code, updatedAt: "2026-09-30" }], cursor: null });
      if (options.method === "PUT") { saved = { ...saved, ...JSON.parse(options.body) }; version++; }
      return json({ event: saved, etag: `v${version}` });
    });
    sessionStorage.setItem("workshop-host-key", "test-key");
    await boot("/index.html?view=host&code=001-002");
    await tick();
    expect(document.body.classList.contains("host-authenticated")).toBe(true);
    expect(signaling.connect).not.toHaveBeenCalled();
    expect(signaling.disconnect).toHaveBeenCalled();
    expect(window.workshopPresentation.getSnapshot().config.track).toBe("go");
    expect(document.getElementById("savedEventLink").href).toContain("/?code=001-002");
    vi.useFakeTimers();
    document.getElementById("trackSelect").value = "python";
    document.getElementById("trackSelect").dispatchEvent(new Event("change"));
    await vi.advanceTimersByTimeAsync(710);
    const writes = fetch.mock.calls.filter(([, options]) => options.method === "PUT");
    expect(writes).toHaveLength(1);
    expect(writes[0][0]).toBe("/api/events?code=001-002");
    expect(JSON.parse(writes[0][1].body).snapshot.config.track).toBe("python");
    expect(JSON.parse(writes[0][1].body).etag).toBe("v1");
    expect(document.getElementById("savedEventStatus").textContent).toContain("Saved 001-002");
    // Slide navigation does not rewrite the JSON.
    window.workshopPresentation.goToSlideId("install-cli");
    await vi.advanceTimersByTimeAsync(710);
    expect(fetch.mock.calls.filter(([, options]) => options.method === "PUT")).toHaveLength(1);
  });
});

it("creates a new code from current host settings and updates its name without creating another record", async () => {
  let current;
  let version = 0;
  fetch.mockImplementation(async (url, options) => {
    if (url.endsWith("auth=1")) return json({ authenticated: true });
    if (options.method === "POST" || options.method === "PUT") {
      current = { ...JSON.parse(options.body), code: "987-654" };
      version++;
      return json({ event: current, etag: `v${version}` }, options.method === "POST" ? 201 : 200);
    }
    return json({ events: current ? [{ code: current.code, updatedAt: "2026-09-30" }] : [], cursor: null });
  });
  sessionStorage.setItem("workshop-host-key", "test-key");
  await boot("/index.html?view=host");
  document.getElementById("savedEventName").value = "New event";
  document.getElementById("newEventButton").click();
  await tick();
  expect(fetch.mock.calls.filter(([, options]) => options.method === "POST")).toHaveLength(1);
  expect(document.getElementById("savedEventCode").textContent).toBe("987-654");
  expect(location.search).toContain("code=987-654");
  vi.useFakeTimers();
  document.getElementById("savedEventName").value = "Renamed event";
  document.getElementById("savedEventName").dispatchEvent(new Event("input"));
  await vi.advanceTimersByTimeAsync(710);
  expect(current.name).toBe("Renamed event");
  expect(fetch.mock.calls.filter(([, options]) => options.method === "POST")).toHaveLength(1);
  expect(fetch.mock.calls.filter(([, options]) => options.method === "PUT")).toHaveLength(1);
});

it("keeps local edits after a stale-write conflict and stops automatic retries", async () => {
  fetch.mockImplementation(async (url, options) => {
    if (url.endsWith("auth=1")) return json({ authenticated: true });
    if (url === "/api/events") return json({ events: [], cursor: null });
    if (options.method === "PUT") return json({ error: "This event changed in another window. Reopen it before saving." }, 409);
    return json({ event, etag: "v1" });
  });
  sessionStorage.setItem("workshop-host-key", "test-key");
  await boot("/index.html?view=host&code=001-002");
  await tick();
  vi.useFakeTimers();
  const name = document.getElementById("savedEventName");
  name.value = "Unsaved local name";
  name.dispatchEvent(new Event("input"));
  await vi.advanceTimersByTimeAsync(710);
  expect(name.value).toBe("Unsaved local name");
  expect(document.getElementById("savedEventStatus").textContent).toContain("Reopen");
  name.dispatchEvent(new Event("input"));
  await vi.advanceTimersByTimeAsync(3000);
  expect(fetch.mock.calls.filter(([, options]) => options.method === "PUT")).toHaveLength(1);
  expect(document.getElementById("saveEventButton").disabled).toBe(true);
});
