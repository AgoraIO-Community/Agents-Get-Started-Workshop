import { describe, expect, it, vi } from "vitest";
import {
  WORKSHOP_ARCHIVE_KEY,
  createWorkshopArchive,
  loadWorkshopArchive,
  saveWorkshopArchive,
  workshopArchiveSummary
} from "../src/archive.js";

const SIP_CONFIG_KEYS = [
  "sipClaimUrl",
  "sipMode",
  "sipClaimEventName",
  "sipPhone",
  "sipProvider",
  "sipDisplayName",
  "sipServer",
  "sipTransport",
  "sipUsername",
  "sipPassword"
];

function snapshot(overrides = {}) {
  return {
    version: 1,
    slideId: "campaign",
    config: {
      city: "sf",
      template: "restaurant-concierge",
      track: "python",
      packageManager: "bun",
      sttProvider: "deepgram",
      llmProvider: "openai",
      ttsProvider: "elevenlabs",
      theme: "dark",
      terminalEnvironment: "macos",
      sipClaimUrl: "https://private.example.com/claim",
      sipMode: "claim",
      sipClaimEventName: "SFWRKSHP26",
      sipPhone: "+15550102026",
      sipProvider: "private-gateway",
      sipDisplayName: "Workshop gateway",
      sipUsername: "private-user",
      sipServer: "private.example.com",
      sipTransport: "tls",
      sipPassword: "private-gateway-secret",
      campaignName: "private-campaign",
      ...overrides
    }
  };
}

describe("audience workshop archive", () => {
  it("keeps presentation choices, starts at welcome, and excludes operational details", () => {
    const archive = createWorkshopArchive("sf-rehearsal", snapshot(), new Date("2026-08-12T20:00:00.000Z"));

    expect(archive).toMatchObject({
      version: 1,
      sessionId: "sf-rehearsal",
      savedAt: "2026-08-12T20:00:00.000Z",
      snapshot: {
        version: 1,
        slideId: "welcome",
        config: { city: "sf", track: "python", packageManager: "bun" }
      }
    });
    for (const key of SIP_CONFIG_KEYS) expect(archive.snapshot.config).not.toHaveProperty(key);
    expect(JSON.stringify(archive)).not.toContain("private-gateway-secret");
    expect(JSON.stringify(archive)).not.toContain("private.example.com");
    expect(archive.snapshot.config).not.toHaveProperty("campaignName");
  });

  it("retains public event details in the saved audience copy", () => {
    const event = { eventDate: "2026-09-30", doorsTime: "18:00", workshopTime: "18:15", joinLink: "https://bit.ly/workshop" };
    const archive = createWorkshopArchive("rehearsal", snapshot(event));
    expect(archive.snapshot.config).toMatchObject(event);
    expect(loadWorkshopArchive({ getItem: () => JSON.stringify(archive) }).snapshot.config).toMatchObject(event);
  });

  it("removes SIP details from tampered local data when it is loaded", () => {
    const archive = createWorkshopArchive("2026-08-12", snapshot());
    archive.snapshot.config = {
      ...archive.snapshot.config,
      sipServer: "injected.example.com",
      sipUsername: "injected-user",
      sipPassword: "injected-secret"
    };

    const loaded = loadWorkshopArchive({ getItem: () => JSON.stringify(archive) });

    for (const key of SIP_CONFIG_KEYS) expect(loaded.snapshot.config).not.toHaveProperty(key);
    expect(JSON.stringify(loaded)).not.toContain("injected");
  });

  it("saves and loads the most recent valid archive", () => {
    const values = new Map();
    const storage = {
      getItem: vi.fn((key) => values.get(key) ?? null),
      setItem: vi.fn((key, value) => values.set(key, value))
    };
    const archive = createWorkshopArchive("2026-08-12", snapshot());

    expect(saveWorkshopArchive(storage, archive)).toBe(true);
    expect(storage.setItem).toHaveBeenCalledWith(WORKSHOP_ARCHIVE_KEY, expect.any(String));
    expect(loadWorkshopArchive(storage)).toEqual(archive);
  });

  it("ignores corrupt or incomplete local data", () => {
    expect(loadWorkshopArchive({ getItem: () => "not json" })).toBeNull();
    expect(createWorkshopArchive("2026-08-12", snapshot({ city: null }))).toBeNull();
    expect(saveWorkshopArchive({ setItem: () => { throw new Error("blocked"); } }, createWorkshopArchive("2026-08-12", snapshot()))).toBe(false);
  });

  it("formats the saved venue, code track, and package manager", () => {
    expect(workshopArchiveSummary(createWorkshopArchive("2026-08-12", snapshot()))).toBe("San Francisco · Python · Bun");
    expect(workshopArchiveSummary(createWorkshopArchive("2026-08-13", snapshot({ city: "nyc", track: "go", packageManager: "pnpm" })))).toBe("New York · Go · Make");
  });
});
