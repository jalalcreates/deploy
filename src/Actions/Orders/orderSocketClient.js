// Actions/Orders/orderSocketClient.js
"use client";

import { getSocket } from "@/Socket_IO/socket";

// ============================================
// CHECK IF FREELANCER IS ONLINE
// ============================================
export function checkFreelancerOnline(freelancerUsername) {
  return new Promise((resolve) => {
    const socket = getSocket();

    if (!socket || !socket.connected) {
      resolve(false);
      return;
    }

    const timeoutId = setTimeout(() => {
      socket.off("user-online-status", handler);
      resolve(false);
    }, 3000);

    const handler = (data) => {
      if (data.username === freelancerUsername) {
        clearTimeout(timeoutId);
        socket.off("user-online-status", handler);
        resolve(data.isOnline);
      }
    };

    socket.on("user-online-status", handler);
    socket.emit("check-user-online", freelancerUsername);
  });
}

// ============================================
// SEND ORDER IN REAL-TIME
// ============================================
export function sendOrderRealtime(freelancerUsername, orderData) {
  return new Promise((resolve, reject) => {
    const socket = getSocket();

    if (!socket || !socket.connected) {
      reject(new Error("Socket not connected"));
      return;
    }

    const timeoutId = setTimeout(() => {
      socket.off("order-status", handler);
      reject(new Error("Request timeout"));
    }, 10000);

    const handler = (response) => {
      if (response.orderId === orderData.orderId) {
        clearTimeout(timeoutId);
        socket.off("order-status", handler);
        resolve(response);
      }
    };

    socket.on("order-status", handler);

    socket.emit("send-order-realtime", {
      freelancerUsername,
      orderData,
    });
  });
}

// ============================================
// LISTEN FOR INCOMING ORDERS (FREELANCER)
// ============================================
export function listenForRealtimeOrders(callback) {
  const socket = getSocket();

  if (!socket) {
    console.warn("Socket not available");
    return () => {};
  }

  const handler = (orderData) => {
    console.log("📦 New real-time order received:", orderData);
    callback(orderData);
  };

  socket.on("new-order-realtime", handler);

  return () => {
    socket.off("new-order-realtime", handler);
  };
}

// ============================================
// RESPOND TO ORDER (FREELANCER)
// ============================================
export function respondToOrderRealtime(
  orderId,
  response,
  newPrice = null,
  message = ""
) {
  return new Promise((resolve, reject) => {
    const socket = getSocket();

    if (!socket || !socket.connected) {
      reject(new Error("Socket not connected"));
      return;
    }

    const timeoutId = setTimeout(() => {
      socket.off("response-sent", handler);
      socket.off("response-error", errorHandler);
      reject(new Error("Request timeout"));
    }, 5000);

    const handler = (data) => {
      if (data.orderId === orderId) {
        clearTimeout(timeoutId);
        socket.off("response-sent", handler);
        socket.off("response-error", errorHandler);
        resolve(data);
      }
    };

    const errorHandler = (error) => {
      if (error.orderId === orderId) {
        clearTimeout(timeoutId);
        socket.off("response-sent", handler);
        socket.off("response-error", errorHandler);
        reject(new Error(error.error));
      }
    };

    socket.on("response-sent", handler);
    socket.on("response-error", errorHandler);

    socket.emit("order-response-realtime", {
      orderId,
      response, // "accept" | "reject" | "counter"
      newPrice,
      message,
    });
  });
}

// ============================================
// LISTEN FOR ORDER ACCEPTED (CLIENT)
// ============================================
export function listenForOrderAccepted(callback) {
  const socket = getSocket();
  if (!socket) return () => {};

  socket.on("order-accepted", callback);
  return () => socket.off("order-accepted", callback);
}

// ============================================
// LISTEN FOR ORDER REJECTED (CLIENT)
// ============================================
export function listenForOrderRejected(callback) {
  const socket = getSocket();
  if (!socket) return () => {};

  socket.on("order-rejected", callback);
  return () => socket.off("order-rejected", callback);
}

// ============================================
// LISTEN FOR COUNTER OFFER (CLIENT)
// ============================================
export function listenForCounterOffer(callback) {
  const socket = getSocket();
  if (!socket) return () => {};

  socket.on("order-counter-offer", callback);
  return () => socket.off("order-counter-offer", callback);
}

// ============================================
// RESPOND TO COUNTER OFFER (CLIENT)
// ============================================
export function respondToCounterOffer(
  orderId,
  response,
  newPrice = null,
  message = ""
) {
  return new Promise((resolve, reject) => {
    const socket = getSocket();

    if (!socket || !socket.connected) {
      reject(new Error("Socket not connected"));
      return;
    }

    const timeoutId = setTimeout(() => {
      socket.off("response-sent", handler);
      socket.off("response-error", errorHandler);
      reject(new Error("Request timeout"));
    }, 5000);

    const handler = (data) => {
      if (data.orderId === orderId) {
        clearTimeout(timeoutId);
        socket.off("response-sent", handler);
        socket.off("response-error", errorHandler);
        resolve(data);
      }
    };

    const errorHandler = (error) => {
      if (error.orderId === orderId) {
        clearTimeout(timeoutId);
        socket.off("response-sent", handler);
        socket.off("response-error", errorHandler);
        reject(new Error(error.error));
      }
    };

    socket.on("response-sent", handler);
    socket.on("response-error", errorHandler);

    socket.emit("counter-response-realtime", {
      orderId,
      response, // "accept" | "reject" | "counter-back"
      newPrice,
      message,
    });
  });
}

// ============================================
// LISTEN FOR COUNTER ACCEPTED (FREELANCER)
// ============================================
export function listenForCounterAccepted(callback) {
  const socket = getSocket();
  if (!socket) return () => {};

  socket.on("counter-accepted", callback);
  return () => socket.off("counter-accepted", callback);
}

// ============================================
// LISTEN FOR COUNTER REJECTED (FREELANCER)
// ============================================
export function listenForCounterRejected(callback) {
  const socket = getSocket();
  if (!socket) return () => {};

  socket.on("counter-rejected", callback);
  return () => socket.off("counter-rejected", callback);
}

// ============================================
// LISTEN FOR CLIENT COUNTER OFFER (FREELANCER)
// ============================================
export function listenForClientCounterOffer(callback) {
  const socket = getSocket();
  if (!socket) return () => {};

  socket.on("client-counter-offer", callback);
  return () => socket.off("client-counter-offer", callback);
}

// ============================================
// SAVE ACCEPTED ORDER TO DATABASE
// ============================================
export function listenForSaveAcceptedOrder(callback) {
  const socket = getSocket();
  if (!socket) return () => {};

  socket.on("save-accepted-order", callback);
  return () => socket.off("save-accepted-order", callback);
}

// ============================================
// SAVE TO DATABASE (WHEN USER GOES OFFLINE)
// ============================================
export function listenForSaveToDatabase(callback) {
  const socket = getSocket();
  if (!socket) return () => {};

  socket.on("save-to-database", callback);
  socket.on("save-order-to-database", callback);

  return () => {
    socket.off("save-to-database", callback);
    socket.off("save-order-to-database", callback);
  };
}
