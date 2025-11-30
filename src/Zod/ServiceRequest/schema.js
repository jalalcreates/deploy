import { z } from "zod";

export const serviceRequestZodSchema = z.object({
  customerInfo: z.object({
    username: z.string().min(1, "Username is required"),
    profilePicture: z.string().optional(),
  }),
  willingPrice: z.coerce.number().nonnegative().optional(),
  currency: z.string().optional(),
  problemDescription: z.string().optional(),
  expertiseRequired: z
    .union([z.array(z.string()), z.string()])
    .transform((val) => (typeof val === "string" ? val.split(",") : val))
    .optional(),
  city: z.string().min(1, "City is required"),
  deadline: z
    .union([z.string(), z.date()])
    .transform((val) => new Date(val))
    .optional(),
  address: z.string().min(1, "Address is required"),
  // Add this field to the existing serviceRequestZodSchema:
  phoneNumber: z
    .string()
    .min(10, "Phone number must be at least 10 digits")
    .regex(/^[+]?[\d\s\-\(\)]+$/, "Please enter a valid phone number"),

  // For images, add this to track them
  hasImages: z.boolean().optional().default(false),
});

// for frontend
export const serviceRequestFormSchema = z.object({
  willingPrice: z
    .string()
    .regex(/^\d+$/, { message: "Price must be a valid number" }),
  currency: z.string().min(1, "Currency is required"),
  problemDescription: z.string().min(10, "Problem must be more descriptive"),
  expertiseRequired: z
    .array(z.string())
    .min(1, "At least one expertise is required"),
  city: z.string().min(1, "City is required"),
  address: z.string().min(1, "Address is required"),
  deadline: z.string().min(1, "Deadline is required"),
  phoneNumber: z
    .string()
    .min(10, "Phone number must be at least 10 digits")
    .regex(/^[+]?[\d\s\-\(\)]+$/, "Please enter a valid phone number"),
});
