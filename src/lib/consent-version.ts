// The consent document's version, on its own so both sides can import it.
//
// src/lib/scope.ts is server-only — it pulls in the pg pool — so a client
// component cannot import the version from there without dragging a database
// driver into the browser bundle.
//
// Bump this when the words in ConsentText change. Guardians who accepted an
// older version are asked to accept the new one before they reach the
// dashboard, and their earlier acceptance stays on record.
// 2026-09-18: added the coaching assistant, which is the first time any of
// this data leaves NextGen. The previous version promised parents we would not
// "share it with anyone outside NextGen", so that promise had to change before
// a single record could be sent anywhere. Everyone re-accepts.
export const CONSENT_VERSION = "2026-09-18";
export const CONSENT_DOCUMENT = "guardian_data_consent";
