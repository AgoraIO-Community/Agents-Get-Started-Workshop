import { validHostKey } from "../server/host-auth.js";
import crypto from "node:crypto";
import AgoraToken from "agora-token";
import { createAudienceUserId, isAudienceUserId, createNotesUserId, isNotesUserId } from "../src/identity.js";
import { channelNameForSession, normalizeSessionId } from "../src/session.js";

const { RtmTokenBuilder } = AgoraToken;
const TOKEN_TTL_SECONDS = 60 * 60;
export function createTokenResponse({ sessionId, role, hostKey, userId: requestedUserId }, env = process.env, randomUUID = crypto.randomUUID) {
  const normalized = normalizeSessionId(sessionId);
  if (!normalized) return { status: 400, body: { error: "Invalid workshop session" } };
  if (role !== "host" && role !== "audience" && role !== "notes") return { status: 400, body: { error: "Invalid workshop role" } };

  const appId = env.AGORA_APP_ID;
  const appCertificate = env.AGORA_APP_CERTIFICATE;
  if (!appId || !appCertificate) return { status: 503, body: { error: "Agora environment is not configured" } };

  if (role === "host" || role === "notes") {
    if (!validHostKey(hostKey, env)) {
      return { status: 401, body: { error: "Invalid host key" } };
    }
  } else if (requestedUserId && !isAudienceUserId(requestedUserId)) {
    return { status: 400, body: { error: "Invalid audience user ID" } };
  }

  if (role === "notes" && requestedUserId && !isNotesUserId(requestedUserId)) {
    return { status: 400, body: { error: "Invalid notes user ID" } };
  }

  const channelName = channelNameForSession(normalized);
  const hostUserId = `host-${normalized}`;
  const userId = role === "host" ? hostUserId : (requestedUserId || (role === "notes" ? createNotesUserId(randomUUID) : createAudienceUserId(randomUUID)));
  const token = RtmTokenBuilder.buildToken(appId, appCertificate, userId, TOKEN_TTL_SECONDS);

  return {
    status: 200,
    body: {
      appId,
      token,
      userId,
      hostUserId,
      channelName,
      expiresIn: TOKEN_TTL_SECONDS
    }
  };
}

export default async function handler(request, response) {
  response.setHeader("cache-control", "no-store");
  if (request.method !== "POST") {
    response.setHeader("allow", "POST");
    return response.status(405).json({ error: "Method not allowed" });
  }

  const result = createTokenResponse(request.body || {});
  return response.status(result.status).json(result.body);
}
