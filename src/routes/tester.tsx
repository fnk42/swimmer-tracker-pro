import { createFileRoute, redirect } from "@tanstack/react-router";

// The preview's own front door, now closed.
//
// Testers had a door of their own: a separate registration, an agreement and a
// tester-only account. Every parent now comes in the same way — sign in, say
// who you are and whose parent you are on /welcome, then Analytics — so this
// address only forwards to the one door. It stays because it is the link the
// testers were sent (Felix, 27 Sep 2026).
export const Route = createFileRoute("/tester")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
