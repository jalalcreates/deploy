"use server";

import { connectDb } from "@/Database/ConnectDb/connectdb";
import User from "@/Database/Schemas/User/user";
import mongoose from "mongoose";

// ============================================
// SAVE REALTIME ORDER TO DATABASE
// ============================================
export async function saveRealtimeOrderToDatabase(orderData) {
  try {
    await connectDb();

    const session = await mongoose.startSession();

    await session.withTransaction(async () => {
      // Add to client's ordersGiven
      await User.findOneAndUpdate(
        { username: orderData.clientUsername },
        {
          $push: {
            ordersGiven: {
              orderId: orderData.orderId,
              freelancerInfo: {
                username: orderData.freelancerUsername,
              },
              priceToBePaid: orderData.budget,
              currency: orderData.currency,
              problemDescription: orderData.problemStatement,
              expertiseRequired: orderData.expertiseRequired,
              city: orderData.city,
              deadline: orderData.deadline,
              address: orderData.address,
              phoneNumber: orderData.phoneNumber,
              orderImages: orderData.images || [],
              problemAudioId: orderData.audioId,
              status: orderData.status || "pending",
              negotiation: orderData.negotiation,
              location: orderData.location,
              isReached: orderData.isReached,
              proofPictures: orderData.proofPictures,
              createdOn: orderData.createdAt || new Date(),
            },
          },
        },
        { session }
      );

      // Add to freelancer's pendingOrders
      await User.findOneAndUpdate(
        { username: orderData.freelancerUsername },
        {
          $push: {
            pendingOrders: {
              orderId: orderData.orderId,
              customerInfo: {
                username: orderData.clientUsername,
              },
              priceToBePaid: orderData.budget,
              currency: orderData.currency,
              problemDescription: orderData.problemStatement,
              expertiseRequired: orderData.expertiseRequired,
              city: orderData.city,
              deadline: orderData.deadline,
              address: orderData.address,
              phoneNumber: orderData.phoneNumber,
              orderImages: orderData.images || [],
              problemAudioId: orderData.audioId,
              status: orderData.status || "pending",
              negotiation: orderData.negotiation,
              location: orderData.location,
              isReached: orderData.isReached,
              proofPictures: orderData.proofPictures,
              createdOn: orderData.createdAt || new Date(),
            },
          },
        },
        { session }
      );
    });

    session.endSession();

    return { success: true };
  } catch (error) {
    console.error("Error saving order to database:", error);
    return { success: false, error: error.message };
  }
}

// ============================================
// UPDATE ORDER PROGRESS IN DATABASE
// ============================================
export async function updateOrderProgress(orderData) {
  try {
    await connectDb();

    const {
      orderId,
      clientUsername,
      freelancerUsername,
      updateType,
      updateData,
    } = orderData;

    console.log(`💾 Updating order ${orderId} in database: ${updateType}`);

    const session = await mongoose.startSession();

    await session.withTransaction(async () => {
      const updateFields = {};

      // Build update based on type
      switch (updateType) {
        case "accept":
          updateFields["ordersGiven.$.status"] = "accepted";
          updateFields["ordersGiven.$.acceptedAt"] = updateData.acceptedAt || new Date();
          updateFields["ordersGiven.$.acceptedBy"] = updateData.acceptedBy;
          updateFields["ordersGiven.$.priceToBePaid"] = updateData.acceptedPrice;
          updateFields["ordersGiven.$.expectedReachTime"] = updateData.expectedReachTime;

          updateFields["pendingOrders.$.status"] = "accepted";
          updateFields["pendingOrders.$.acceptedAt"] = updateData.acceptedAt || new Date();
          updateFields["pendingOrders.$.acceptedBy"] = updateData.acceptedBy;
          updateFields["pendingOrders.$.priceToBePaid"] = updateData.acceptedPrice;
          updateFields["pendingOrders.$.expectedReachTime"] = updateData.expectedReachTime;
          break;

        case "reject":
          // Remove from both users' orders
          await User.findOneAndUpdate(
            { username: clientUsername },
            { $pull: { ordersGiven: { orderId } } },
            { session }
          );

          await User.findOneAndUpdate(
            { username: freelancerUsername },
            { $pull: { pendingOrders: { orderId } } },
            { session }
          );
          return; // Exit early since we're removing the order

        case "location":
          updateFields["ordersGiven.$.location"] = {
            latitude: updateData.latitude,
            longitude: updateData.longitude,
            sharedAt: new Date(),
          };
          updateFields["pendingOrders.$.location"] = {
            latitude: updateData.latitude,
            longitude: updateData.longitude,
            sharedAt: new Date(),
          };
          break;

        case "reached":
          updateFields["ordersGiven.$.isReached"] = {
            value: true,
            time: updateData.reachedAt || new Date(),
            confirmed: false,
          };
          updateFields["pendingOrders.$.isReached"] = {
            value: true,
            time: updateData.reachedAt || new Date(),
            confirmed: false,
          };
          break;

        case "confirmArrival":
          updateFields["ordersGiven.$.isReached.confirmed"] = updateData.confirmed;
          updateFields["ordersGiven.$.isReached.confirmedAt"] = new Date();
          updateFields["ordersGiven.$.status"] = updateData.confirmed ? "in-progress" : "disputed";

          updateFields["pendingOrders.$.isReached.confirmed"] = updateData.confirmed;
          updateFields["pendingOrders.$.isReached.confirmedAt"] = new Date();
          updateFields["pendingOrders.$.status"] = updateData.confirmed ? "in-progress" : "disputed";
          break;

        case "complete":
          updateFields["ordersGiven.$.status"] = "completed";
          updateFields["ordersGiven.$.proofPictures"] = updateData.proofPictures;
          updateFields["ordersGiven.$.finishDate"] = updateData.completedAt || new Date();

          updateFields["pendingOrders.$.status"] = "completed";
          updateFields["pendingOrders.$.proofPictures"] = updateData.proofPictures;
          updateFields["pendingOrders.$.finishDate"] = updateData.completedAt || new Date();
          break;

        case "negotiation":
          updateFields["ordersGiven.$.negotiation"] = updateData.negotiation;
          updateFields["ordersGiven.$.priceToBePaid"] = updateData.offeredPrice;
          updateFields["ordersGiven.$.expectedReachTime"] = updateData.expectedReachTime;

          updateFields["pendingOrders.$.negotiation"] = updateData.negotiation;
          updateFields["pendingOrders.$.priceToBePaid"] = updateData.offeredPrice;
          updateFields["pendingOrders.$.expectedReachTime"] = updateData.expectedReachTime;
          break;

        default:
          console.warn(`Unknown update type: ${updateType}`);
          return;
      }

      // Update client's ordersGiven
      await User.findOneAndUpdate(
        { username: clientUsername, "ordersGiven.orderId": orderId },
        { $set: updateFields },
        { session }
      );

      // Update freelancer's pendingOrders
      await User.findOneAndUpdate(
        { username: freelancerUsername, "pendingOrders.orderId": orderId },
        { $set: updateFields },
        { session }
      );
    });

    session.endSession();

    console.log(`✅ Order ${orderId} updated in database: ${updateType}`);
    return { success: true };
  } catch (error) {
    console.error("Error updating order progress:", error);
    return { success: false, error: error.message };
  }
}
