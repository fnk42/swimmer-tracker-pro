import * as Sentry from "@sentry/react";

// The browser half. Same rules as src/lib/sentry.ts: off unless a DSN is
// configured, and nothing that could carry a name is sent.
//
// A query string here can hold a swimmer's name, so URLs are truncated at the
// "?" before anything is sent, and the scrubber catches anything shaped like
// an email address in a message.

let ready = false;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

function start(): boolean {
  if (!dsn) return false;
  if (ready) return true;
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    replaysOnErrorSampleRate: 0,   // a session replay of this app is a child's record
    beforeSend(event) {
      delete event.user;
      if (event.request) {
        event.request = { url: event.request.url?.split("?")[0] };
      }
      const s = (t?: string) => (t ? t.replace(EMAIL, "[email]") : t);
      if (event.message) event.message = s(event.message)!;
      for (const ex of event.exception?.values ?? []) if (ex.value) ex.value = s(ex.value)!;
      return event;
    },
  });
  ready = true;
  return true;
}

/** Report a browser error. Silent when Sentry is not configured. */
export function reportClient(err: unknown, where: string): void {
  if (!start()) return;
  try {
    Sentry.withScope((scope) => {
      scope.setTag("where", where);
      // Same reason as the server: the list should say which screen, not just
      // "error".
      scope.setTransactionName(where);
      Sentry.captureException(err);
    });
  } catch {
    // Reporting an error must never become one.
  }
}
