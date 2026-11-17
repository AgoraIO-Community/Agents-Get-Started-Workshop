import AgoraRTM from "agora-rtm";
import { channelNameForSession, normalizeSessionId } from "./session.js";

export const MESSAGE_TYPES = Object.freeze({
  notesRequest: "workshop.notes.request",
  notesSnapshot: "workshop.notes.snapshot",
  request: "workshop.state.request",
  snapshot: "workshop.state.snapshot"
});

function decodeMessage(message) {
  if (typeof message === "string") return message;
  if (message instanceof Uint8Array) return new TextDecoder().decode(message);
  return null;
}

export class WorkshopSignaling {
  constructor({
    presentation,
    fetchImpl = (...args) => globalThis.fetch(...args),
    eventTarget = globalThis.window,
    createClient = (appId, userId) => new AgoraRTM.RTM(appId, userId, { logLevel: "warn", presenceTimeout: 15 }),
    onStatus = () => {}
  }) {
    this.presentation = presentation;
    this.fetchImpl = fetchImpl;
    this.eventTarget = eventTarget;
    this.createClient = createClient;
    this.onStatus = onStatus;
    this.client = null;
    this.connection = null;
    this.connected = false;
    this.broadcasting = true;
    this.stateChangeHandler = () => this.queueSnapshot();
    this.snapshotTimer = null;
  }

  async fetchCredentials({ sessionId, role, hostKey, userId }) {
    const response = await this.fetchImpl("/api/rtm-token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId, role, hostKey, userId })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(body.error || "Unable to join workshop session");
      error.status = response.status;
      throw error;
    }
    return body;
  }

  async connect({ sessionId, role, hostKey = "", userId = "" }) {
    const normalized = normalizeSessionId(sessionId);
    if (!normalized) throw new Error("Invalid workshop session");
    if (role !== "host" && role !== "audience" && role !== "notes") throw new Error("Invalid workshop role");
    if (this.client) await this.disconnect();

    this.onStatus("connecting");
    const credentials = await this.fetchCredentials({ sessionId: normalized, role, hostKey, userId });
    const expectedChannel = channelNameForSession(normalized);
    const identityMismatch = role === "host"
      ? credentials.userId !== credentials.hostUserId
      : Boolean(userId && credentials.userId !== userId);
    if (credentials.channelName !== expectedChannel || credentials.userId !== String(credentials.userId) || identityMismatch) {
      throw new Error("Token response did not match the workshop session");
    }

    const client = this.createClient(credentials.appId, credentials.userId);
    this.client = client;
    this.connection = { ...credentials, sessionId: normalized, role, hostKey, userId: credentials.userId };
    client.addEventListener("message", (event) => this.handleMessage(event));
    client.addEventListener("presence", (event) => this.handlePresence(event));
    client.addEventListener("linkState", (event) => this.handleStatus(event));
    client.addEventListener("token", (event) => {
      if (event.eventType === "WILL_EXPIRE") void this.renewToken();
    });

    let loggedIn = false;
    let subscribeAttempted = false;
    try {
      await client.login({ token: credentials.token });
      loggedIn = true;
      subscribeAttempted = true;
      await client.subscribe(credentials.channelName, { withMessage: true, withPresence: true });
    } catch (error) {
      if (subscribeAttempted) await client.unsubscribe(credentials.channelName).catch(() => {});
      if (loggedIn) await client.logout().catch(() => {});
      this.client = null;
      this.connection = null;
      this.onStatus("error", error);
      throw error;
    }

    this.connected = true;
    this.broadcasting = true;
    this.onStatus("connected");
    if (role === "host") {
      this.eventTarget.addEventListener(this.presentation?.stateChangeEvent || "workshop:statechange", this.stateChangeHandler);
      await this.publishSnapshot();
      await this.publishNotesSnapshot();
    } else {
      await this.requestSnapshot();
    }
    return credentials;
  }

  async handleMessage(event) {
    if (!this.connected || !this.connection || event.channelName !== this.connection.channelName) return;
    const message = decodeMessage(event.message);
    if (!message) return;

    let payload;
    try { payload = JSON.parse(message); } catch { return; }
    if (!payload || typeof payload !== "object") return;

    if (this.connection.role === "audience" || this.connection.role === "notes") {
      const notes = this.connection.role === "notes";
      const type = notes ? MESSAGE_TYPES.notesSnapshot : MESSAGE_TYPES.snapshot;
      if (event.publisher !== this.connection.hostUserId || event.customType !== type) return;
      if (payload.type !== type || payload.version !== 1) return;
      this.eventTarget.dispatchEvent(new CustomEvent(notes ? "workshop:presentersnapshot" : "workshop:remotesnapshot", { detail: payload.snapshot }));
      return;
    }
    if (payload.version !== 1) return;
    if (event.customType === MESSAGE_TYPES.notesRequest && payload.type === MESSAGE_TYPES.notesRequest) {
      await this.publishNotesSnapshot();
    } else if (this.broadcasting && event.customType === MESSAGE_TYPES.request && payload.type === MESSAGE_TYPES.request) {
      await this.publishSnapshot();
    }
  }

  async requestSnapshot() {
    if (!this.connected || this.connection?.role === "host") return;
    const type = this.connection.role === "notes" ? MESSAGE_TYPES.notesRequest : MESSAGE_TYPES.request;
    await this.client.publish(this.connection.channelName, JSON.stringify({ type, version: 1 }), { customType: type });
  }

  async publishNotesSnapshot() {
    if (!this.connected || this.connection?.role !== "host" || !this.presentation?.getPresenterSnapshot) return;
    await this.client.publish(this.connection.channelName, JSON.stringify({
      type: MESSAGE_TYPES.notesSnapshot, version: 1, snapshot: this.presentation.getPresenterSnapshot()
    }), { customType: MESSAGE_TYPES.notesSnapshot });
  }

  async handlePresence(event) {
    if (this.connected && this.connection?.role === "notes") {
      if (event.channelName !== this.connection.channelName) return;
      const host = this.connection.hostUserId;
      const remoteHost = event.publisher === host;
      const interval = event.eventType === "INTERVAL" ? event.interval : null;
      const absent = (remoteHost && ["REMOTE_LEAVE", "REMOTE_TIMEOUT"].includes(event.eventType))
        || interval?.leave?.users?.includes(host) || interval?.timeout?.users?.includes(host)
        || (event.eventType === "SNAPSHOT" && Array.isArray(event.snapshot) && !event.snapshot.some(user => user.userId === host));
      const joined = (remoteHost && event.eventType === "REMOTE_JOIN") || interval?.join?.users?.includes(host)
        || (event.eventType === "SNAPSHOT" && event.snapshot?.some(user => user.userId === host));
      if (absent) this.onStatus("waiting-for-host");
      if (joined) {
        this.onStatus("waiting-for-slide");
        await this.requestSnapshot();
      }
      return;
    }
    if (!this.connected || this.connection?.role !== "host") return;
    if (event.eventType === "JOIN" || (event.eventType === "INTERVAL" && event.joinedUsers?.length)) {
      await this.publishSnapshot();
      await this.publishNotesSnapshot();
    }
  }

  async renewToken() {
    if (!this.connection || !this.client || this.renewing) return;
    this.renewing = true;
    const client = this.client;
    const connection = this.connection;
    try {
      const credentials = await this.fetchCredentials(connection);
      if (client !== this.client) return;
      if (credentials.userId !== connection.userId || credentials.hostUserId !== connection.hostUserId || credentials.channelName !== connection.channelName) {
        throw new Error("Token renewal did not match the workshop session");
      }
      await client.renewToken(credentials.token);
      this.connection = { ...connection, ...credentials };
    } catch (error) { this.onStatus("error", error); }
    finally { this.renewing = false; }
  }

  async handleStatus(event) {
    const state = String(event?.currentState || event?.state || "");
    const reason = String(event?.reasonCode || event?.reason || "").toLowerCase();
    if (state === "TOKEN_EXPIRED" || reason.includes("token expired") || reason === "token_expired") {
      try {
        const credentials = await this.fetchCredentials(this.connection);
        if (credentials.userId !== this.connection.userId || credentials.hostUserId !== this.connection.hostUserId || credentials.channelName !== this.connection.channelName) {
          throw new Error("Token renewal did not match the workshop session");
        }
        this.connection = { ...this.connection, ...credentials };
        await this.client.login({ token: credentials.token });
        this.onStatus("connected");
        await this.requestSnapshot();
      } catch (error) {
        this.onStatus("error", error);
      }
      return;
    }
    this.onStatus(state.toLowerCase(), event);
    if (state.toLowerCase() === "connected" && this.connected) {
      if (event.unrestoredChannels?.includes(this.connection?.channelName)) {
        await this.client.subscribe(this.connection.channelName, { withMessage: true, withPresence: true });
      }
      await this.requestSnapshot();
    }
  }

  queueSnapshot() {
    if (!this.connected || this.connection?.role !== "host") return;
    clearTimeout(this.snapshotTimer);
    this.snapshotTimer = setTimeout(() => Promise.all([this.publishSnapshot(), this.publishNotesSnapshot()]).catch((error) => this.onStatus("error", error)), 80);
  }

  async publishSnapshot() {
    if (!this.connected || !this.broadcasting || this.connection?.role !== "host") return;
    const payload = {
      type: MESSAGE_TYPES.snapshot,
      version: 1,
      snapshot: this.presentation.getSnapshot()
    };
    await this.client.publish(this.connection.channelName, JSON.stringify(payload), {
      customType: MESSAGE_TYPES.snapshot
    });
  }

  setBroadcasting(enabled) {
    const next = Boolean(enabled);
    if (this.broadcasting === next) return;
    this.broadcasting = next;
    if (this.connection?.role !== "host") return;
    if (next) void this.publishSnapshot();
  }

  async disconnect() {
    clearTimeout(this.snapshotTimer);
    this.eventTarget?.removeEventListener(this.presentation?.stateChangeEvent || "workshop:statechange", this.stateChangeHandler);
    const client = this.client;
    const channelName = this.connection?.channelName;
    this.connected = false;
    this.broadcasting = false;
    this.client = null;
    this.connection = null;
    if (!client) return;
    if (channelName) await client.unsubscribe(channelName).catch(() => {});
    await client.logout().catch(() => {});
    this.onStatus("disconnected");
  }
}
