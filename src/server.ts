import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}


// ---------------------------------------------------------------------------
// Two public hostnames, one deployment.
//
//   events.nextgenkenya.com       the Machakos event portal, landing on "/"
//   performance.nextgenkenya.com  the performance analytics, landing on "/tracker"
//
// Matching is on the leading label only, so the preview deployments, the old
// machakosnationals2026 host and localhost all keep their current behaviour and
// nothing breaks while DNS is still moving.
//
// Sessions stay scoped to the host that issued them: the cookie is deliberately
// NOT widened to .nextgenkenya.com, because the apex runs on Bluehost and a
// wildcard cookie would be sent to that server on every request.
const PERFORMANCE_HOST = /^performance\./i;
const EVENTS_HOST = /^events\./i;

function routeByHost(request: Request): Request | Response | null {
  const url = new URL(request.url);
  const host = request.headers.get("host") ?? url.host;

  if (PERFORMANCE_HOST.test(host) && url.pathname === "/") {
    url.pathname = "/tracker";
    return new Request(url, request);
  }

  // The analytics has its own home now; keep the old path working by sending it
  // there rather than serving the same page on two addresses.
  if (EVENTS_HOST.test(host) && url.pathname === "/tracker") {
    const target = `https://${host.replace(EVENTS_HOST, "performance.")}/`;
    return new Response(null, { status: 302, headers: { location: target } });
  }

  return null;
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const routed = routeByHost(request);
      if (routed instanceof Response) return routed;

      const handler = await getServerEntry();
      const response = await handler.fetch(routed ?? request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
