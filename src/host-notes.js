import { WorkshopSignaling } from './signaling.js';
import { resolveSessionId, normalizeSessionId } from './session.js';
import { sanitizeNotes, isPresenterSnapshot } from './notes-content.js';

const el = (id) => document.getElementById(id);
let connection;
let busy = false;
let currentSlide = '';
el('channel').value = resolveSessionId(location.search) || '';
const signaling = new WorkshopSignaling({
  presentation: null,
  onStatus(status, error) {
    if (status === 'error' && error?.status === 401) {
      el('join').hidden = false;
      el('reconnect').hidden = true;
      el('error').textContent = 'Enter the host password again to reconnect.';
      connection = null;
    }
    const labels = { connecting: 'Connecting…', connected: 'Connected · waiting for current slide', disconnected: 'Disconnected · notes may be out of date', reconnecting: 'Reconnecting… · notes may be out of date' };
    el('status').textContent = labels[status] || (status === 'error' ? `Connection error: ${error?.message || 'Reconnect to try again'} · notes may be out of date` : `${status} · notes may be out of date`);
  }
});

async function connect() {
  if (busy || !connection) return;
  busy = true;
  el('error').textContent = '';
  try {
    const credentials = await signaling.connect(connection);
    connection.userId = credentials.userId;
    el('join').hidden = true;
    el('key').value = '';
    el('companion').hidden = false;
    el('reconnect').hidden = false;
  } catch (error) {
    if (error.status === 401) {
      el('join').hidden = false;
      el('reconnect').hidden = true;
      connection = null;
      el('key').focus();
    }
    el('error').textContent = error.message;
    el('status').textContent = `Unable to connect: ${error.message}${currentSlide ? ' · notes may be out of date' : ''}`;
  } finally { busy = false; }
}

el('join').addEventListener('submit', (event) => {
  event.preventDefault();
  const sessionId = normalizeSessionId(el('channel').value);
  if (!sessionId) { el('error').textContent = 'Enter the same channel as the host presentation.'; return; }
  connection = { sessionId, role: 'notes', hostKey: el('key').value };
  void connect();
});
el('reconnect').addEventListener('click', () => void connect());
window.addEventListener('workshop:presentersnapshot', ({ detail }) => {
  if (!isPresenterSnapshot(detail)) return;
  const changed = currentSlide !== detail.slideId;
  currentSlide = detail.slideId;
  el('status').textContent = 'Connected · following host';
  el('position').textContent = `Slide ${detail.position} of ${detail.total}`;
  el('title').textContent = detail.title;
  el('timing').textContent = typeof detail.timing === 'string' ? detail.timing : '';
  el('notes').replaceChildren(sanitizeNotes(detail.notesHtml, document));
  el('next').textContent = detail.nextTitle ? `Next: ${detail.nextTitle}` : 'Final slide';
  if (changed) window.scrollTo({ top: 0 });
});
// Mobile browsers suspend connections in the background. Rejoin with the same
// notes identity and ask for the current slide when returning to this page.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && connection) void connect();
});
window.addEventListener('online', () => { if (connection) void connect(); });
