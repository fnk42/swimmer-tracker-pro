import { z } from "zod";

export const genderSchema = z.enum(["Male", "Female"]);
export type Gender = z.infer<typeof genderSchema>;

export const swimmerSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1).max(100),
  age: z.number().int().min(4).max(25).optional(),
  gender: genderSchema.optional(),
});
export type Swimmer = z.infer<typeof swimmerSchema>;

export const yesNo = z.enum(["Yes", "No"]);
export const yesNoMaybe = z.enum(["Yes", "No", "Yet to decide"]);

export const registrationSchema = z.object({
  swimmerId: z.string(),
  age: z.number().int().min(4).max(25),
  gender: genderSchema,
  guardianGender: genderSchema,
  parentSleepover: yesNoMaybe,
  ownsCellphone: yesNo,
  parent1Name: z.string().trim().min(1, "Required").max(120),
  parent2Name: z.string().trim().max(120).optional().or(z.literal("")),
  primaryPhone: z.string().trim().min(7, "Phone number too short").max(20),
  secondaryPhone: z.string().trim().max(20).optional().or(z.literal("")),
  dietary: z.string().trim().max(500).optional().or(z.literal("")),
  allergies: z.string().trim().max(500).optional().or(z.literal("")),
  healthConditions: z.string().trim().max(500).optional().or(z.literal("")),
  specialRequests: z.string().trim().max(1000).optional().or(z.literal("")),
  updatedAt: z.string(),
});
export type Registration = z.infer<typeof registrationSchema>;

export const paymentTypeSchema = z.enum(["Deposit", "Partial", "Final"]);
export type PaymentType = z.infer<typeof paymentTypeSchema>;

export const paymentSchema = z.object({
  id: z.string(),
  swimmerId: z.string(),
  swimmerIds: z.array(z.string()).min(1),
  childCount: z.number().int().min(1),
  amount: z.number().positive().max(1_000_000),
  reference: z.string().trim().min(3, "M-Pesa reference required").max(40),
  type: paymentTypeSchema,
  createdAt: z.string(),
});
export type Payment = z.infer<typeof paymentSchema>;

export const parentSchema = z.object({
  id: z.string(),
  fullName: z.string().trim().min(1, "Required").max(120),
  gender: genderSchema.nullable().optional(),
  phone: z
    .string()
    .trim()
    .regex(/^254[0-9]{9}$/, "Phone must be 254XXXXXXXXX"),
  stayingOvernight: yesNoMaybe,
  userId: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  backfillNote: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Parent = z.infer<typeof parentSchema>;

export const swimmerParentLinkSchema = z.object({
  swimmerId: z.string(),
  parentId: z.string(),
  sortOrder: z.number().int().min(1),
});
export type SwimmerParentLink = z.infer<typeof swimmerParentLinkSchema>;

// CSV row for importing swimmers. Headers are normalized to lowercase before parsing.
export const csvRowSchema = z.object({
  name: z.string().trim().min(1),
  age: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === "") return undefined;
      const n = typeof v === "number" ? v : parseInt(v, 10);
      return Number.isFinite(n) ? n : undefined;
    }),
  gender: z
    .string()
    .optional()
    .transform((v) => {
      if (!v) return undefined;
      const s = v.trim().toLowerCase();
      if (s === "m" || s === "male") return "Male" as const;
      if (s === "f" || s === "female") return "Female" as const;
      return "__invalid__" as const;
    }),
});
