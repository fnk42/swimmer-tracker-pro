import * as Sentry from "@sentry/node";

// Error reporting, so a broken page is known about before a parent says so.
//
// OFF UNLESS CONFIGURED. With no SENTRY_DSN set — local work, and any
// deployment where it has not been added — every call here is a no-op. Nothing
// is sent and nothing fails.
//
// WHAT IS STRIPPED BEFORE ANYTHING LEAVES. This app holds children's names and
// their guardians' email addresses, and the consent document is explicit about
// what leaves NextGen. So sending is deliberately narrow:
//
//   sendDefaultPii  off, so no IP address and no cookies
//   request bodies  dropped entirely — a registration body is a child's name
//                   and a parent's phone number
//   headers         only the method and the route; no cookie, no auth header
//   query strings   dropped, because ours carry swimmer names
//   user            never set
//
// What Sentry receives is a stack trace, the route it happened on, and the
// release. If a message still contains an address, the scrubber below catches
// anything shaped like an email as a last line of defence.

let ready = false;

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const scrub = (s: string) => s.replace(EMAIL, "[email]");

export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn || ready) return;
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "production",
    release: process.env.GIT_SHA,
    sendDefaultPii: false,
    tracesSampleRate: 0,          // errors only; no performance data
    beforeSend(event) {
      if (event.request) {
        // Keep the route, drop everything that could carry a name.
        event.request = { method: event.request.method, url: event.request.url?.split("?")[0] };
      }
      delete event.user;
      if (event.message) event.message = scrub(event.message);
      for (const ex of event.exception?.values ?? []) {
        if (ex.value) ex.value = scrub(ex.value);
      }
      return event;
    },
  });
  ready = true;
}

/** Report a server-side error. Silent when Sentry is not configured. */
export function report(where: string, err: unknown): void {
  if (!process.env.SENTRY_DSN) return;
  initSentry();
  try {
    Sentry.withScope((scope) => {
      scope.setTag("where", where);
      Sentry.captureException(err);
    });
  } catch {
    // Reporting an error must never become one.
  }
}
