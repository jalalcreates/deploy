import { NextResponse } from "next/server";
import { connectDb } from "@/Database/ConnectDb/connectdb";
import User from "@/Database/Schemas/User/user";

export async function POST(req) {
  try {
    await connectDb();

    const { orderId, action, freelancerUsername, clientUsername } =
      await req.json();

    // Validate required fields
    if (!orderId || !action || !freelancerUsername || !clientUsername) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: orderId, action, freelancerUsername, clientUsername",
        },
        { status: 400 }
      );
    }

    // Validate action type
    if (!["reached", "cancel"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be 'reached' or 'cancel'" },
        { status: 400 }
      );
    }

    // Find both users
    const freelancer = await User.findOne({ username: freelancerUsername });
    const client = await User.findOne({ username: clientUsername });

    if (!freelancer || !client) {
      return NextResponse.json(
        { error: "Freelancer or client not found" },
        { status: 404 }
      );
    }

    // Find the orders in both users' arrays
    const freelancerOrder = freelancer.pendingOrders.find(
      (o) => o.orderId === orderId
    );

    const clientOrder = client.ordersGiven.find((o) => o.orderId === orderId);

    if (!freelancerOrder || !clientOrder) {
      return NextResponse.json(
        { error: "Order not found in one or both user accounts" },
        { status: 404 }
      );
    }

    // Validate order status - only allow actions on accepted orders
    if (
      freelancerOrder.status !== "accepted" ||
      clientOrder.status !== "accepted"
    ) {
      return NextResponse.json(
        { error: "Action only allowed on accepted orders" },
        { status: 400 }
      );
    }

    // Handle different actions
    if (action === "reached") {
      const reachedTime = new Date();

      // Update freelancer's order
      freelancerOrder.isReached = {
        value: true,
        time: reachedTime,
        confirmed: false, // Client needs to confirm
      };
      // Note: Status remains "accepted" until client confirms arrival

      // Update client's order (mirror the changes)
      clientOrder.isReached = {
        value: true,
        time: reachedTime,
        confirmed: false,
      };
      // Note: Status remains "accepted" until client confirms arrival
    } else if (action === "cancel") {
      const cancelTime = new Date();

      // Update freelancer's order
      freelancerOrder.cancelled = {
        isCancelled: true,
        cancelledBy: freelancerUsername,
      };
      freelancerOrder.status = "cancelled";

      // Update client's order (mirror the changes)
      clientOrder.cancelled = {
        isCancelled: true,
        cancelledBy: freelancerUsername,
      };
      clientOrder.status = "cancelled";
    }

    // Save both users
    await Promise.all([freelancer.save(), client.save()]);

    // Return updated orders for the freelancer (following your pattern)
    const updatedFreelancer = await User.findById(freelancer._id);
    const mergedOrders = [
      ...(updatedFreelancer.ordersGiven || []).map((o) => ({
        ...o.toObject(),
        type: "given",
      })),
      ...(updatedFreelancer.pendingOrders || []).map((o) => ({
        ...o.toObject(),
        type: "received",
      })),
    ];

    // Determine success message
    const successMessage =
      action === "reached"
        ? "Successfully marked as reached. Waiting for client confirmation."
        : "Order cancelled successfully.";

    return NextResponse.json(
      {
        message: successMessage,
        updatedOrders: mergedOrders,
        action: action,
        orderId: orderId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Freelancer action API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
