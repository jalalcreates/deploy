// Context/SocketContext.js
"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  initializeSocket,
  disconnectSocket,
  getSocket,
  isSocketConnected,
  emitEvent,
  onEvent,
  offEvent,
} from "@/Socket_IO/socket";

const SocketContext = createContext(null);

export function SocketProvider({ children, initialUserData }) {
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsersCount, setOnlineUsersCount] = useState(0);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Only initialize socket if user is logged in
    if (!initialUserData || !initialUserData.username) {
      console.log("No user data, skipping socket initialization");
      return;
    }

    // Initialize socket connection
    let socketInstance = null;

    const connectSocket = async () => {
      try {
        // Pass user data (city and isFreelancer) to socket initialization
        socketInstance = await initializeSocket(initialUserData);
        setSocket(socketInstance);
        setIsConnected(true);

        // Listen for online users count
        onEvent("online-users-count", (count) => {
          setOnlineUsersCount(count);
        });

        // Listen for connection status changes
        socketInstance.on("connect", () => setIsConnected(true));
        socketInstance.on("disconnect", () => setIsConnected(false));
      } catch (error) {
        console.error("Failed to connect socket:", error);
        setIsConnected(false);
      }
    };

    connectSocket();

    // Cleanup on unmount
    return () => {
      if (socketInstance) {
        offEvent("online-users-count");
        disconnectSocket();
        setSocket(null);
        setIsConnected(false);
      }
    };
  }, [initialUserData]);

  const value = {
    socket: socket || getSocket(),
    isConnected,
    onlineUsersCount,
    emit: emitEvent,
    on: onEvent,
    off: offEvent,
    isSocketConnected,
  };

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within SocketProvider");
  }
  return context;
}
