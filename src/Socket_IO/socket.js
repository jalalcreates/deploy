// Socket_IO/socket.js
"use client";

import { io } from "socket.io-client";

let socket = null;
let isConnecting = false;

/**
 * Initialize socket connection with authentication
 * This should be called after user logs in
 * @param {object} userData - User data containing city and isFreelancer
 */
export async function initializeSocket(userData = {}) {
  // Prevent multiple simultaneous connection attempts
  if (isConnecting || (socket && socket.connected)) {
    console.log("Socket already connected or connecting");
    return socket;
  }

  isConnecting = true;

  try {
    // Fetch access token from API route
    const response = await fetch("/api/socket-auth", {
      method: "GET",
      credentials: "include",
    });

    const data = await response.json();

    if (!data.success || !data.token) {
      throw new Error("Failed to retrieve authentication token");
    }

    // Create socket connection with auth token and user metadata
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000";
    socket = io(socketUrl, {
      auth: {
        token: data.token,
        city: userData.currentCity || userData.city,
        isFreelancer: userData.isFreelancer || false,
      },
      credentials: "include",
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
    });

    // Connection successful
    socket.on("connect", () => {
      console.log(`✅ Connected to Socket.IO server with ID: ${socket.id}`);
      isConnecting = false;
    });

    // Authentication successful
    socket.on("authenticated", (data) => {
      console.log("🔐 Authentication successful:", data);
    });

    // Connection error
    socket.on("connect_error", (error) => {
      console.error("❌ Socket connection error:", error.message);
      isConnecting = false;

      // If authentication fails, try to reconnect with new token
      if (error.message.includes("Authentication error")) {
        console.log(
          "🔄 Authentication failed, will retry on next connection attempt"
        );
      }
    });

    // Disconnection
    socket.on("disconnect", (reason) => {
      console.log(`🔌 Disconnected from server: ${reason}`);
      isConnecting = false;

      // Automatic reconnection is handled by socket.io
      if (reason === "io server disconnect") {
        // Server disconnected, manually reconnect
        socket.connect();
      }
    });

    // Reconnection attempt
    socket.on("reconnect_attempt", (attemptNumber) => {
      console.log(`🔄 Reconnection attempt ${attemptNumber}`);
    });

    // Reconnection successful
    socket.on("reconnect", (attemptNumber) => {
      console.log(`✅ Reconnected after ${attemptNumber} attempts`);
    });

    // Failed to reconnect
    socket.on("reconnect_failed", () => {
      console.error("❌ Failed to reconnect to server");
      isConnecting = false;
    });

    return socket;
  } catch (error) {
    console.error("Failed to initialize socket:", error);
    isConnecting = false;
    throw error;
  }
}

/**
 * Get current socket instance
 */
export function getSocket() {
  if (!socket) {
    console.warn("Socket not initialized. Call initializeSocket() first.");
    return null;
  }
  return socket;
}

/**
 * Disconnect socket
 */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    console.log("Socket disconnected manually");
  }
}

/**
 * Check if socket is connected
 */
export function isSocketConnected() {
  return socket && socket.connected;
}

/**
 * Emit event to server
 */
export function emitEvent(eventName, data) {
  if (socket && socket.connected) {
    socket.emit(eventName, data);
    return true;
  }
  console.warn("Socket not connected. Cannot emit event:", eventName);
  return false;
}

/**
 * Listen to event from server
 */
export function onEvent(eventName, callback) {
  if (socket) {
    socket.on(eventName, callback);
    return true;
  }
  console.warn("Socket not initialized. Cannot listen to event:", eventName);
  return false;
}

/**
 * Remove event listener
 */
export function offEvent(eventName, callback) {
  if (socket) {
    socket.off(eventName, callback);
    return true;
  }
  return false;
}

// Export socket for backward compatibility (but prefer using helper functions)
export { socket };
