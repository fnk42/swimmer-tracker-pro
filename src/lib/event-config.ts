// Central config for the NextGen Swim Club payment tracker MVP.
// Everything here is meant to be edited in one place when handing off.

export const EVENT = {
  clubName: "NextGen Swim Club",
  name: "Swimming Nationals",
  location: "Machakos County",
  startDate: "Fri 15 Aug 2026",
  endDate: "Sun 17 Aug 2026",
  totalKes: 20_000,
} as const;

export const AUTH = {
  username: "nextgen",
  password: "swim2026",
} as const;

export const CONVENER = {
  name: "NextGen Convener",
  email: "convener@nextgenswim.example",
  phone: "+254 700 000 000",
} as const;

// Seed roster used on first load. Admin can add/import/rename/delete.
export const SEED_SWIMMERS: { name: string; age?: number; gender?: "Male" | "Female" }[] = [
  { name: "Aisha Kariuki", age: 12, gender: "Female" },
  { name: "Brian Mwangi", age: 13, gender: "Male" },
  { name: "Chloe Otieno", age: 11, gender: "Female" },
  { name: "David Njoroge", age: 14, gender: "Male" },
  { name: "Esther Wambui", age: 12, gender: "Female" },
  { name: "Faisal Hassan", age: 13, gender: "Male" },
  { name: "Grace Achieng", age: 10, gender: "Female" },
  { name: "Hakim Yusuf", age: 15, gender: "Male" },
  { name: "Imani Wanjiku", age: 12, gender: "Female" },
  { name: "Jomo Kimani", age: 13, gender: "Male" },
];

export const TERMS_TEXT = `NextGen Swim Club — Swimming Nationals, Machakos County
Rules & expectations for the trip

By ticking the box below, I confirm on behalf of my swimmer and our family that we have read, understood, and agreed to the following:

1. Arrival & departure. All team members travel to and from Machakos together. No independent arrivals or early pickups except by prior arrangement with the convener.

2. Timekeeping. Swimmers must be ready at all published call times — for meals, warm-ups, races, and team meetings. Repeated lateness affects the whole team.

3. Cellphones during the sleepover. Cellphones will be collected and stored securely once swimmers are in the sleeping venue each night, and returned in the morning. This is a hard rule.

4. Behaviour. Respectful behaviour towards teammates, coaches, hosts, and venue staff is required at all times. Bullying, substance use, or leaving the venue without a coach is grounds for immediate removal from the trip at the parents' cost.

5. Health disclosure. I have declared all known allergies, dietary needs, and medical conditions on the registration form and will inform the convener of any changes before the trip.

6. Payment. The total accommodation contribution is KES 20,000 per swimmer, payable via M-Pesa. Payments may be made in parts (deposit + final, or smaller instalments). Balances must be cleared before the trip begins.

7. Refunds. Payments are non-refundable within 14 days of the event, except where the club cancels the trip.

8. Photos & media. Photos taken by team staff during the event may be used on NextGen Swim Club channels unless I opt out in writing to the convener.

9. Liability. NextGen Swim Club will exercise reasonable care but is not liable for loss of personal property or for injuries arising from participation in normal swim-team activity.

Convener: ${"convener@nextgenswim.example"} · +254 700 000 000`;

export function formatKes(n: number): string {
  return "KES " + n.toLocaleString("en-KE");
}
