import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const serviceRequestsSchema = new mongoose.Schema({
  customerInfo: {
    username: {
      type: String,
      required: true,
    },
    profilePicture: String,
  },
  willingPrice: Number,
  currency: String,
  problemDescription: String,
  problemAudioId: String,
  serviceImages: [String],
  phoneNumber: String,
  expertiseRequired: [String],
  city: {
    type: String,
    required: true,
  },
  deadline: Date,
  address: {
    type: String,
    required: true,
  },
  requestId: {
    type: String,
    default: uuidv4(),
  },
  offers: [
    {
      freelancerInfo: {
        username: {
          type: String,
          required: true,
        },
        profilePicture: String,
        averageStars: Number,
        expertise: [String],
        satisfiedCustomers: Number,
        totalOrdersRecieved: Number,
        reviews: [Object],
      },
      offeredPrice: Number,
      reachTime: Date,
      accepted: {
        type: Boolean,
        default: false,
      },
    },
  ],
});
serviceRequestsSchema.index({ city: 1 });
const ServiceRequests =
  mongoose.models && mongoose.models.ServiceRequest
    ? mongoose.models.ServiceRequest
    : mongoose.model("ServiceRequest", serviceRequestsSchema);
export default ServiceRequests;
