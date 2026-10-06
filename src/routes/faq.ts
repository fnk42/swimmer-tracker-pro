import { createFileRoute } from "@tanstack/react-router";
import html from "../tracker/faq.html?raw";

// The questions behind the analytics, in plain words. Static and public: it
// holds no swimmer data, so a parent can read it before signing in, and each
// info button on the analytics links to its own question (/faq#rated).
export const Route = createFileRoute("/faq")({
  server: {
    handlers: {
      GET: async () =>
        new Response(html, {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "public, max-age=300",
          },
        }),
    },
  },
});
