import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    // required: true,
  },
  username: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  profilePicture: {
    type: String,
  },
  ordersCompleted: [
    {
      customerInfo: {
        username: {
          type: String,
          required: true,
        },
        profilePicture: String,
      },
      satisfied: {
        type: Boolean,
        required: true,
      },
      review: {
        type: String,
      },
      stars: Number,
      date: Date,
    },
  ],
  totalOrdersRecieved: {
    type: Number,
    default: 0,
  },
  ordersGiven: [
    {
      freelancerInfo: {
        username: {
          type: String,
          required: true,
        },
        profilePicture: String,
      },
      isSatisfied: {
        type: Boolean,
      },
      proofPictures: { before: [String], after: [String], description: String },
      address: {
        type: String,
      },
      orderImages: [String],
      phoneNumber: String,

      location: {
        latitude: String, //from google maps
        longitude: String,
      },
      status: {
        type: String,
        // default: "given",
      },
      city: String,
      problemDescription: String,

      review: String,
      expertiseRequired: [String],

      date: Date,
      createdOn: {
        type: Date,
        default: Date.now,
      },
      orderId: String,

      isReached: {
        value: {
          type: Boolean,
          default: false,
        },
        time: Date,
        confirmed: {
          type: Boolean,
          default: false,
        },
      },
      priceToBePaid: Number,
      expectedReachTime: Date,
      deadline: Date,
      negotiation: {
        isNegotiating: {
          type: Boolean,
          default: false,
        },
        currentOfferTo: String,
        offeredPrice: Number,
      },
      currency: String,
    },
  ],
  customers: {
    satisfiedCustomers: {
      type: Number,
      default: 0,
    },
    unsatisfiedCustomers: {
      type: Number,
      default: 0,
    },
  },
  reviews: [
    {
      customerInfo: {
        username: {
          type: String,
          required: true,
        },
        profilePicture: String,
      },
      review: String,
      stars: Number,
    },
  ],
  averageStars: {
    type: Number,
    default: 0,
  },
  recommended: {
    type: Number,
    default: 0,
  },
  workExperience: [
    {
      organization: { type: String, required: true },
      designation: { type: String, required: true },
      experience: { type: Number, required: true },
      experienceSpan: { type: String, required: true },
    },
  ],
  degrees: [
    {
      institute: { type: String, required: true },
      degree: { type: String, required: true },
      proof: { type: String, required: true },
    },
  ],
  expertise: [String],
  citiesToWorkIn: [String],
  currentCity: String,
  isFreelancer: {
    type: Boolean,
    required: true,
    default: false,
  },
  status: {
    type: Boolean,
    default: false,
  },
  pendingOrders: [
    //recieved orders for the freelancer
    {
      customerInfo: {
        username: {
          type: String,
          required: true,
        },
        profilePicture: String,
      },
      address: {
        type: String,
      },
      location: {
        latitude: String, //from google maps
        longitude: String,
      },
      status: {
        type: String,
        // default: "initiated",
      },
      city: String,
      expertiseRequired: [String],
      offerAccepted: Boolean,
      priceToBePaid: Number,
      negotiation: {
        isNegotiating: {
          type: Boolean,
          default: false,
        },
        currentOfferTo: String,
        offeredPrice: Number,
      },
      currency: String,
      createdOn: {
        type: Date,
        default: Date.now,
      },
      expectedReachTime: Date,
      deadline: Date,
      isSatisfied: Boolean,
      review: String,
      orderImages: [String],
      clientUnsatisfiedFeedback: {
        satisfied: Boolean,
        textFeedback: String,
        feedbackImages: [String],
        audioFeedbackId: String,
        rating: Number,
        wouldRecommend: Boolean,
        submittedAt: Date,
      },
      phoneNumber: String,

      proofPictures: { before: [String], after: [String], description: String },
      isReached: {
        value: {
          type: Boolean,
          default: false,
        },
        time: Date,
        confirmed: {
          type: Boolean,
          default: false,
        },
      },
      problemDescription: String,
      problemAudioId: String,
      orderId: String,
      cancelled: {
        cancelledBy: String,
        isCancelled: Boolean,
      },
      finishDate: Date,
    },
  ],
});

const User = mongoose.models.User || mongoose.model("User", userSchema);
export default User;
