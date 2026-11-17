import { describe, expect, it } from "vitest";
import { createTokenResponse } from "../api/rtm-token.js";

const env = {
  AGORA_APP_ID: "a".repeat(32),
  AGORA_APP_CERTIFICATE: "b".repeat(32),
  WORKSHOP_HOST_KEY: "correct-horse-battery-staple",
  VERCEL_ENV: "production"
};

describe("RTM token endpoint", () => {
  it("mints an RTM token whose string subject matches the returned audience user ID", () => {
    const result = createTokenResponse(
      { sessionId: "2026-08-12", role: "audience" },
      env,
      () => "12345678-1234-1234-1234-123456789abc"
    );

    expect(result.status).toBe(200);
    expect(result.body.userId).toBe("audience-123456781234123412341234");
    expect(result.body.hostUserId).toBe("host-2026-08-12");
    expect(result.body.channelName).toBe("2026-08-12");
    expect(result.body.token).toMatch(/^007/);
  });

  it("mints reload and renewal tokens for the audience UID supplied by the browser", () => {
    const userId = "audience-1234567812344abc8def1234";
    const first = createTokenResponse({ sessionId: "2026-08-12", role: "audience", userId }, env);
    const second = createTokenResponse({ sessionId: "2026-08-12", role: "audience", userId }, env);

    expect(first.status).toBe(200);
    expect(first.body.userId).toBe(userId);
    expect(second.body.userId).toBe(userId);
  });

  it("rejects malformed or host-prefixed audience identities", () => {
    expect(createTokenResponse({ sessionId: "2026-08-12", role: "audience", userId: "host-2026-08-12" }, env).status).toBe(400);
    expect(createTokenResponse({ sessionId: "2026-08-12", role: "audience", userId: "audience-not-valid" }, env).status).toBe(400);
  });

  it("requires the configured host key before minting the stable host identity", () => {
    expect(createTokenResponse({ sessionId: "2026-08-12", role: "host", hostKey: "wrong" }, env).status).toBe(401);
    const result = createTokenResponse({ sessionId: "2026-08-12", role: "host", hostKey: env.WORKSHOP_HOST_KEY }, env);
    expect(result.status).toBe(200);
    expect(result.body.userId).toBe("host-2026-08-12");
  });

  it("uses the committed host password when no environment override is configured", () => {
    const noHostKey = { ...env, WORKSHOP_HOST_KEY: "" };
    expect(createTokenResponse({ sessionId: "2026-08-12", role: "host", hostKey: "wrong" }, noHostKey).status).toBe(401);
    expect(createTokenResponse({ sessionId: "2026-08-12", role: "host", hostKey: "AgoraWorkshop2026" }, noHostKey).status).toBe(200);
  });

  it("rejects malformed sessions", () => {
    expect(createTokenResponse({ sessionId: "../../other", role: "audience" }, env).status).toBe(400);
  });

  it("uses a valid custom override as the exact channel and host identity suffix", () => {
    const result = createTokenResponse({ sessionId: "sf-rehearsal", role: "audience" }, env, () => "12345678-1234-1234-1234-123456789abc");
    expect(result.status).toBe(200);
    expect(result.body.channelName).toBe("sf-rehearsal");
    expect(result.body.hostUserId).toBe("host-sf-rehearsal");
  });
});

describe('notes companion identities', () => {
  it('requires the host password and issues a distinct notes identity', () => {
    expect(createTokenResponse({ sessionId: 'demo', role: 'notes' }, env).status).toBe(401);
    const result = createTokenResponse({ sessionId: 'demo', role: 'notes', hostKey: env.WORKSHOP_HOST_KEY }, env);
    expect(result.status).toBe(200);
    expect(result.body.userId).toMatch(/^notes-[a-f0-9]{24}$/);
    expect(result.body.userId).not.toBe(result.body.hostUserId);
    expect(createTokenResponse({ sessionId: 'demo', role: 'notes', hostKey: env.WORKSHOP_HOST_KEY, userId: result.body.userId }, env).body.userId).toBe(result.body.userId);
  });
  it('cannot mint the desktop host identity through the notes role', () => {
    expect(createTokenResponse({ sessionId: 'demo', role: 'notes', hostKey: env.WORKSHOP_HOST_KEY, userId: 'host-demo' }, env).status).toBe(400);
  });
});
