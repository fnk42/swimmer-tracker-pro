import { createFileRoute } from "@tanstack/react-router";
import { sessionFromRequest } from "@/lib/session";
import html from "../tracker/template.html?raw";

// The performance tracker. Served as a self-contained page rather than as React
// components, because it is a separate piece of work with its own look and its
// own release cadence — editing one HTML file is a shorter loop than threading
// changes through the app's component tree.
//
// The page shell is public; the numbers behind it are not. Data is fetched by
// the page from /api/tracker/data, which requires a coordinator session. A
// signed-out visitor gets the shell and a prompt to sign in, never a name.
export const Route = createFileRoute("/tracker")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const s = sessionFromRequest(request);
        return new Response(html, {
          status: s?.isAdmin ? 200 : 401,
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});
