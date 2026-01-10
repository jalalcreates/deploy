// hooks/useNotifications.js
"use client";

import { useState, useEffect, useCallback } from "react";
import { getSocket } from "@/Socket_IO/socket";

/**
 * Custom hook for managing notification counts for service requests and offers
 * @param {string} username - Current user's username
 * @param {string} city - Current user's city
 * @returns {object} - Notification counts and handlers
 */
export function useNotifications(username, city) {
  const [requestsCount, setRequestsCount] = useState(0);
  const [offersCount, setOffersCount] = useState(0);
  const [hasSeenRequests, setHasSeenRequests] = useState(true);
  const [hasSeenOffers, setHasSeenOffers] = useState(true);
  const [isSocketReady, setIsSocketReady] = useState(false);

  // Monitor socket connection status
  useEffect(() => {
    const socket = getSocket();

    if (!socket) {
      setIsSocketReady(false);
      return;
    }

    const checkConnection = () => {
      setIsSocketReady(socket.connected);
    };

    // Initial check
    checkConnection();

    // Listen for connection changes
    socket.on("connect", checkConnection);
    socket.on("disconnect", checkConnection);

    return () => {
      socket.off("connect", checkConnection);
      socket.off("disconnect", checkConnection);
    };
  }, []);

  // Load initial counts from localStorage
  useEffect(() => {
    if (!username) return;

    const storedRequestsCount = localStorage.getItem(`${username}_requestsCount`);
    const storedOffersCount = localStorage.getItem(`${username}_offersCount`);
    const storedSeenRequests = localStorage.getItem(`${username}_hasSeenRequests`);
    const storedSeenOffers = localStorage.getItem(`${username}_hasSeenOffers`);

    if (storedRequestsCount) setRequestsCount(parseInt(storedRequestsCount, 10));
    if (storedOffersCount) setOffersCount(parseInt(storedOffersCount, 10));
    if (storedSeenRequests) setHasSeenRequests(storedSeenRequests === 'true');
    if (storedSeenOffers) setHasSeenOffers(storedSeenOffers === 'true');
  }, [username]);

  // Listen for new service requests in real-time
  useEffect(() => {
    if (!username || !city || !isSocketReady) {
      console.log("⏸️ Notification listener waiting for:", { username, city, isSocketReady });
      return;
    }

    const socket = getSocket();
    if (!socket || !socket.connected) {
      console.warn("⚠️ Socket not available for service requests listener");
      return;
    }

    const handleNewServiceRequest = (serviceRequest) => {
      console.log("📨 [useNotifications] New service request received:", serviceRequest);

      // Only count requests from other users in the same city
      if (serviceRequest.customerInfo?.username !== username && serviceRequest.city === city) {
        setRequestsCount((prev) => {
          const newCount = prev + 1;
          localStorage.setItem(`${username}_requestsCount`, newCount.toString());
          console.log(`🔔 Service request notification count: ${newCount}`);
          return newCount;
        });
        setHasSeenRequests(false);
        localStorage.setItem(`${username}_hasSeenRequests`, 'false');
      }
    };

    console.log(`✅ Registering service requests listener for ${username} in ${city}`);
    socket.on("new-service-request-realtime", handleNewServiceRequest);

    return () => {
      console.log(`🧹 Cleaning up service requests listener for ${username}`);
      socket.off("new-service-request-realtime", handleNewServiceRequest);
    };
  }, [username, city, isSocketReady]);

  // Listen for new offers in real-time
  useEffect(() => {
    if (!username || !isSocketReady) {
      console.log("⏸️ Offers listener waiting for:", { username, isSocketReady });
      return;
    }

    const socket = getSocket();
    if (!socket || !socket.connected) {
      console.warn("⚠️ Socket not available for offers listener");
      return;
    }

    const handleNewOffer = (data) => {
      console.log("💼 [useNotifications] New offer received:", data);

      setOffersCount((prev) => {
        const newCount = prev + 1;
        localStorage.setItem(`${username}_offersCount`, newCount.toString());
        console.log(`🔔 Offer notification count: ${newCount}`);
        return newCount;
      });
      setHasSeenOffers(false);
      localStorage.setItem(`${username}_hasSeenOffers`, 'false');
    };

    console.log(`✅ Registering offers listener for ${username}`);
    socket.on("new-offer-received-realtime", handleNewOffer);

    return () => {
      console.log(`🧹 Cleaning up offers listener for ${username}`);
      socket.off("new-offer-received-realtime", handleNewOffer);
    };
  }, [username, isSocketReady]);

  // Mark requests as seen
  const markRequestsAsSeen = useCallback(() => {
    setHasSeenRequests(true);
    setRequestsCount(0);
    if (username) {
      localStorage.setItem(`${username}_hasSeenRequests`, 'true');
      localStorage.setItem(`${username}_requestsCount`, '0');
    }
  }, [username]);

  // Mark offers as seen
  const markOffersAsSeen = useCallback(() => {
    setHasSeenOffers(true);
    setOffersCount(0);
    if (username) {
      localStorage.setItem(`${username}_hasSeenOffers`, 'true');
      localStorage.setItem(`${username}_offersCount`, '0');
    }
  }, [username]);

  // Increment requests count manually (e.g., on page load when fetching unseen requests)
  const setInitialRequestsCount = useCallback((count) => {
    setRequestsCount(count);
    if (username && count > 0) {
      localStorage.setItem(`${username}_requestsCount`, count.toString());
      setHasSeenRequests(false);
      localStorage.setItem(`${username}_hasSeenRequests`, 'false');
    }
  }, [username]);

  // Increment offers count manually (e.g., on page load when fetching unseen offers)
  const setInitialOffersCount = useCallback((count) => {
    setOffersCount(count);
    if (username && count > 0) {
      localStorage.setItem(`${username}_offersCount`, count.toString());
      setHasSeenOffers(false);
      localStorage.setItem(`${username}_hasSeenOffers`, 'false');
    }
  }, [username]);

  return {
    requestsCount,
    offersCount,
    hasSeenRequests,
    hasSeenOffers,
    showRequestsBadge: !hasSeenRequests && requestsCount > 0,
    showOffersBadge: !hasSeenOffers && offersCount > 0,
    markRequestsAsSeen,
    markOffersAsSeen,
    setInitialRequestsCount,
    setInitialOffersCount,
  };
}
