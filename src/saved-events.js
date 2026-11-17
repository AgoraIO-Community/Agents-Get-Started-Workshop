import { eventUrl, normalizeEventCode } from "./event-code.js";
import { createWorkshopArchive } from "./archive.js";

export async function eventRequest(query = "", { method = "GET", hostKey, body } = {}) {
  const response = await fetch(`/api/events${query}`, {
    method, cache: "no-store",
    headers: { ...(hostKey ? { "x-workshop-host-key": hostKey } : {}), ...(body ? { "content-type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error || "Unable to load event. Please try again.");
    error.status = response.status;
    throw error;
  }
  return result;
}

export function setupHostEvents({ presentation, getHostKey, pauseLive, goLive }) {
  const el = id => document.getElementById(id);
  const name = el("savedEventName");
  const select = el("savedEventSelect");
  const message = el("savedEventStatus");
  let current = null;
  let etag = null;
  let savedPayload = "";
  let timer;
  let busy = false;
  let applying = false;
  let conflict = false;
  let cursor = null;
  const buttons = ["newEventButton", "saveEventButton", "openEventButton", "openEventCodeButton", "eventGoLiveButton"];
  const payload = () => ({ name: name.value.trim(), snapshot: createWorkshopArchive("saved-event", presentation.getSnapshot())?.snapshot });
  const tell = (text, failed = false) => { message.textContent = text; message.dataset.error = String(failed); };
  const lock = value => {
    busy = value;
    buttons.forEach(id => { el(id).disabled = value || (id === "saveEventButton" && (!current || conflict)); });
  };
  function share() {
    el("savedEventShare").hidden = !current;
    if (!current) return;
    let option = Array.from(select.options).find(item => item.value === current.code);
    if (!option) { option = new Option("", current.code); select.add(option); }
    option.textContent = `${current.code} · ${current.name}`;
    select.value = current.code;
    el("hostEventCodeInput").value = current.code;
    const url = eventUrl(location.href, current.code);
    el("savedEventCode").textContent = current.code;
    el("savedEventLink").textContent = url;
    el("savedEventLink").href = url;
    const hostUrl = new URL(location.href);
    hostUrl.searchParams.set("code", current.code);
    history.replaceState(null, "", hostUrl);
  }
  async function refresh(append = false) {
    try {
      const result = await eventRequest(append && cursor ? `?cursor=${encodeURIComponent(cursor)}` : "", { hostKey: getHostKey() });
      if (!append) select.replaceChildren(new Option("Choose an event", ""));
      result.events.forEach(event => {
        if (Array.from(select.options).some(option => option.value === event.code)) return;
        select.add(new Option(`${event.code} · ${new Date(event.updatedAt).toLocaleDateString()}`, event.code));
      });
      cursor = result.cursor;
      el("moreEventsButton").hidden = !cursor;
      if (current) share();
    } catch (error) { tell(error.message, true); }
  }
  async function save() {
    clearTimeout(timer);
    if (!current || busy || applying || conflict) return false;
    const data = payload();
    if (JSON.stringify(data) === savedPayload) return true;
    lock(true);
    tell("Saving changes…");
    try {
      const result = await eventRequest(`?code=${current.code}`, { method: "PUT", hostKey: getHostKey(), body: { ...data, etag } });
      current = result.event;
      etag = result.etag;
      savedPayload = JSON.stringify(data);
      share();
      tell(`Saved ${current.code}. Attendees opening the link will get these settings.`);
      return true;
    } catch (error) {
      conflict = error.status === 409;
      tell(error.message + (conflict ? " Your local edits are still visible." : " Your edits are not saved. Use Save changes to retry."), true);
      return false;
    } finally {
      lock(false);
      if (!conflict && JSON.stringify(payload()) !== savedPayload && message.dataset.error !== "true") schedule();
    }
  }
  function schedule() {
    if (!current || applying || conflict) return;
    clearTimeout(timer);
    if (JSON.stringify(payload()) === savedPayload) return;
    tell("Unsaved changes…");
    timer = setTimeout(() => { void save(); }, 700);
  }
  async function open(code) {
    code = normalizeEventCode(code);
    if (!code) return tell("Enter a six-digit event code, such as 482-193.", true);
    if (busy) return;
    clearTimeout(timer);
    // Reopening the same event is the explicit recovery action for a version conflict.
    if (current && code !== current.code && !(await save())) return;
    lock(true);
    tell("Loading event…");
    try {
      const result = await eventRequest(`?code=${code}`);
      await pauseLive();
      applying = true;
      if (!presentation.loadSavedEvent(result.event.snapshot)) throw new Error("This event contains invalid workshop settings.");
      current = result.event;
      etag = result.etag;
      conflict = false;
      name.value = current.name;
      savedPayload = JSON.stringify(payload());
      share();
      select.value = code;
      tell(`Editing ${code}. Live sharing is paused. Changes save automatically.`);
    } catch (error) { tell(error.message, true); }
    finally { applying = false; lock(false); }
  }
  async function create() {
    if (busy) return;
    clearTimeout(timer);
    const data = payload();
    if (!data.name) return tell("Enter a name for the new event.", true);
    lock(true);
    tell("Creating event…");
    try {
      const result = await eventRequest("", { method: "POST", hostKey: getHostKey(), body: data });
      current = result.event;
      etag = result.etag;
      conflict = false;
      savedPayload = JSON.stringify(data);
      share();
      tell(`Created ${current.code}. Share the link for a workshop people can revisit.`);
      await refresh();
    } catch (error) { tell(error.message, true); }
    finally { lock(false); if (current && JSON.stringify(payload()) !== savedPayload) schedule(); }
  }
  el("newEventButton").addEventListener("click", () => { void create(); });
  el("saveEventButton").addEventListener("click", () => { void save(); });
  el("openEventButton").addEventListener("click", () => { void open(select.value); });
  el("openEventCodeButton").addEventListener("click", () => { void open(el("hostEventCodeInput").value); });
  el("refreshEventsButton").addEventListener("click", () => { void refresh(); });
  el("moreEventsButton").addEventListener("click", () => { void refresh(true); });
  el("eventGoLiveButton").addEventListener("click", () => { void goLive().catch(error => tell(error.message, true)); });
  el("copyEventLinkButton").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(el("savedEventLink").href); tell("Event link copied."); }
    catch { tell("Select and copy the event link above."); }
  });
  name.addEventListener("input", schedule);
  window.addEventListener(presentation.stateChangeEvent, schedule);
  window.addEventListener("beforeunload", event => {
    if (current && JSON.stringify(payload()) !== savedPayload) { event.preventDefault(); event.returnValue = ""; }
  });
  return {
    async initialize() {
      await refresh();
      const params = new URLSearchParams(location.search);
      if (params.has("code")) await open(params.get("code"));
    }
  };
}
