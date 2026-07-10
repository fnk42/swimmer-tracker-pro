// Central config for the NextGen Swim Club payment tracker MVP.
// Everything here is meant to be edited in one place when handing off.

export const EVENT = {
  clubName: "NextGen Swim Club",
  name: "Swimming Nationals",
  location: "Machakos County",
  startDate: "Thu 19 Nov 2026",
  endDate: "Sun 22 Nov 2026",
  totalKes: 20_910,
} as const;

export const AUTH = {
  parent: { username: "nextgen", password: "swim2026" },
  admin: { username: "admin", password: "jwBNXlS1l0rd" },
} as const;

export const COORDINATOR = {
  name: "Dr. Kiptolo Boit",
  email: "",
  phone: "+254 706 807219",
} as const;

export const COORDINATOR_2 = {
  name: "Edel Quin Odero",
  email: "",
  phone: "+254 726 063001",
} as const;

export const PAYMENT = {
  paybill: "600100",
  accountCode: "0100003703147",
  merchantName: "NextGen Swim Club",
} as const;

// Seed roster used on first load. Admin can add/import/rename/delete.
// Siblings from the source list have been split into individual swimmers.
// Age and gender are left blank for admin to fill in manually.
export const SEED_SWIMMERS: { name: string; age?: number; gender?: "Male" | "Female" }[] = [
  { name: "Allan Bengi" },
  { name: "Eann Bengi" },
  { name: "Pagiel Boit" },
  { name: "Renzo Gichogo" },
  { name: "Lavina Githui" },
  { name: "Lowena Githui" },
  { name: "Isaiah Gitonga" },
  { name: "Nathan Kadede" },
  { name: "Muthoni Karebe" },
  { name: "Leshan Kasaine" },
  { name: "Leyian Kasaine" },
  { name: "Zara Kimathi" },
  { name: "Noni Kiragu" },
  { name: "Kemuel Kosgey" },
  { name: "Kenan Kosgey" },
  { name: "Jermaine Loki" },
  { name: "Kamwelle Maina" },
  { name: "Nathan Maina" },
  { name: "Zion Makau" },
  { name: "Alfred Mathaara" },
  { name: "Jewel Mbui" },
  { name: "Keila Muthigani" },
  { name: "Naima Muthigani" },
  { name: "Michael Mutunga" },
  { name: "Billy Ndirangu" },
  { name: "Don Ndirangu" },
  { name: "Nicole Ndirangu" },
  { name: "Daniel Njenga" },
  { name: "Azu Nuru" },
  { name: "Frank Okuthe" },
  { name: "Jabu Onderi" },
  { name: "Ahmed Salah" },
  { name: "Sophie Summaiya" },
  { name: "Seth Ngaywa" },
  { name: "Ethan Thiga" },
  { name: "Liam Mochu" },
  { name: "Amara Wakhu" },
  { name: "Maisha Wakhu" },
  { name: "Tando Wakhu" },
  { name: "Bongani Waswa" },
  { name: "Lakisha Waswa" },
  { name: "Makena Waweru" },
  { name: "Wema Waweru" },
  { name: "Tevin Waweru" },
  { name: "Jonathan Weru" },
  { name: "Naya Olengo" },
];

export const TERMS_TEXT = `NextGen Swim Club — Swimming Nationals, Machakos County
Rules & expectations for the trip

By ticking the box below, I confirm on behalf of my swimmer and our family that we have read, understood, and agreed to the following:

1. Arrival & departure. All team members travel to and from Machakos together. No independent arrivals or early pickups except by prior arrangement with the event coordinator.

2. Timekeeping. Swimmers must be ready at all published call times — for meals, warm-ups, races, and team meetings. Repeated lateness affects the whole team.

3. Cellphones during the sleepover. Cellphones will be collected and stored securely once swimmers are in the sleeping venue each night, and returned in the morning. This is a hard rule.

4. Behaviour. Respectful behaviour towards teammates, coaches, hosts, and venue staff is required at all times. Bullying, substance use, or leaving the venue without a coach is grounds for immediate removal from the trip at the parents' cost.

5. Health disclosure. I have declared all known allergies, dietary needs, and medical conditions on the registration form and will inform the event coordinator of any changes before the trip.

6. Payment. The total accommodation contribution is KES 20,910 per swimmer, payable via M-Pesa. Payments may be made in parts (deposit + final, or smaller instalments). Balances must be cleared before the trip begins.

7. Refunds. Payments are non-refundable within 14 days of the event, except where the club cancels the trip.

8. Photos & media. Photos taken by team staff during the event may be used on NextGen Swim Club channels unless I opt out in writing to the event coordinator.

9. Liability. NextGen Swim Club will exercise reasonable care but is not liable for loss of personal property or for injuries arising from participation in normal swim-team activity.

Event Coordinator: Dr. Kiptolo Boit · +254 706 807219
Event Coordinator: Edel Quin Odero · +254 726 063001`;

export function formatKes(n: number): string {
  return "KES " + n.toLocaleString("en-KE");
}
