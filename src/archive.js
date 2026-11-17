export const WORKSHOP_ARCHIVE_KEY = "agora-workshop-last-session-v1";

const ARCHIVE_VERSION = 1;
const SAFE_CONFIG_KEYS = Object.freeze([
  "eventDate",
  "doorsTime",
  "workshopTime",
  "joinLink",
  "city",
  "template",
  "track",
  "packageManager",
  "sttProvider",
  "llmProvider",
  "ttsProvider",
  "theme",
  "terminalEnvironment"
]);

const LABELS = Object.freeze({
  city: { sf: "San Francisco", nyc: "New York" },
  track: { python: "Python", nextjs: "Next.js", go: "Go" },
  packageManager: { pnpm: "pnpm", bun: "Bun", make: "Make" }
});
const PACKAGE_MANAGER_BY_TRACK = Object.freeze({ python: "bun", nextjs: "pnpm", go: "make" });

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function createWorkshopArchive(sessionId, snapshot, savedAt = new Date()) {
  if (typeof sessionId !== "string" || !sessionId || !isRecord(snapshot) || snapshot.version !== 1 || !isRecord(snapshot.config)) {
    return null;
  }

  const config = {};
  for (const key of SAFE_CONFIG_KEYS) {
    if (typeof snapshot.config[key] === "string") config[key] = snapshot.config[key];
  }
  if (!config.city || !config.track || !PACKAGE_MANAGER_BY_TRACK[config.track]) return null;
  config.packageManager = PACKAGE_MANAGER_BY_TRACK[config.track];

  return {
    version: ARCHIVE_VERSION,
    sessionId,
    savedAt: savedAt.toISOString(),
    snapshot: {
      version: 1,
      slideId: "welcome",
      config
    }
  };
}

export function saveWorkshopArchive(storage, archive) {
  if (!archive) return false;
  try {
    storage.setItem(WORKSHOP_ARCHIVE_KEY, JSON.stringify(archive));
    return true;
  } catch {
    return false;
  }
}

export function loadWorkshopArchive(storage) {
  try {
    const archive = JSON.parse(storage.getItem(WORKSHOP_ARCHIVE_KEY));
    if (
      !isRecord(archive) ||
      archive.version !== ARCHIVE_VERSION ||
      typeof archive.sessionId !== "string" ||
      typeof archive.savedAt !== "string" ||
      !isRecord(archive.snapshot) ||
      archive.snapshot.version !== 1 ||
      archive.snapshot.slideId !== "welcome" ||
      !isRecord(archive.snapshot.config)
    ) return null;
    return createWorkshopArchive(archive.sessionId, archive.snapshot, new Date(archive.savedAt));
  } catch {
    return null;
  }
}

export function workshopArchiveSummary(archive) {
  const config = archive?.snapshot?.config || {};
  return [
    LABELS.city[config.city] || config.city,
    LABELS.track[config.track] || config.track,
    LABELS.packageManager[config.packageManager] || config.packageManager
  ].filter(Boolean).join(" · ");
}
