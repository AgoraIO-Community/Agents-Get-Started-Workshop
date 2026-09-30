import { eventStore } from "../server/event-store.js";
import { handleEvents } from "../server/events.js";

export default async function handler(request, response) {
  response.setHeader("cache-control", "no-store");
  response.setHeader("allow", "GET, POST, PUT");
  const result = await handleEvents({
    method: request.method,
    query: new URL(request.url, "http://localhost").searchParams,
    hostKey: request.headers["x-workshop-host-key"],
    body: request.body
  }, { store: eventStore });
  return response.status(result.status).json(result.body);
}
