import { eventEntryMode, eventUrl } from "./event-code.js";
import { eventRequest, setupHostEvents } from "./saved-events.js";
import {
  createWorkshopArchive,
  loadWorkshopArchive,
  saveWorkshopArchive,
  workshopArchiveSummary
} from "./archive.js";
import { getOrCreateAudienceUserId } from "./identity.js";
import { resolveSessionId } from "./session.js";
import { WorkshopSignaling } from "./signaling.js";
import { PRESENTER_CUES, createCueSection } from "./presenter-cues.js";

const presentation = window.workshopPresentation;
const controls = document.getElementById("sessionControls");
const followButton = document.getElementById("followHostButton");
const status = document.getElementById("sessionStatus");
const lastWorkshopPanel = document.getElementById("lastWorkshopPanel");
const lastWorkshopSummary = document.getElementById("lastWorkshopSummary");
const lastWorkshopMeta = document.getElementById("lastWorkshopMeta");
const viewLastWorkshopButton = document.getElementById("viewLastWorkshopButton");
const hostAuthForm = document.getElementById("hostAuthForm");
const hostPasswordInput = document.getElementById("hostPasswordInput");
const hostAuthButton = document.getElementById("hostAuthButton");
const hostAuthError = document.getElementById("hostAuthError");
const isAudience = presentation.mode === "audience";
const audienceUserId = isAudience ? getOrCreateAudienceUserId(localStorage) : "";
let following = true;
let lastRemoteSnapshot = null;
let lastWorkshopArchive = null;
let sessionStarted = false;
let archiveOpen = false;
let hostBroadcasting = true;
const activeSessionId = resolveSessionId(location.search);
const demoCue = document.getElementById("demoCue");
const demoCueLabel = document.getElementById("demoCueLabel");
presentation.setPresenterNotesDecorator((slideId, notesContent) => {
  const cue = PRESENTER_CUES[slideId];
  demoCue.hidden = isAudience || !cue;
  if (!cue || isAudience) return;
  demoCueLabel.textContent = `Demo · ${cue.label}`;
  demoCue.title = `Desktop demo: ${cue.label} · Open presenter notes`;
  demoCue.setAttribute("aria-label", demoCue.title);
  notesContent.prepend(createCueSection(cue, document));
});
demoCue.addEventListener("click", () => {
  if (isAudience) return;
  const drawer = document.getElementById("notesDrawer");
  if (drawer.getAttribute("aria-hidden") === "true") document.getElementById("notesButton").click();
});

if (!isAudience && activeSessionId) {
  const notesUrl = new URL("/host-notes", location.origin);
  notesUrl.searchParams.set("channel", activeSessionId);
  const notesLink = document.getElementById("hostNotesLink");
  notesLink.href = notesUrl.href;
  notesLink.textContent = notesUrl.href;
  const copyNotesLink = document.getElementById("copyHostNotesLink");
  copyNotesLink.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(notesUrl.href);
      copyNotesLink.textContent = "Link copied";
    } catch {
      copyNotesLink.textContent = "Select and copy the link above";
    }
  });
}

const entry = eventEntryMode(location.search);
const savedEventMode = isAudience && entry.mode === "saved";
const joinChoices = document.getElementById("audienceJoinChoices");
const joinActiveButton = document.getElementById("joinActiveButton");
const codeError = document.getElementById("eventCodeError");
let hostEvents;
let authenticatedHostKey = "";

function waiting(title, message) {
  document.getElementById("audienceWaitingTitle").textContent = title;
  document.getElementById("audienceWaitingMessage").textContent = message;
}

function setStatus(value, error) {
  controls.dataset.connection = value;
  if (savedEventMode) {
    status.textContent = archiveOpen ? `Saved event · ${entry.code}` : (value === "error" ? "Event unavailable" : "Loading saved event…");
    return;
  }
  if (isAudience && archiveOpen) {
    status.textContent = sessionStarted ? "Live session available" : "Viewing saved workshop";
    return;
  }
  const labels = {
    idle: isAudience ? "Waiting for session" : "Session not started",
    connecting: "Connecting…",
    connected: isAudience && !sessionStarted
      ? "Waiting for host"
      : (isAudience ? (following ? "Following host" : "Browsing independently") : `${hostBroadcasting ? "Live" : "Paused"} · ${activeSessionId}`),
    reconnecting: "Reconnecting…",
    disconnected: "Disconnected",
    error: error?.message || "Connection failed"
  };
  status.textContent = labels[value] || labels.error;
}

const signaling = new WorkshopSignaling({ presentation, onStatus: setStatus });

function renderHostBroadcastControl() {
  if (isAudience) return;
  if (!signaling.connected) {
    status.textContent = "Session not started";
    status.title = "Live audience sync is not connected.";
    status.setAttribute("aria-label", status.title);
    status.setAttribute("aria-pressed", "false");
    return;
  }
  status.textContent = hostBroadcasting ? `Live · ${activeSessionId}` : `Paused · ${activeSessionId}`;
  status.title = hostBroadcasting
    ? "Live audience sync is on. Click to pause broadcasting."
    : "Audience sync is paused. Click to resume broadcasting.";
  status.setAttribute("aria-label", status.title);
  status.setAttribute("aria-pressed", String(hostBroadcasting));
}

function renderFollowButton() {
  followButton.setAttribute("aria-pressed", String(following));
  if (archiveOpen) {
    followButton.textContent = lastRemoteSnapshot ? "Return to live" : "Check live session";
    followButton.title = lastRemoteSnapshot
      ? "A live session is available. Activate to follow the host."
      : "Activate to check for the live session.";
    followButton.setAttribute("aria-label", followButton.title);
    return;
  }
  followButton.textContent = following ? "Following host" : "Return to live";
  followButton.title = following
    ? "Following the host. Activate to browse independently."
    : "Browsing independently. Activate to return to the live slide.";
  followButton.setAttribute("aria-label", followButton.title);
}

function renderLastWorkshop(archive) {
  if (!archive) return;
  const savedAt = new Date(archive.savedAt);
  lastWorkshopSummary.textContent = workshopArchiveSummary(archive);
  lastWorkshopMeta.textContent = `Saved ${savedAt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
  lastWorkshopPanel.hidden = false;
}

async function connectHost(hostKey) {
  if (!activeSessionId) return setStatus("error", new Error("Invalid channel override"));
  hostAuthButton.disabled = true;
  hostAuthButton.textContent = "Connecting…";
  hostAuthError.textContent = "";
  try {
    await eventRequest("?auth=1", { hostKey });
    authenticatedHostKey = hostKey;
    sessionStorage.setItem("workshop-host-key", hostKey);
    document.body.classList.add("host-authenticated");
    hostPasswordInput.value = "";
    hostEvents ||= setupHostEvents({
      presentation,
      getHostKey: () => authenticatedHostKey,
      // Loading saved settings ends the live RTM session. The ordinary status
      // toggle below only pauses audience snapshots; phone notes keep following.
      pauseLive: async () => {
        hostBroadcasting = false;
        signaling.setBroadcasting(false);
        await signaling.disconnect();
        status.textContent = "Editing saved event";
        status.title = "Live sharing is paused. Use settings live to reconnect.";
        status.setAttribute("aria-label", status.title);
        status.setAttribute("aria-pressed", "false");
      },
      goLive: async () => {
        await signaling.connect({ sessionId: activeSessionId, role: "host", hostKey: authenticatedHostKey });
        hostBroadcasting = true;
        renderHostBroadcastControl();
      }
    });
    await hostEvents.initialize();
    if (!new URLSearchParams(location.search).has("code")) {
      try {
        await signaling.connect({ sessionId: activeSessionId, role: "host", hostKey });
      } catch (error) { setStatus("error", error); }
    }
  } catch (error) {
    if (error.status === 401) {
      sessionStorage.removeItem("workshop-host-key");
      hostAuthError.textContent = "That workshop password is incorrect.";
    } else {
      hostAuthError.textContent = error.message || "Unable to open the host view.";
    }
    setStatus("error", error);
  } finally {
    hostAuthButton.disabled = false;
    hostAuthButton.textContent = "Continue as host";
  }
}

async function connectAudience() {
  if (savedEventMode) return;
  if (!activeSessionId) return setStatus("error", new Error("Invalid channel override"));
  try {
    await signaling.connect({ sessionId: activeSessionId, role: "audience", userId: audienceUserId });
  } catch (error) {
    setStatus("error", error);
  }
}

followButton.addEventListener("click", () => {
  if (savedEventMode) return;
  if (archiveOpen) {
    if (!signaling.connected) {
      joinActiveButton.click();
      return;
    }
    archiveOpen = false;
    following = true;
    document.body.classList.remove("archive-open", "audience-browsing");
    presentation.setAudienceHashEnabled(false);
    if (lastRemoteSnapshot) {
      presentation.applySnapshot(lastRemoteSnapshot);
      document.body.classList.add("session-started");
      followButton.hidden = false;
    } else {
      sessionStarted = false;
      document.body.classList.remove("session-started");
      followButton.hidden = true;
    }
    renderFollowButton();
    setStatus(signaling.connected ? "connected" : "disconnected");
    return;
  }
  following = !following;
  document.body.classList.toggle("audience-browsing", !following);
  if (following && lastRemoteSnapshot) presentation.applySnapshot(lastRemoteSnapshot);
  renderFollowButton();
  setStatus("connected");
});

viewLastWorkshopButton.addEventListener("click", () => {
  if (!lastWorkshopArchive) return;
  archiveOpen = true;
  following = false;
  document.body.classList.add("archive-open", "audience-browsing");
  presentation.setAudienceHashEnabled(true);
  presentation.applyArchivedSnapshot(lastWorkshopArchive.snapshot);
  followButton.hidden = false;
  renderFollowButton();
  setStatus("connected");
});

window.addEventListener("workshop:remotesnapshot", (event) => {
  if (savedEventMode) return;
  lastRemoteSnapshot = event.detail;
  sessionStarted = true;
  document.body.classList.add("session-started");
  const archive = createWorkshopArchive(activeSessionId, lastRemoteSnapshot);
  if (archive && saveWorkshopArchive(localStorage, archive)) {
    lastWorkshopArchive = archive;
    renderLastWorkshop(archive);
  }
  followButton.hidden = false;
  renderFollowButton();
  setStatus("connected");
  if (following) presentation.applySnapshot(lastRemoteSnapshot);
});

status.addEventListener("click", () => {
  if (isAudience || !signaling.connected) return;
  hostBroadcasting = !hostBroadcasting;
  signaling.setBroadcasting(hostBroadcasting);
  renderHostBroadcastControl();
});

function blockAudienceNavigation(event) {
  if (!isAudience || !signaling.connected || !following) return;
  const navigationKey = ["ArrowRight", "ArrowLeft", "PageDown", "PageUp", " "].includes(event.key);
  const navigationControl = event.target?.closest?.(".nav-zone, [data-workshop-stage], #workspaceStartButton, [data-code-scope]");
  if (!navigationKey && !navigationControl) return;
  event.preventDefault();
  event.stopImmediatePropagation();
}

document.addEventListener("keydown", blockAudienceNavigation, true);
document.addEventListener("click", blockAudienceNavigation, true);
window.addEventListener("pagehide", () => { void signaling.disconnect(); });

hostAuthForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void connectHost(hostPasswordInput.value);
});

document.getElementById("eventCodeForm").addEventListener("submit", event => {
  event.preventDefault();
  try { location.assign(eventUrl(location.href, document.getElementById("eventCodeInput").value)); }
  catch (error) { codeError.textContent = error.message; }
});
joinActiveButton.addEventListener("click", () => {
  const url = new URL(location.href);
  url.searchParams.delete("code");
  url.searchParams.set("join", "active");
  url.hash = "";
  location.assign(url.href);
});

async function loadSavedEvent() {
  followButton.hidden = true;
  lastWorkshopPanel.hidden = true;
  joinChoices.hidden = true;
  waiting("Loading your workshop…", "Fetching the saved settings for this event.");
  setStatus("connecting");
  try {
    if (!entry.code) throw new Error("Enter a six-digit event code, such as 482-193.");
    const { event } = await eventRequest(`?code=${entry.code}`);
    const slideHash = decodeURIComponent(location.hash.replace(/^#slide-/, ""));
    presentation.setAudienceHashEnabled(true);
    if (!presentation.loadSavedEvent(event.snapshot)) throw new Error("This saved event could not be loaded.");
    if (slideHash) presentation.goToSlideId(slideHash);
    archiveOpen = true;
    following = false;
    document.body.classList.add("archive-open", "audience-browsing");
    document.title = `${event.name} · Agora Workshop`;
    setStatus("connected");
  } catch (error) {
    waiting("We couldn’t open this event", "Check the code below, or join the active workshop.");
    codeError.textContent = error.message;
    document.getElementById("eventCodeInput").value = entry.code || "";
    joinChoices.hidden = false;
    setStatus("error", error);
  }
}

if (isAudience) {
  followButton.hidden = true;
  if (savedEventMode) {
    void loadSavedEvent();
  } else {
    lastWorkshopArchive = loadWorkshopArchive(localStorage);
    renderLastWorkshop(lastWorkshopArchive);
    if (entry.mode === "live") {
      waiting("The session hasn’t started yet.", "Keep this page open. The workshop will appear when the host connects.");
      joinActiveButton.hidden = true;
      if (!activeSessionId) {
        waiting("This workshop link is invalid.", "Open the main workshop URL, or ask the host for the correct link.");
      }
      void connectAudience();
    } else {
      status.textContent = "Choose a workshop";
    }
  }
} else {
  followButton.hidden = true;
  status.setAttribute("role", "button");
  renderHostBroadcastControl();
  const savedHostKey = sessionStorage.getItem("workshop-host-key");
  if (savedHostKey) void connectHost(savedHostKey);
}
