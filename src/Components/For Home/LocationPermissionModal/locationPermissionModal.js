"use client";

import { useState } from "react";
import styles from "./LocationPermissionModal.module.css";

export default function LocationPermissionModal({
  isOpen,
  onClose,
  onPermissionGranted,
  order, // NEW: Receive order as prop
}) {
  const [isRequesting, setIsRequesting] = useState(false);

  const handleAllowLocation = async () => {
    setIsRequesting(true);

    try {
      console.log("📍 Requesting location permission...");

      // Check if geolocation is available
      if (!navigator.geolocation) {
        throw new Error("Geolocation is not supported by your browser");
      }

      // Request geolocation permission
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            console.log("✅ Location permission granted:", pos.coords);
            resolve(pos);
          },
          (err) => {
            console.error("❌ Location permission error:", err);
            reject(err);
          },
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0,
          }
        );
      });

      const { latitude, longitude } = position.coords;
      console.log("📍 Coordinates obtained:", { latitude, longitude });

      // Import socket dynamically
      const { getSocket } = await import("@/Socket_IO/socket");
      const socket = getSocket();

      if (socket && socket.connected && order) {
        // Emit location via socket
        socket.emit("share-location-realtime", {
          orderId: order.orderId,
          latitude: latitude.toString(),
          longitude: longitude.toString(),
        });

        console.log("✅ Location shared via socket for order:", order.orderId);
      } else {
        console.warn("⚠️ Socket not connected, will save to database via parent");
      }

      // Permission granted - pass coordinates back
      onPermissionGranted(true, { latitude, longitude });
      console.log("✅ Location permission callback invoked");
    } catch (error) {
      // Permission denied or error
      console.error("❌ Location permission error:", error);
      alert(`Location access failed: ${error.message || "Permission denied"}. Please enable location access in your browser settings.`);
      onPermissionGranted(false, null);
    } finally {
      setIsRequesting(false);
    }
  };

  const handleDenyLocation = () => {
    onPermissionGranted(false);
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            <span>📍</span>
            Location Permission Required
          </h2>
          <button className={styles.closeBtn} onClick={onClose}>
            ×
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.locationIcon}>🗺️</div>

          <div className={styles.permissionText}>
            <h3 className={styles.permissionTitle}>
              Share your location with the freelancer
            </h3>
            <p className={styles.permissionDescription}>
              Your order has been accepted! To help the freelancer find you and
              provide the best service, please allow access to your location.
            </p>
          </div>

          <div className={styles.benefitsList}>
            <div className={styles.benefitItem}>
              <span className={styles.benefitIcon}>✅</span>
              <span>Freelancer can navigate to your exact location</span>
            </div>
            <div className={styles.benefitItem}>
              <span className={styles.benefitIcon}>⏱️</span>
              <span>Get accurate arrival time estimates</span>
            </div>
            <div className={styles.benefitItem}>
              <span className={styles.benefitIcon}>🔒</span>
              <span>Your location is only shared with your freelancer</span>
            </div>
          </div>

          <div className={styles.actionButtons}>
            <button
              className={styles.denyBtn}
              onClick={handleDenyLocation}
              disabled={isRequesting}
            >
              Not Now
            </button>
            <button
              className={styles.allowBtn}
              onClick={handleAllowLocation}
              disabled={isRequesting}
            >
              {isRequesting ? "Requesting..." : "Allow Location"}
            </button>
          </div>

          <div className={styles.privacyNote}>
            <span>🔐</span>
            <span>
              We respect your privacy. Location data is only used for this
              service and is not stored.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
