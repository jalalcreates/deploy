"use server";

import { connectDb } from "@/Database/ConnectDb/connectdb";
import User from "@/Database/Schemas/User/user";
import ServiceRequests from "@/Database/Schemas/ServiceRequests/serviceRequests";
import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

// ============================================
// SAVE OFFER TO DATABASE (FALLBACK)
// ============================================
export async function saveOfferToDatabase(requestId, offer) {
  try {
    await connectDb();

    // Add offer to service request
    const serviceRequest = await ServiceRequests.findOneAndUpdate(
      { requestId },
      { $push: { offers: offer } },
      { new: true }
    );

    if (!serviceRequest) {
      return { success: false, error: "Service request not found" };
    }

    console.log(`💾 Offer saved to DB for request ${requestId} (fallback)`);
    return { success: true };
  } catch (error) {
    console.error("Error saving offer to database:", error);
    return { success: false, error: error.message };
  }
}

// ============================================
// CREATE ORDER FROM ACCEPTED OFFER (FALLBACK)
// ============================================
export async function createOrderFromAcceptedOffer(
  requestId,
  freelancerUsername,
  serviceRequestData,
  acceptedOffer
) {
  try {
    await connectDb();

    const session = await mongoose.startSession();
    let orderId = null;

    await session.withTransaction(async () => {
      // Generate order ID (use requestId or generate new)
      orderId = serviceRequestData.requestId || uuidv4();

      const clientUsername = serviceRequestData.customerInfo?.username;

      if (!clientUsername) {
        throw new Error("Client username not found in service request data");
      }

      // Create order data structure
      const orderData = {
        orderId,
        freelancerInfo: {
          username: freelancerUsername,
          profilePicture: acceptedOffer.freelancerInfo?.profilePicture || null,
        },
        priceToBePaid:
          acceptedOffer.offeredPrice || serviceRequestData.willingPrice,
        currency: serviceRequestData.currency || "USD",
        problemDescription: serviceRequestData.problemDescription,
        expertiseRequired: serviceRequestData.expertiseRequired || [],
        city: serviceRequestData.city,
        deadline: serviceRequestData.deadline,
        address: serviceRequestData.address,
        phoneNumber: serviceRequestData.phoneNumber,
        orderImages: serviceRequestData.serviceImages || [],
        problemAudioId: serviceRequestData.problemAudioId,
        status: "pending",
        expectedReachTime: acceptedOffer.reachTime,
        createdOn: new Date(),
        negotiation: {
          isNegotiating: false,
          currentOfferTo: "",
          offeredPrice: 0,
        },
      };

      // Add to client's ordersGiven
      await User.findOneAndUpdate(
        { username: clientUsername },
        {
          $push: {
            ordersGiven: orderData,
          },
        },
        { session }
      );

      // Add to freelancer's pendingOrders
      await User.findOneAndUpdate(
        { username: freelancerUsername },
        {
          $push: {
            pendingOrders: {
              ...orderData,
              customerInfo: {
                username: clientUsername,
                profilePicture:
                  serviceRequestData.customerInfo?.profilePicture || null,
              },
              freelancerInfo: undefined, // Remove for freelancer's view
            },
          },
        },
        { session }
      );

      // Delete the service request
      await ServiceRequests.findOneAndDelete({ requestId }, { session });

      console.log(
        `✅ Order ${orderId} created from service request ${requestId} (fallback)`
      );
    });

    session.endSession();

    return { success: true, orderId };
  } catch (error) {
    console.error("Error creating order from accepted offer:", error);
    return { success: false, error: error.message };
  }
}

// ============================================
// REMOVE DECLINED OFFER FROM DATABASE (FALLBACK)
// ============================================
export async function removeDeclinedOfferFromDatabase(
  requestId,
  freelancerUsername
) {
  try {
    await connectDb();

    // Remove offer from service request
    const serviceRequest = await ServiceRequests.findOneAndUpdate(
      { requestId },
      {
        $pull: {
          offers: {
            "freelancerInfo.username": freelancerUsername,
          },
        },
      },
      { new: true }
    );

    if (!serviceRequest) {
      return { success: false, error: "Service request not found" };
    }

    console.log(
      `💾 Offer removed from DB for request ${requestId} (fallback)`
    );
    return { success: true };
  } catch (error) {
    console.error("Error removing declined offer from database:", error);
    return { success: false, error: error.message };
  }
}

// ============================================
// DELETE SERVICE REQUEST FROM DATABASE
// ============================================
export async function deleteServiceRequestFromDatabase(requestId) {
  try {
    await connectDb();

    const result = await ServiceRequests.findOneAndDelete({ requestId });

    if (!result) {
      return { success: false, error: "Service request not found" };
    }

    console.log(`🗑️ Service request ${requestId} deleted from database`);
    return { success: true };
  } catch (error) {
    console.error("Error deleting service request:", error);
    return { success: false, error: error.message };
  }
}

// ============================================
// GET UNSEEN SERVICE REQUESTS COUNT
// ============================================
export async function getUnseenServiceRequestsCount(username, city) {
  try {
    await connectDb();

    // Count service requests in user's city that they haven't viewed
    // This is a simple implementation - you might want to track viewed requests more explicitly
    const count = await ServiceRequests.countDocuments({
      city,
      "customerInfo.username": { $ne: username }, // Not their own requests
    });

    return { success: true, count };
  } catch (error) {
    console.error("Error getting unseen service requests count:", error);
    return { success: false, error: error.message, count: 0 };
  }
}

// ============================================
// GET UNSEEN OFFERS COUNT FOR USER'S REQUESTS
// ============================================
export async function getUnseenOffersCount(username) {
  try {
    await connectDb();

    // Get all service requests by this user
    const serviceRequests = await ServiceRequests.find({
      "customerInfo.username": username,
    });

    // Count total offers across all requests
    let totalOffers = 0;
    serviceRequests.forEach((request) => {
      totalOffers += request.offers.length;
    });

    return { success: true, count: totalOffers };
  } catch (error) {
    console.error("Error getting unseen offers count:", error);
    return { success: false, error: error.message, count: 0 };
  }
}

// ============================================
// UPDATE OFFER STATUS IN DATABASE
// ============================================
export async function updateOfferStatusInDatabase(
  requestId,
  freelancerUsername,
  status
) {
  try {
    await connectDb();

    if (status === "accept") {
      // Mark offer as accepted
      const serviceRequest = await ServiceRequests.findOneAndUpdate(
        {
          requestId,
          "offers.freelancerInfo.username": freelancerUsername,
        },
        {
          $set: {
            "offers.$.accepted": true,
          },
        },
        { new: true }
      );

      if (!serviceRequest) {
        return { success: false, error: "Service request or offer not found" };
      }

      return { success: true, serviceRequest };
    } else if (status === "decline") {
      // Remove the offer
      return await removeDeclinedOfferFromDatabase(
        requestId,
        freelancerUsername
      );
    }

    return { success: false, error: "Invalid status" };
  } catch (error) {
    console.error("Error updating offer status:", error);
    return { success: false, error: error.message };
  }
}
