// src/Socket_IO/orderHandlers.js
// Handles real-time order events

import { isUserOnline, getUserSocketId } from "./userManager.js";
import {
  createOrder,
  getOrder,
  updateOrder,
  deleteOrder,
  getUserActiveOrders,
} from "./orderMemory.js";
import { sendToUser } from "./socketUtils.js";

// ============================================
// SEND ORDER TO FREELANCER
// ============================================
export function handleSendOrder(io, socket, data) {
  const { username: clientUsername } = socket.userData;
  const { freelancerUsername, orderData } = data;

  console.log(`📦 Order from ${clientUsername} to ${freelancerUsername}`);

  // Check if freelancer is online
  const freelancerSocketId = getUserSocketId(freelancerUsername);

  if (!freelancerSocketId) {
    // ===== FREELANCER OFFLINE - USE DATABASE =====
    console.log(
      `📴 ${freelancerUsername} is offline, client should use database`
    );

    socket.emit("order-status", {
      success: false,
      isOnline: false,
      orderId: orderData.orderId,
      message: "Freelancer is offline. Saving to database.",
    });

    return;
  }

  // ===== FREELANCER ONLINE - REAL-TIME =====
  console.log(`✅ ${freelancerUsername} is online, sending real-time order`);

  // Store order in memory
  const realtimeOrder = createOrder(orderData.orderId, {
    orderId: orderData.orderId,
    clientUsername,
    freelancerUsername,
    budget: orderData.budget,
    currency: orderData.currency,
    problemStatement: orderData.problemStatement,
    expertiseRequired: orderData.expertiseRequired,
    city: orderData.city,
    deadline: orderData.deadline,
    address: orderData.address,
    phoneNumber: orderData.phoneNumber,
    images: orderData.images || [],
    audioId: orderData.audioId || null,
    status: "pending",
    negotiation: {
      isNegotiating: false,
      currentOfferTo: "",
      offeredPrice: 0,
    },
  });

  // Send order to freelancer
  io.to(freelancerSocketId).emit("new-order-realtime", {
    ...realtimeOrder,
    clientProfilePicture: socket.userData.profilePicture || "",
  });

  // Confirm to client
  socket.emit("order-status", {
    success: true,
    isOnline: true,
    orderId: orderData.orderId,
    message: "Order sent in real-time",
  });

  console.log(
    `✉️ Order ${orderData.orderId} sent to ${freelancerUsername} in real-time`
  );
}

// ============================================
// FREELANCER INITIAL RESPONSE (Accept/Reject/Counter)
// ============================================
export function handleOrderResponse(io, socket, data) {
  const { username: freelancerUsername } = socket.userData;
  const { orderId, response, newPrice, message } = data;

  console.log(
    `📬 ${freelancerUsername} responded to order ${orderId}: ${response}`
  );

  const order = getOrder(orderId);
  if (!order) {
    socket.emit("response-error", {
      orderId,
      error: "Order not found in real-time session",
    });
    return;
  }

  const clientSocketId = getUserSocketId(order.clientUsername);

  if (!clientSocketId) {
    // ===== CLIENT WENT OFFLINE - SAVE TO DATABASE =====
    console.log(
      `📴 Client ${order.clientUsername} went offline, need to save to DB`
    );

    socket.emit("save-to-database", {
      orderId,
      reason: "client-offline",
      orderData: order,
      response,
      newPrice,
    });

    deleteOrder(orderId);
    return;
  }

  // ===== BOTH ONLINE - UPDATE IN MEMORY =====

  if (response === "accept") {
    // Freelancer accepts original price
    const updatedOrder = updateOrder(orderId, {
      status: "accepted",
      negotiation: {
        isNegotiating: false,
        currentOfferTo: "",
        offeredPrice: order.budget,
      },
      acceptedAt: new Date(),
    });

    // Notify client
    io.to(clientSocketId).emit("order-accepted", {
      orderId,
      freelancerUsername,
      message: message || "Freelancer accepted your order",
      finalPrice: order.budget,
    });

    // Confirm to freelancer
    socket.emit("response-sent", {
      success: true,
      orderId,
      action: "accepted",
    });

    // Trigger save to database
    io.to(clientSocketId).emit("save-accepted-order", {
      orderId,
      orderData: updatedOrder,
    });

    // Remove from memory after acceptance
    deleteOrder(orderId);
  } else if (response === "reject") {
    // Freelancer rejects order
    io.to(clientSocketId).emit("order-rejected", {
      orderId,
      freelancerUsername,
      message: message || "Freelancer declined your order",
    });

    socket.emit("response-sent", {
      success: true,
      orderId,
      action: "rejected",
    });

    // Remove from memory
    deleteOrder(orderId);
  } else if (response === "counter") {
    // Freelancer counters with new price
    if (!newPrice || newPrice <= 0) {
      socket.emit("response-error", {
        orderId,
        error: "Invalid counter price",
      });
      return;
    }

    const updatedOrder = updateOrder(orderId, {
      status: "offer-received",
      negotiation: {
        isNegotiating: true,
        currentOfferTo: "client",
        offeredPrice: newPrice,
      },
    });

    // Notify client
    io.to(clientSocketId).emit("order-counter-offer", {
      orderId,
      freelancerUsername,
      newPrice,
      message: message || `Freelancer offered ${newPrice} ${order.currency}`,
    });

    socket.emit("response-sent", {
      success: true,
      orderId,
      action: "countered",
      newPrice,
    });

    console.log(`💰 Counter offer sent: ${newPrice} ${order.currency}`);
  }
}

// ============================================
// CLIENT RESPONDS TO COUNTER OFFER
// ============================================
export function handleCounterResponse(io, socket, data) {
  const { username: clientUsername } = socket.userData;
  const { orderId, response, newPrice, message } = data;

  console.log(`💬 ${clientUsername} responded to counter: ${response}`);

  const order = getOrder(orderId);
  if (!order) {
    socket.emit("response-error", {
      orderId,
      error: "Order not found in real-time session",
    });
    return;
  }

  const freelancerSocketId = getUserSocketId(order.freelancerUsername);

  if (!freelancerSocketId) {
    // ===== FREELANCER WENT OFFLINE - SAVE TO DATABASE =====
    console.log(`📴 Freelancer went offline during negotiation`);

    socket.emit("save-to-database", {
      orderId,
      reason: "freelancer-offline",
      orderData: order,
      response,
      newPrice,
    });

    deleteOrder(orderId);
    return;
  }

  // ===== BOTH ONLINE - CONTINUE NEGOTIATION =====

  if (response === "accept") {
    // Client accepts freelancer's counter
    const updatedOrder = updateOrder(orderId, {
      status: "accepted",
      negotiation: {
        isNegotiating: false,
        currentOfferTo: "",
        offeredPrice: order.negotiation.offeredPrice,
      },
      acceptedAt: new Date(),
    });

    // Notify freelancer
    io.to(freelancerSocketId).emit("counter-accepted", {
      orderId,
      clientUsername,
      finalPrice: order.negotiation.offeredPrice,
      message: "Client accepted your offer",
    });

    // Confirm to client
    socket.emit("response-sent", {
      success: true,
      orderId,
      action: "accepted",
    });

    // Trigger save to database
    socket.emit("save-accepted-order", {
      orderId,
      orderData: updatedOrder,
    });

    // Remove from memory
    deleteOrder(orderId);
  } else if (response === "reject") {
    // Client rejects counter offer
    io.to(freelancerSocketId).emit("counter-rejected", {
      orderId,
      clientUsername,
      message: "Client declined your offer",
    });

    socket.emit("response-sent", {
      success: true,
      orderId,
      action: "rejected",
    });

    deleteOrder(orderId);
  } else if (response === "counter-back") {
    // Client counters back with new price
    if (!newPrice || newPrice <= 0) {
      socket.emit("response-error", {
        orderId,
        error: "Invalid counter price",
      });
      return;
    }

    const updatedOrder = updateOrder(orderId, {
      status: "offer-given",
      negotiation: {
        isNegotiating: true,
        currentOfferTo: "freelancer",
        offeredPrice: newPrice,
      },
    });

    // Notify freelancer
    io.to(freelancerSocketId).emit("client-counter-offer", {
      orderId,
      clientUsername,
      newPrice,
      message: message || `Client offered ${newPrice} ${order.currency}`,
    });

    socket.emit("response-sent", {
      success: true,
      orderId,
      action: "countered",
      newPrice,
    });

    console.log(`💰 Client counter: ${newPrice} ${order.currency}`);
  }
}

// ============================================
// GET USER'S ACTIVE ORDERS
// ============================================
export function handleGetActiveOrders(socket) {
  const { username } = socket.userData;
  const activeOrders = getUserActiveOrders(username);

  socket.emit("active-orders-list", {
    orders: activeOrders,
    count: activeOrders.length,
  });

  console.log(`📋 Sent ${activeOrders.length} active orders to ${username}`);
}

// ============================================
// HANDLE USER DISCONNECT DURING ACTIVE ORDER
// ============================================
export function handleUserDisconnectWithOrders(username) {
  const activeOrders = getUserActiveOrders(username);

  if (activeOrders.length === 0) return [];

  console.log(
    `⚠️ User ${username} disconnected with ${activeOrders.length} active orders`
  );

  // Return orders that need to be saved to database
  return activeOrders.map((order) => ({
    orderId: order.orderId,
    orderData: order,
    reason: "user-disconnected",
    disconnectedUser: username,
  }));
}
