import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("agora-rtm", () => ({ default: { RTM: vi.fn() } }));

import { MESSAGE_TYPES, WorkshopSignaling } from "../src/signaling.js";

function response(body, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

function credentials(overrides = {}) {
  return {
    appId: "app-id",
    token: "token-1",
    userId: "audience-1",
    hostUserId: "host-2026-08-12",
    channelName: "2026-08-12",
    expiresIn: 3600,
    ...overrides
  };
}

function fakeClient({ loginError, subscribeError } = {}) {
  const calls = [];
  const handlers = {};
  return {
    calls,
    handlers,
    addEventListener: vi.fn((name, handler) => { handlers[name] = handler; }),
    login: vi.fn(async (value) => { calls.push(["login", value]); if (loginError) throw loginError; }),
    subscribe: vi.fn(async (...args) => { calls.push(["subscribe", ...args]); if (subscribeError) throw subscribeError; }),
    renewToken: vi.fn(async () => {}),
    publish: vi.fn(async (...args) => { calls.push(["publish", ...args]); }),
    unsubscribe: vi.fn(async (...args) => { calls.push(["unsubscribe", ...args]); }),
    logout: vi.fn(async () => { calls.push(["logout"]); })
  };
}

function presentation() {
  return {
    stateChangeEvent: "workshop:statechange",
    getSnapshot: vi.fn(() => ({ version: 1, slideId: "welcome", config: { city: "sf" } }))
  };
}

describe("WorkshopSignaling", () => {
  let events;

  beforeEach(() => { events = new EventTarget(); });

  it("logs in before subscribing with message and presence enabled", async () => {
    const client = fakeClient();
    const signaling = new WorkshopSignaling({
      presentation: presentation(),
      eventTarget: events,
      fetchImpl: vi.fn(async () => response(credentials())),
      createClient: vi.fn(() => client)
    });

    await signaling.connect({ sessionId: "2026-08-12", role: "audience", userId: "audience-1" });

    expect(JSON.parse(signaling.fetchImpl.mock.calls[0][1].body)).toMatchObject({ userId: "audience-1" });
    expect(client.calls[0]).toEqual(["login", { token: "token-1" }]);
    expect(client.calls[1]).toEqual(["subscribe", "2026-08-12", { withMessage: true, withPresence: true }]);
    expect(client.calls[2][0]).toBe("publish");
    expect(JSON.parse(client.calls[2][2])).toMatchObject({ type: MESSAGE_TYPES.request, version: 1 });
  });

  it("rejects a token response for a different audience identity", async () => {
    const client = fakeClient();
    const signaling = new WorkshopSignaling({
      presentation: presentation(), eventTarget: events,
      fetchImpl: vi.fn(async () => response(credentials({ userId: "audience-other" }))), createClient: () => client
    });

    await expect(signaling.connect({
      sessionId: "2026-08-12", role: "audience", userId: "audience-persisted"
    })).rejects.toThrow("Token response did not match");
    expect(client.login).not.toHaveBeenCalled();
  });

  it("accepts snapshots only from the trusted host identity", async () => {
    const client = fakeClient();
    const signaling = new WorkshopSignaling({
      presentation: presentation(), eventTarget: events,
      fetchImpl: vi.fn(async () => response(credentials())), createClient: () => client
    });
    const received = vi.fn();
    events.addEventListener("workshop:remotesnapshot", (event) => received(event.detail));
    await signaling.connect({ sessionId: "2026-08-12", role: "audience" });
    const payload = JSON.stringify({ type: MESSAGE_TYPES.snapshot, version: 1, snapshot: { version: 1, slideId: "install-cli", config: {} } });

    await client.handlers.message({ publisher: "audience-attacker", channelName: "2026-08-12", customType: MESSAGE_TYPES.snapshot, message: payload });
    await client.handlers.message({ publisher: "host-2026-08-12", channelName: "2026-08-12", customType: MESSAGE_TYPES.snapshot, message: payload });

    expect(received).toHaveBeenCalledTimes(1);
    expect(received).toHaveBeenCalledWith(expect.objectContaining({ slideId: "install-cli" }));
  });

  it("publishes the current snapshot for late join requests and presence joins", async () => {
    const client = fakeClient();
    const deck = presentation();
    const signaling = new WorkshopSignaling({
      presentation: deck, eventTarget: events,
      fetchImpl: vi.fn(async () => response(credentials({ userId: "host-2026-08-12" }))), createClient: () => client
    });
    await signaling.connect({ sessionId: "2026-08-12", role: "host" });
    client.publish.mockClear();

    await client.handlers.message({
      publisher: "audience-1", channelName: "2026-08-12", customType: MESSAGE_TYPES.request,
      message: JSON.stringify({ type: MESSAGE_TYPES.request, version: 1 })
    });
    await client.handlers.presence({ eventType: "JOIN", publisher: "audience-2" });

    expect(client.publish).toHaveBeenCalledTimes(2);
    expect(JSON.parse(client.publish.mock.calls[0][1])).toMatchObject({ type: MESSAGE_TYPES.snapshot, snapshot: { slideId: "welcome" } });
  });

  it("does not subscribe when login fails", async () => {
    const client = fakeClient({ loginError: new Error("login failed") });
    const signaling = new WorkshopSignaling({
      presentation: presentation(), eventTarget: events,
      fetchImpl: vi.fn(async () => response(credentials())), createClient: () => client
    });

    await expect(signaling.connect({ sessionId: "2026-08-12", role: "audience" })).rejects.toThrow("login failed");
    expect(client.subscribe).not.toHaveBeenCalled();
    expect(client.logout).not.toHaveBeenCalled();
  });

  it("logs out when subscription fails after a successful login", async () => {
    const client = fakeClient({ subscribeError: new Error("subscribe failed") });
    const signaling = new WorkshopSignaling({
      presentation: presentation(), eventTarget: events,
      fetchImpl: vi.fn(async () => response(credentials())), createClient: () => client
    });

    await expect(signaling.connect({ sessionId: "2026-08-12", role: "audience" })).rejects.toThrow("subscribe failed");
    expect(client.logout).toHaveBeenCalledTimes(1);
    expect(client.calls.slice(-2)).toEqual([["unsubscribe", "2026-08-12"], ["logout"]]);
  });

  it("renews an expired RTM token with the same user identity", async () => {
    const client = fakeClient();
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(response(credentials()))
      .mockResolvedValueOnce(response(credentials({ token: "token-2" })));
    const signaling = new WorkshopSignaling({ presentation: presentation(), eventTarget: events, fetchImpl, createClient: () => client });
    await signaling.connect({ sessionId: "2026-08-12", role: "audience" });

    await client.handlers.linkState({ state: "TOKEN_EXPIRED", reason: "token expired" });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(client.login).toHaveBeenLastCalledWith({ token: "token-2" });
  });

  it("unsubscribes before logging out", async () => {
    const client = fakeClient();
    const signaling = new WorkshopSignaling({
      presentation: presentation(), eventTarget: events,
      fetchImpl: vi.fn(async () => response(credentials())), createClient: () => client
    });
    await signaling.connect({ sessionId: "2026-08-12", role: "audience" });
    client.calls.length = 0;

    await signaling.disconnect();

    expect(client.calls).toEqual([["unsubscribe", "2026-08-12"], ["logout"]]);
  });
});

describe('presenter notes', () => {
  it('follows host changes and handles late join requests while audience sync is paused', async () => {
    vi.useFakeTimers();
    const client = fakeClient();
    const events = new EventTarget();
    const deck = { ...presentation(), getPresenterSnapshot: () => ({ version: 1, slideId: 'install-cli', notesHtml: '<p>Show terminal</p>' }) };
    const signaling = new WorkshopSignaling({ presentation: deck, eventTarget: events,
      fetchImpl: async () => response(credentials({ userId: 'host-2026-08-12' })), createClient: () => client });
    await signaling.connect({ sessionId: '2026-08-12', role: 'host' });
    signaling.setBroadcasting(false);
    client.publish.mockClear();
    events.dispatchEvent(new Event(deck.stateChangeEvent));
    await vi.advanceTimersByTimeAsync(100);
    await client.handlers.message({ channelName: '2026-08-12', customType: MESSAGE_TYPES.notesRequest,
      message: JSON.stringify({ type: MESSAGE_TYPES.notesRequest, version: 1 }) });
    expect(client.publish).toHaveBeenCalledTimes(2);
    for (const call of client.publish.mock.calls) expect(JSON.parse(call[1]).type).toBe(MESSAGE_TYPES.notesSnapshot);
    await signaling.disconnect();
    vi.useRealTimers();
  });

  it('requests notes, rejects forged packets, and renews the separate identity', async () => {
    const client = fakeClient();
    const events = new EventTarget();
    const fetchImpl = vi.fn(async () => response(credentials({ userId: 'notes-123456781234123412341234' })));
    const signaling = new WorkshopSignaling({ presentation: null, eventTarget: events, fetchImpl, createClient: () => client });
    const received = vi.fn();
    events.addEventListener('workshop:presentersnapshot', received);
    await signaling.connect({ sessionId: '2026-08-12', role: 'notes', hostKey: 'key' });
    expect(JSON.parse(client.publish.mock.calls[0][1]).type).toBe(MESSAGE_TYPES.notesRequest);
    const packet = { channelName: '2026-08-12', customType: MESSAGE_TYPES.notesSnapshot,
      message: JSON.stringify({ type: MESSAGE_TYPES.notesSnapshot, version: 1, snapshot: { slideId: 'welcome' } }) };
    await client.handlers.message({ ...packet, publisher: 'audience-forged' });
    await client.handlers.message({ ...packet, publisher: 'host-2026-08-12', channelName: 'other' });
    expect(received).not.toHaveBeenCalled();
    await client.handlers.message({ ...packet, publisher: 'host-2026-08-12' });
    expect(received).toHaveBeenCalledTimes(1);
    await signaling.renewToken();
    expect(client.renewToken).toHaveBeenCalledWith('token-1');
    await client.handlers.linkState({ currentState: 'FAILED', reasonCode: 'TOKEN_EXPIRED' });
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body)).toMatchObject({ role: 'notes', userId: 'notes-123456781234123412341234', hostKey: 'key' });
    await signaling.disconnect();
  });
});

describe('notes host presence', () => {
  it('marks notes stale when the trusted host leaves and requests fresh notes when it rejoins', async () => {
    const client = fakeClient();
    const onStatus = vi.fn();
    const signaling = new WorkshopSignaling({ presentation: null, eventTarget: new EventTarget(), onStatus,
      fetchImpl: async () => response(credentials({ userId: 'notes-123456781234123412341234' })), createClient: () => client });
    await signaling.connect({ sessionId: '2026-08-12', role: 'notes', hostKey: 'key' });
    onStatus.mockClear();
    client.publish.mockClear();
    const host = { publisher: 'host-2026-08-12', channelName: '2026-08-12' };
    await client.handlers.presence({ ...host, channelName: 'another-channel', eventType: 'REMOTE_LEAVE' });
    await client.handlers.presence({ ...host, publisher: 'audience-other', eventType: 'REMOTE_TIMEOUT' });
    expect(onStatus).not.toHaveBeenCalled();
    await client.handlers.presence({ ...host, eventType: 'REMOTE_LEAVE' });
    expect(onStatus).toHaveBeenLastCalledWith('waiting-for-host');
    await client.handlers.presence({ ...host, eventType: 'REMOTE_JOIN' });
    expect(onStatus).toHaveBeenLastCalledWith('waiting-for-slide');
    expect(JSON.parse(client.publish.mock.calls[0][1]).type).toBe(MESSAGE_TYPES.notesRequest);
    await client.handlers.presence({ ...host, eventType: 'REMOTE_TIMEOUT' });
    expect(onStatus).toHaveBeenLastCalledWith('waiting-for-host');
    await client.handlers.presence({ ...host, eventType: 'INTERVAL', interval: { join: { users: [host.publisher] } } });
    expect(onStatus).toHaveBeenLastCalledWith('waiting-for-slide');
    expect(client.publish).toHaveBeenCalledTimes(2);
    await client.handlers.presence({ ...host, eventType: 'SNAPSHOT', snapshot: [] });
    expect(onStatus).toHaveBeenLastCalledWith('waiting-for-host');
    await signaling.disconnect();
  });
});
