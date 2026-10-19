import { createFileRoute, redirect } from "@tanstack/react-router";

// The coaches' door (Felix, 19 Oct 2026). The same emailed-code sign-in as
// parents, worded for coaches and open only to COACH_EMAILS and the admins
// (request-code refuses anyone else before a code is made), landing on the
// Coaches tab.
export const Route = createFileRoute("/coach")({
  beforeLoad: () => {
    throw redirect({ href: "/?coach=1&next=%2Ftracker%23%2Fcoaches" });
  },
});
