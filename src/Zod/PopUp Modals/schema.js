import { z } from "zod";

// Client Arrival Confirmation Schema
export const arrivalConfirmationSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  confirmed: z.boolean(),
  timestamp: z.string().optional(),
});

// Freelancer Service Completion Schema
export const serviceCompletionSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  proofImages: z.array(z.instanceof(File)).max(4, "Maximum 4 images allowed"),
  audioRecording: z.instanceof(Blob).optional(),
  notes: z.string().max(500, "Notes cannot exceed 500 characters").optional(),
  freelancerUsername: z.string().min(1, "Freelancer username is required"),
  clientUsername: z.string().min(1, "Client username is required"),
});

// Client-side only schema (with File validation)
export const clientFeedbackFormSchema = z.object({
  satisfied: z.boolean(),
  rating: z
    .number()
    .min(1, "Please select a rating")
    .max(5, "Rating cannot exceed 5"),
  review: z
    .string()
    .min(10, "Review must be at least 10 characters")
    .max(500, "Review cannot exceed 500 characters"),
  wouldRecommend: z.boolean(),
  textFeedback: z
    .string()
    .max(1000, "Feedback cannot exceed 1000 characters")
    .optional()
    .default(""),
});

// File validation helpers (client-side only)
export const validateFeedbackImages = (files) => {
  if (!files || files.length === 0) return { valid: true, errors: [] };

  const errors = [];

  if (files.length > 4) {
    errors.push("Maximum 4 images allowed");
  }

  files.forEach((file, index) => {
    if (!file.type.startsWith("image/")) {
      errors.push(`File ${index + 1} is not a valid image`);
    }
    if (file.size > 5 * 1024 * 1024) {
      // 5MB
      errors.push(`Image ${index + 1} is too large. Maximum size is 5MB`);
    }
  });

  return { valid: errors.length === 0, errors };
};

export const validateAudioFeedback = (audioBlob) => {
  if (!audioBlob) return { valid: true, errors: [] };

  const errors = [];

  if (audioBlob.size > 10 * 1024 * 1024) {
    // 10MB
    errors.push("Audio recording is too large. Maximum size is 10MB");
  }

  return { valid: errors.length === 0, errors };
};
