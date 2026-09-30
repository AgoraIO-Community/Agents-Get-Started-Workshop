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

function setStatus(value, error) {
  controls.dataset.connection = value;
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
    await signaling.connect({
      sessionId: activeSessionId,
      role: "host",
      hostKey
    });
    sessionStorage.setItem("workshop-host-key", hostKey);
    document.body.classList.add("host-authenticated");
    hostPasswordInput.value = "";
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
  if (!activeSessionId) return setStatus("error", new Error("Invalid channel override"));
  try {
    await signaling.connect({ sessionId: activeSessionId, role: "audience", userId: audienceUserId });
  } catch (error) {
    setStatus("error", error);
  }
}

followButton.addEventListener("click", () => {
  if (archiveOpen) {
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

if (isAudience) {
  lastWorkshopArchive = loadWorkshopArchive(localStorage);
  renderLastWorkshop(lastWorkshopArchive);
  if (!activeSessionId) {
    document.getElementById("audienceWaitingTitle").textContent = "This workshop link is invalid.";
    document.getElementById("audienceWaitingMessage").textContent = "Open the main workshop URL, or ask the host for the correct link.";
  }
  void connectAudience();
} else {
  followButton.hidden = true;
  status.setAttribute("role", "button");
  renderHostBroadcastControl();
  const savedHostKey = sessionStorage.getItem("workshop-host-key");
  if (savedHostKey) void connectHost(savedHostKey);
}
