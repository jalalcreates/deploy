"use client";

import { useState, useEffect } from "react";
import styles from "./freelancerReminderModal.module.css";

// Add this after the imports and before the component function
const handleFreelancerAction = async (
  orderId,
  action,
  freelancerUsername,
  clientUsername
) => {
  try {
    const response = await fetch("/api/freelancer-reminder-action", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        orderId,
        action,
        freelancerUsername,
        clientUsername,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Action failed");
    }

    return data;
  } catch (error) {
    console.error("Freelancer action error:", error);
    throw error;
  }
};

export default function FreelancerReminderModal({
  isOpen,
  onClose,
  order,
  onReached,
  onCancel,
  freelancerUsername,
  onLocationPermission,
}) {
  const [timeRemaining, setTimeRemaining] = useState("");
  const [locationPermissionGranted, setLocationPermissionGranted] =
    useState(false);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);

  // Mock coordinates for now - will be replaced with actual Google Maps integration
  const mockCoordinates = {
    latitude: "40.7128",
    longitude: "-74.0060",
  };

  useEffect(() => {
    if (!isOpen || !order?.expectedReachTime) return;

    const updateTimer = () => {
      const now = new Date();
      const expectedTime = new Date(order.expectedReachTime);
      const timeDiff = expectedTime - now;

      if (timeDiff <= 0) {
        setTimeRemaining("Time's up!");
        return;
      }

      const hours = Math.floor(timeDiff / (1000 * 60 * 60));
      const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

      setTimeRemaining(
        `${hours.toString().padStart(2, "0")}:${minutes
          .toString()
          .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
      );
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [isOpen, order?.expectedReachTime]);

  useEffect(() => {
    // Auto-request location permission when modal opens
    if (isOpen && !locationPermissionGranted) {
      handleLocationRequest();
    }
  }, [isOpen]);

  const handleLocationRequest = async () => {
    setIsRequestingLocation(true);

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      setLocationPermissionGranted(true);
      onLocationPermission?.(true, {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    } catch (error) {
      console.error("Location permission denied:", error);
      onLocationPermission?.(false, null);
    } finally {
      setIsRequestingLocation(false);
    }
  };

  const handleReached = async () => {
    try {
      const result = await handleFreelancerAction(
        order.orderId || order._id,
        "reached",
        freelancerUsername,
        order.customerInfo?.username
      );

      console.log("Successfully marked as reached:", result);
      onReached(order.orderId || order._id);
    } catch (error) {
      console.error("Failed to mark as reached:", error);
      alert("Failed to update status. Please try again.");
    }
  };

  const handleCancel = async () => {
    if (
      !confirm(
        "Are you sure you want to cancel this order? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      const result = await handleFreelancerAction(
        order.orderId || order._id,
        "cancel",
        freelancerUsername,
        order.customerInfo?.username
      );

      console.log("Successfully cancelled order:", result);
    } catch (error) {
      console.error("Failed to cancel order:", error);
      alert("Failed to cancel order. Please try again.");
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen || !order) return null;

  return (
    <div className={styles.modalOverlay} onClick={handleOverlayClick}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        {/* Enhanced Header */}
        <div className={styles.cardHeader}>
          <div className={styles.headerContent}>
            <div className={styles.headerTitle}>
              <div className={styles.titleWithIcon}>
                <span className={styles.headerIcon}>🚗</span>
                <h1>Time to Go!</h1>
              </div>
              <button
                className={styles.closeBtn}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onClose();
                }}
                type="button"
              >
                ×
              </button>
            </div>
            <p className={styles.headerDescription}>
              You have an accepted order waiting. Time to head to your client's
              location!
            </p>
          </div>
        </div>

        <div className={styles.cardContent}>
          {/* Client Information */}
          <div className={styles.clientSection}>
            <div className={styles.clientAvatar}>
              {order.customerInfo?.profilePicture ? (
                <img
                  src={order.customerInfo.profilePicture || "/placeholder.svg"}
                  alt={order.customerInfo.username}
                />
              ) : (
                <div className={styles.clientAvatarFallback}>
                  {(order.customerInfo?.username || order.user || "C")
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>
              )}
            </div>
            <div className={styles.clientInfo}>
              <h3 className={styles.clientName}>
                {order.customerInfo?.username || order.user || "Client"}
              </h3>
              <p className={styles.clientService}>
                {order.problemDescription?.substring(0, 50) + "..." ||
                  "Service Request"}
              </p>
            </div>
          </div>

          {/* Countdown Timer */}
          <div className={styles.timerSection}>
            <div className={styles.timerTitle}>
              <span>⏰</span>
              Time Remaining
            </div>
            <div className={styles.timerDisplay}>{timeRemaining}</div>
            <div className={styles.timerLabel}>
              Expected arrival:{" "}
              {new Date(order.expectedReachTime).toLocaleString()}
            </div>
          </div>

          {/* Address Section */}
          <div className={styles.addressSection}>
            <div className={styles.addressTitle}>
              <span>📍</span>
              Destination Address
            </div>
            <div className={styles.addressText}>
              {order.address || "Address not provided"}
            </div>
            <div className={styles.addressCoords}>
              <span>🗺️</span>
              Coordinates: {mockCoordinates.latitude},{" "}
              {mockCoordinates.longitude}
            </div>
          </div>

          {/* Location Permission Status */}
          <div className={styles.locationSection}>
            <div className={styles.locationTitle}>
              <span>📡</span>
              Location Tracking
            </div>
            {isRequestingLocation ? (
              <div className={styles.locationStatus}>
                <div className={styles.loadingSpinner}></div>
                <span>Requesting location permission...</span>
              </div>
            ) : locationPermissionGranted ? (
              <div className={`${styles.locationStatus} ${styles.granted}`}>
                <span>✅</span>
                <span>Location tracking enabled</span>
              </div>
            ) : (
              <div className={`${styles.locationStatus} ${styles.denied}`}>
                <span>❌</span>
                <span>Location permission denied</span>
                <button
                  className={styles.retryLocationBtn}
                  onClick={handleLocationRequest}
                >
                  Retry
                </button>
              </div>
            )}
          </div>

          {/* Order Details */}
          <div className={styles.orderDetails}>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Payment:</span>
              <span className={styles.detailValue}>
                {order.currency === "USD" && "$"}
                {order.currency === "EUR" && "€"}
                {order.currency === "GBP" && "£"}
                {order.priceToBePaid}
              </span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>City:</span>
              <span className={styles.detailValue}>{order.city}</span>
            </div>
            {order.deadline && (
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Deadline:</span>
                <span className={styles.detailValue}>
                  {new Date(order.deadline).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className={styles.actionButtons}>
            <button className={styles.cancelBtn} onClick={handleCancel}>
              🚫 Cancel Order
            </button>
            <button className={styles.reachedBtn} onClick={handleReached}>
              ✅ I Have Reached
            </button>
          </div>

          {/* Quick Actions */}
          <div className={styles.quickActions}>
            <button className={styles.quickActionBtn}>🧭 Get Directions</button>
            <button className={styles.quickActionBtn}>📞 Call Client</button>
            <button className={styles.quickActionBtn}>💬 Message Client</button>
          </div>
        </div>
      </div>
    </div>
  );
}
