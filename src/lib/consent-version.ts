// The consent document's version, on its own so both sides can import it.
//
// src/lib/scope.ts is server-only — it pulls in the pg pool — so a client
// component cannot import the version from there without dragging a database
// driver into the browser bundle.
//
// Bump this when the words in ConsentText change. Guardians who accepted an
// older version are asked to accept the new one before they reach the
// dashboard, and their earlier acceptance stays on record.
export const CONSENT_VERSION = "2026-09-17";
export const CONSENT_DOCUMENT = "guardian_data_consent";
