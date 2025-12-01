// src/Socket_IO/orderMemory.js
// Manages active orders in memory during real-time sessions

// Map<orderId, orderData>
const activeOrders = new Map();

// Map<username, Set<orderId>> - Track which orders each user is involved in
const userOrders = new Map();

export function createOrder(orderId, orderData) {
  activeOrders.set(orderId, {
    ...orderData,
    createdAt: new Date(),
    lastUpdated: new Date(),
    isRealtime: true,
  });

  // Track for client
  if (!userOrders.has(orderData.clientUsername)) {
    userOrders.set(orderData.clientUsername, new Set());
  }
  userOrders.get(orderData.clientUsername).add(orderId);

  // Track for freelancer
  if (!userOrders.has(orderData.freelancerUsername)) {
    userOrders.set(orderData.freelancerUsername, new Set());
  }
  userOrders.get(orderData.freelancerUsername).add(orderId);

  console.log(`📦 Created real-time order in memory: ${orderId}`);
  return activeOrders.get(orderId);
}

export function getOrder(orderId) {
  return activeOrders.get(orderId) || null;
}

export function updateOrder(orderId, updates) {
  const order = activeOrders.get(orderId);
  if (!order) {
    console.warn(`⚠️ Order ${orderId} not found in memory`);
    return null;
  }

  const updatedOrder = {
    ...order,
    ...updates,
    lastUpdated: new Date(),
  };

  activeOrders.set(orderId, updatedOrder);
  console.log(`✏️ Updated order ${orderId} in memory`);
  return updatedOrder;
}

export function deleteOrder(orderId) {
  const order = activeOrders.get(orderId);
  if (!order) return false;

  // Remove from user tracking
  if (userOrders.has(order.clientUsername)) {
    userOrders.get(order.clientUsername).delete(orderId);
  }
  if (userOrders.has(order.freelancerUsername)) {
    userOrders.get(order.freelancerUsername).delete(orderId);
  }

  activeOrders.delete(orderId);
  console.log(`🗑️ Deleted order ${orderId} from memory`);
  return true;
}

export function getUserActiveOrders(username) {
  const orderIds = userOrders.get(username);
  if (!orderIds) return [];

  return Array.from(orderIds)
    .map((orderId) => activeOrders.get(orderId))
    .filter(Boolean);
}

export function getAllActiveOrders() {
  return Array.from(activeOrders.values());
}

export function getOrderCount() {
  return activeOrders.size;
}

export function clearAllOrders() {
  const count = activeOrders.size;
  activeOrders.clear();
  userOrders.clear();
  console.log(`🧹 Cleared ${count} orders from memory`);
  return count;
}
