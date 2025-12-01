// ADD THIS IMPORT AT THE TOP:
import {
  handleSendOrder,
  handleOrderResponse,
  handleCounterResponse,
  handleGetActiveOrders,
  handleUserDisconnectWithOrders,
} from "./orderHandlers.js";

// ADD THESE EVENT LISTENERS IN registerEventListeners() function
// After the existing order events section:

// ============================================
// REAL-TIME ORDER SYSTEM EVENTS
// ============================================

socket.on("send-order-realtime", (data) => {
  handleSendOrder(io, socket, data);
});

socket.on("order-response-realtime", (data) => {
  handleOrderResponse(io, socket, data);
});

socket.on("counter-response-realtime", (data) => {
  handleCounterResponse(io, socket, data);
});

socket.on("get-active-orders", () => {
  handleGetActiveOrders(socket);
});

// ADD THIS IN handleDisconnect() function:
// Before removing user from online list, add this:

function handleDisconnect(io, socket, username, reason) {
  console.log(
    `❌ User disconnected: ${username} (${socket.id}) - Reason: ${reason}`
  );

  // ===== NEW: Check for active orders =====
  const ordersToSave = handleUserDisconnectWithOrders(username);

  if (ordersToSave.length > 0) {
    // Emit event to trigger database save
    // This will be caught by a background process or the other user
    ordersToSave.forEach(({ orderId, orderData }) => {
      const otherUsername =
        orderData.clientUsername === username
          ? orderData.freelancerUsername
          : orderData.clientUsername;

      sendToUser(otherUsername, "save-order-to-database", {
        orderId,
        orderData,
        reason: "other-user-disconnected",
      });
    });
  }
  // ===== END NEW CODE =====

  // Remove user from online users
  const onlineCount = removeUser(username);

  // Broadcast updated count
  io.emit("online-users-count", onlineCount);
  console.log(`📊 Online users: ${onlineCount}`);
}
