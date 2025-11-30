import { z } from "zod";

export const clientFeedbackSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  clientUsername: z.string().min(1, "Client username is required"),
  freelancerUsername: z.string().min(1, "Freelancer username is required"),
  satisfied: z.boolean(),
  rating: z
    .number()
    .min(1, "Rating must be at least 1")
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
