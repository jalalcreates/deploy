import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const orderSchema = new mongoose.Schema({
  customerInfo: {
    username: {
      type: String,
      required: true,
    },
    profilePicture: String,
    address: String,
    location: {
      latitude: String, //from google maps
      longitude: String,
    },
  },
  freelancerInfo: {
    username: {
      type: String,
      required: true,
    },
    profilePicture: String,
  },
  status: String,
  cancelled: {
    cancelledBy: String,
    isCancelled: Boolean,
  },
  offerAccepted: {
    type: Boolean,
    default: false,
  },
  negotiation: {
    isNegotiating: {
      type: Boolean,
      default: false,
    },
    currentOfferTo: String,
    offeredPrice: Number,
    currency: String,
  },
  expectedReachTime: Date,
  satisfied: Boolean,
  proofPictures: { before: [String], after: [String], description: String },
  reachTime: Date,
  isReached: Boolean,
  problemDescription: String,
  problemAudioId: String,
  orderId: {
    type: String,
    default: uuidv4(),
  },
  finishDate: Date,
});

const Orders =
  mongoose.models && mongoose.models.Order
    ? mongoose.models.Order
    : mongoose.model("Order", orderSchema);
export default Orders;
