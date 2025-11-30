import { z } from "zod";

export const orderSchema = z.object({
  budget: z
    .string()
    .min(1, "Budget is required")
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: "Budget must be a positive number",
    })
    .transform((val) => Number(val)),

  currency: z
    .string()
    .min(1, "Currency is required")
    .refine(
      (val) =>
        ["USD", "EUR", "GBP", "CAD", "AUD", "JPY"].some((currency) =>
          val.includes(currency)
        ),
      {
        message: "Please select a valid currency",
      }
    ),

  problemStatement: z
    .string()
    .min(10, "Problem statement must be at least 10 characters")
    .max(1000, "Problem statement must not exceed 1000 characters")
    .optional()
    .or(z.literal("")),

  expertiseRequired: z
    .array(z.string())
    .min(1, "Please select at least one expertise area")
    .max(5, "Please select no more than 5 expertise areas"),

  city: z
    .string()
    .min(2, "City must be at least 2 characters")
    .max(50, "City must not exceed 50 characters")
    .regex(
      /^[a-zA-Z\s-']+$/,
      "City can only contain letters, spaces, hyphens, and apostrophes"
    ),

  deadline: z
    .string()
    .min(1, "Deadline is required")
    .refine(
      (val) => {
        const date = new Date(val);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return date >= today;
      },
      {
        message: "Deadline must be today or in the future",
      }
    ),

  address: z
    .string()
    .min(5, "Address must be at least 5 characters")
    .max(200, "Address must not exceed 200 characters"),

  // Add these fields to your existing orderSchema object:
  phoneNumber: z
    .string()
    .min(10, "Phone number must be at least 10 digits")
    .regex(/^[+]?[\d\s\-\(\)]+$/, "Please enter a valid phone number"),

  // Images will be validated separately since they're File objects in frontend
  // but we'll add a field for tracking them
  hasImages: z.boolean().optional().default(false),

  isRecording: z.boolean().optional(),
  audio: z.any().optional(),
});

export const validateOrderForm = (data) => {
  try {
    return {
      success: true,
      data: orderSchema.parse(data),
      errors: null,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fieldErrors = {};
      error.errors.forEach((err) => {
        const path = err.path.join(".");
        fieldErrors[path] = err.message;
      });

      return {
        success: false,
        data: null,
        errors: fieldErrors,
      };
    }

    return {
      success: false,
      data: null,
      errors: { general: "Validation failed" },
    };
  }
};
