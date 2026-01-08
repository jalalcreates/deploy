import { z } from "zod";

// Schema for validating offer submission in real-time
export const offerRealtimeSchema = z.object({
  freelancerInfo: z.object({
    username: z.string().min(1, "Username is required"),
    profilePicture: z.string().optional(),
    averageStars: z.number().optional(),
    expertise: z.array(z.string()).optional(),
    satisfiedCustomers: z.number().optional(),
    totalOrdersRecieved: z.number().optional(),
    reviews: z.array(z.any()).optional(),
  }),
  offeredPrice: z.number().nonnegative("Price must be non-negative"),
  reachTime: z.union([z.string(), z.date()]).transform((val) => new Date(val)),
  accepted: z.boolean().optional().default(false),
});

// Schema for validating service request broadcast
export const serviceRequestBroadcastSchema = z.object({
  requestId: z.string().min(1, "Request ID is required"),
  customerInfo: z.object({
    username: z.string().min(1, "Username is required"),
    profilePicture: z.string().optional(),
  }),
  willingPrice: z.number().nonnegative().optional(),
  currency: z.string().optional(),
  problemDescription: z.string().optional(),
  problemAudioId: z.string().optional(),
  serviceImages: z.array(z.string()).optional(),
  phoneNumber: z.string().optional(),
  expertiseRequired: z.array(z.string()).optional(),
  city: z.string().min(1, "City is required"),
  deadline: z.union([z.string(), z.date()]).optional(),
  address: z.string().min(1, "Address is required"),
});

// Schema for validating offer acceptance
export const acceptOfferRealtimeSchema = z.object({
  requestId: z.string().min(1, "Request ID is required"),
  freelancerUsername: z.string().min(1, "Freelancer username is required"),
  serviceRequestData: serviceRequestBroadcastSchema,
  acceptedOffer: offerRealtimeSchema,
});

// Schema for validating offer decline
export const declineOfferRealtimeSchema = z.object({
  requestId: z.string().min(1, "Request ID is required"),
  freelancerUsername: z.string().min(1, "Freelancer username is required"),
});
