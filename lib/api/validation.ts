import { z } from "zod";
import { PLATFORMS } from "@/lib/providers/types";

export const platformSchema = z.enum(PLATFORMS);

export const lookupQuerySchema = z.object({
  platform: platformSchema,
  input: z.string().trim().min(1).max(200),
});

export const trackedCreateSchema = z.object({
  platform: platformSchema,
  input: z.string().trim().min(1).max(200).optional(),
  identifier: z.string().trim().min(1).max(200).optional(),
  label: z.string().trim().max(80).optional(),
}).refine((value) => Boolean(value.input || value.identifier), {
  message: "input or identifier is required",
  path: ["input"],
});

export const trackedPatchSchema = z
  .object({
    monitoringStatus: z.enum(["active", "paused"]).optional(),
    label: z.string().trim().max(80).nullable().optional(),
  })
  .refine((value) => value.monitoringStatus !== undefined || value.label !== undefined, {
    message: "No supported fields provided",
  });

export const profileSettingsSchema = z
  .object({
    displayName: z.string().trim().max(80).nullable().optional(),
    locale: z.enum(["bn", "en"]).optional(),
    theme: z.enum(["light", "dark", "system"]).optional(),
  })
  .refine((value) => Object.values(value).some((entry) => entry !== undefined), {
    message: "No supported fields provided",
  });

export const disconnectSchema = z.object({
  id: z.string().trim().min(10).max(100),
});

export const accountDeleteSchema = z.object({
  confirm: z.literal("DELETE"),
  mode: z.enum(["data", "account"]),
});

export const signUpSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  displayName: z.string().trim().max(80).optional(),
});

export const signInSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
});

export const contactSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
  subject: z.string().trim().min(3).max(120),
  message: z.string().trim().min(10).max(4000),
  // Hidden anti-bot field; real users never fill it.
  website: z.string().max(0).optional().or(z.literal("")),
});

export const oauthStartSchema = z.object({
  platform: z.enum(["instagram", "facebook"]).default("instagram"),
  next: z.string().max(200).optional(),
});
