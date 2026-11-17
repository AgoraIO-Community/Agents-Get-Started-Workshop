import { runInNewContext } from "node:vm";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

describe("workshop deck structure", () => {
  it("places the cascading Conversational AI pipeline between Channels and Agents", () => {
    const channels = html.indexOf('data-slide-id="channels"');
    const pipeline = html.indexOf('data-slide-id="conversational-ai-pipeline"');
    const agents = html.indexOf('data-slide-id="agents"');

    expect(channels).toBeGreaterThan(-1);
    expect(pipeline).toBeGreaterThan(channels);
    expect(agents).toBeGreaterThan(pipeline);
  });

  it("describes both directions of the SDRTN voice cascade", () => {
    expect(html).toContain("User device");
    expect(html).toContain("Audio stream");
    expect(html).toContain("ASR");
    expect(html).toContain("Transcript text");
    expect(html).toContain("LLM");
    expect(html).toContain("Response text");
    expect(html).toContain("TTS");
    expect(html).toContain("Synthesized audio stream");
    expect(html).toContain("Agora SDRTN®");
  });

  it("uses stable slide IDs for stage navigation", () => {
    expect(html).toContain('{ 1: "install-cli", 2: "initialize-quickstart", 3: "run-quickstart"');
    expect(html).not.toMatch(/slideTargets\s*=\s*\{\s*1:\s*\d/);
  });

  it("keeps configurable venue Wi-Fi details host-only", () => {
    expect(html).toContain('id="wifiNameInput"');
    expect(html).toContain('id="wifiPasswordInput"');
    expect(html).toContain('id="frontWifiDetails"');
    expect(html).toContain('sessionStorage.getItem("agora-v2-wifi-password")');

    const sharedKeys = html.slice(html.indexOf("var SHARED_CONFIG_KEYS"), html.indexOf("var SHARED_CONFIG_ENUMS"));
    expect(sharedKeys).not.toContain("wifiName");
    expect(sharedKeys).not.toContain("wifiPassword");
  });
});

// Exercise the same validation and formatting functions used by host edits and remote snapshots.
const eventSettings = runInNewContext(
  html.slice(html.indexOf("      function normalizeJoinLink"), html.indexOf("      var DEFAULTS")) +
    "({ normalizeJoinLink, validEventSetting, formatEventDate, formatEventTime })",
  { URL, Intl }
);

describe("event settings", () => {
  it("formats dates without changing the calendar day and supports AM/PM times", () => {
    expect(eventSettings.formatEventDate("2026-09-30")).toBe("Wednesday · September 30, 2026");
    expect(eventSettings.formatEventTime("00:05")).toBe("12:05 AM");
    expect(eventSettings.formatEventTime("12:00")).toBe("12:00 PM");
    expect(eventSettings.formatEventTime("18:15")).toBe("6:15 PM");
  });

  it("rejects invalid dates and times while allowing the city default date", () => {
    expect(eventSettings.validEventSetting("eventDate", "")).toBe(true);
    expect(eventSettings.validEventSetting("eventDate", "2028-02-29")).toBe(true);
    for (const date of ["2026-02-29", "2026-04-31", "0000-01-01", "invalid"]) {
      expect(eventSettings.validEventSetting("eventDate", date)).toBe(false);
    }
    for (const time of ["24:00", "12:60", "", "5:30"]) {
      expect(eventSettings.validEventSetting("workshopTime", time)).toBe(false);
    }
  });

  it("normalizes Bitly links and rejects unsafe or unrelated destinations", () => {
    expect(eventSettings.normalizeJoinLink(" bit.ly/MyWorkshop ")).toBe("https://bit.ly/MyWorkshop");
    for (const link of ["javascript:alert(1)", "http://bit.ly/workshop", "https://bit.ly.evil.test/workshop", "https://user:pass@bit.ly/workshop", "https://example.com/workshop", "https://bit.ly/"]) {
      expect(eventSettings.normalizeJoinLink(link)).toBeNull();
    }
  });
});
