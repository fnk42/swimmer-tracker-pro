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
// 2026-09-22: the same disclosure, said generically. Naming the supplier told
// parents more about our contracts than about their child, and tied the
// document to a vendor we may change. What is promised is unchanged and no
// weaker: data still leaves NextGen only for analysis that helps the child,
// still goes outside Kenya, still may not be used for the provider's own
// purposes or kept, and can still be declined on its own. A different
// vendor now needs no new consent; a different PURPOSE still would.
export const CONSENT_VERSION = "2026-09-22";
export const CONSENT_DOCUMENT = "guardian_data_consent";
