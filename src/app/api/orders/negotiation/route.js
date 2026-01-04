// app/api/orders/negotiation/route.js
import { NextResponse } from "next/server";
import { connectDb } from "@/Database/ConnectDb/connectdb";
import User from "@/Database/Schemas/User/user";

export async function POST(req) {
  try {
    await connectDb();

    const {
      orderId,
      action,
      newPrice,
      currentUserType,
      currentUsername,
      otherUsername,
    } = await req.json();

    if (
      !orderId ||
      !action ||
      !["client", "freelancer"].includes(currentUserType)
    ) {
      return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    }

    const user = await User.findOne({ username: currentUsername });
    const otherUser = await User.findOne({ username: otherUsername });

    if (!user || !otherUser) {
      return NextResponse.json(
        { error: "Order not found for either user." },
        { status: 404 }
      );
    }

    // Find orders in both users' arrays
    const userOrder =
      user.pendingOrders.find((o) => o.orderId === orderId) ||
      user.ordersGiven.find((o) => o.orderId === orderId);
    const otherOrder =
      otherUser.ordersGiven.find((o) => o.orderId === orderId) ||
      otherUser.pendingOrders.find((o) => o.orderId === orderId);

    if (!userOrder || !otherOrder) {
      return NextResponse.json(
        { error: "Order data inconsistency." },
        { status: 500 }
      );
    }

    if (action === "accept") {
      userOrder.status = "accepted";
      userOrder.negotiation.isNegotiating = false;
      userOrder.priceToBePaid = newPrice;
      otherOrder.status = "accepted";
      otherOrder.negotiation.isNegotiating = false;
      otherOrder.priceToBePaid = newPrice;
    } else if (action === "counter") {
      if (!newPrice || newPrice <= 0) {
        return NextResponse.json(
          { error: "Invalid counter offer." },
          { status: 400 }
        );
      }

      // Set statuses based on who's countering
      userOrder.status =
        currentUserType === "client" ? "offer-given" : "offer-received";
      otherOrder.status =
        currentUserType === "client" ? "offer-received" : "offer-given";

      // Update negotiation for both
      userOrder.negotiation.isNegotiating = true;
      otherOrder.negotiation.isNegotiating = true;
      userOrder.negotiation.offeredPrice = newPrice;
      otherOrder.negotiation.offeredPrice = newPrice;
      userOrder.negotiation.currentOfferTo =
        currentUserType === "client" ? "freelancer" : "client";
      otherOrder.negotiation.currentOfferTo =
        currentUserType === "client" ? "freelancer" : "client";
    } else {
      return NextResponse.json(
        { error: "Unsupported action." },
        { status: 400 }
      );
    }

    await user.save();
    await otherUser.save();

    const updatedUser = await User.findById(user._id);
    const mergedOrders = [
      ...(updatedUser.ordersGiven || []).map((o) => ({
        ...o.toObject(),
        type: "given",
      })),
      ...(updatedUser.pendingOrders || []).map((o) => ({
        ...o.toObject(),
        type: "received",
      })),
    ];

    return NextResponse.json(
      { message: "Order updated.", updatedOrders: mergedOrders },
      { status: 200 }
    );
  } catch (error) {
    console.error("Negotiation API error:", error);
    return NextResponse.json(
      { error: "Internal server error.", details: error.message },
      { status: 500 }
    );
  }
}
