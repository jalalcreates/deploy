// hooks/useNotifications.js
"use client";

import { useState, useEffect, useCallback } from "react";
import { listenForNewServiceRequests, listenForNewOffers } from "@/Actions/ServiceRequests/serviceRequestSocketClient";

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
    if (!username || !city) return;

    const unsubscribe = listenForNewServiceRequests((serviceRequest) => {
      // Don't count requests created by the current user
      if (serviceRequest.customerInfo?.username !== username) {
        setRequestsCount((prev) => {
          const newCount = prev + 1;
          localStorage.setItem(`${username}_requestsCount`, newCount.toString());
          return newCount;
        });
        setHasSeenRequests(false);
        localStorage.setItem(`${username}_hasSeenRequests`, 'false');
        console.log("🔔 New service request notification");
      }
    });

    return unsubscribe;
  }, [username, city]);

  // Listen for new offers in real-time
  useEffect(() => {
    if (!username) return;

    const unsubscribe = listenForNewOffers((data) => {
      setOffersCount((prev) => {
        const newCount = prev + 1;
        localStorage.setItem(`${username}_offersCount`, newCount.toString());
        return newCount;
      });
      setHasSeenOffers(false);
      localStorage.setItem(`${username}_hasSeenOffers`, 'false');
      console.log("🔔 New offer notification");
    });

    return unsubscribe;
  }, [username]);

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
