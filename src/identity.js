export const AUDIENCE_USER_ID_KEY = "agora-workshop-audience-user-id-v1";

const AUDIENCE_USER_ID_PATTERN = /^audience-[a-f0-9]{24}$/;

export function isAudienceUserId(value) {
  return typeof value === "string" && AUDIENCE_USER_ID_PATTERN.test(value);
}

export function createAudienceUserId(randomUUID = () => globalThis.crypto.randomUUID()) {
  const suffix = randomUUID().replaceAll("-", "").toLowerCase().slice(0, 24);
  const userId = `audience-${suffix}`;
  if (!isAudienceUserId(userId)) throw new Error("Unable to create audience identity");
  return userId;
}

export function getOrCreateAudienceUserId(storage, randomUUID) {
  try {
    const savedUserId = storage.getItem(AUDIENCE_USER_ID_KEY);
    if (isAudienceUserId(savedUserId)) return savedUserId;
  } catch {}

  const userId = createAudienceUserId(randomUUID);
  try { storage.setItem(AUDIENCE_USER_ID_KEY, userId); } catch {}
  return userId;
}

export function isNotesUserId(value) {
  return typeof value === "string" && /^notes-[a-f0-9]{24}$/.test(value);
}

export function createNotesUserId(randomUUID = () => globalThis.crypto.randomUUID()) {
  return createAudienceUserId(randomUUID).replace("audience-", "notes-");
}
