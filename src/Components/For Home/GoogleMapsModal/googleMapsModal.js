"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import styles from "./googleMapmodal.module.css";

// Dynamically import the map component to avoid SSR issues
const DynamicMap = dynamic(() => import("../DynamicMap/dynamicMap"), {
  ssr: false,
  loading: () => (
    <div className={styles.mapLoading}>
      <div className={styles.mapLoadingSpinner}></div>
      <p>Loading map...</p>
    </div>
  ),
});

export default function GoogleMapsModal({ isOpen, onClose, address, order }) {
  const [enableLiveTracking, setEnableLiveTracking] = useState(false);
  const [trackingStarted, setTrackingStarted] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Determine if this is freelancer or client view
  const isFreelancer = order?.type === "received";
  const isClient = order?.type === "given";

  // Get real freelancer online status from order or default to true
  const freelancerOnline = order?.freelancerOnline !== false; // Default to true unless explicitly false

  // Get real coordinates from order data
  const getCoordinatesFromOrder = () => {
    if (!order) return null;

    // For client view: get client coordinates
    if (isClient && order.location?.latitude && order.location?.longitude) {
      return {
        lat: parseFloat(order.location.latitude),
        lng: parseFloat(order.location.longitude),
      };
    }

    // For freelancer view: get client coordinates from the order
    if (isFreelancer && order.location?.latitude && order.location?.longitude) {
      return {
        lat: parseFloat(order.location.latitude),
        lng: parseFloat(order.location.longitude),
      };
    }

    return null;
  };

  const orderCoords = getCoordinatesFromOrder();

  const handleTrackingToggle = () => {
    if (!enableLiveTracking) {
      setEnableLiveTracking(true);
      setTrackingStarted(true);
    } else {
      setEnableLiveTracking(false);
      setTrackingStarted(false);
    }
  };

  const handleLocationUpdate = (coords, timestamp) => {
    console.log("📍 Real location updated in modal:", coords, timestamp);

    // In a real app, you would send this to your backend/socket
    // Example API call:
    // await updateFreelancerLocation(order._id, {
    //   latitude: coords.lat.toString(),
    //   longitude: coords.lng.toString(),
    //   timestamp: timestamp.toISOString()
    // });
  };

  const handleTrackingStart = () => {
    console.log("🚀 Real live tracking started");
    setTrackingStarted(true);
  };

  const handleTrackingStop = () => {
    console.log("🛑 Live tracking stopped");
    setTrackingStarted(false);
    setEnableLiveTracking(false);
  };

  const handleCopyAddress = async () => {
    if (!address) return;

    try {
      await navigator.clipboard.writeText(address);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error("Failed to copy address:", err);
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = address;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const handleCopyCoordinates = async () => {
    if (!orderCoords) return;

    const coordsText = `${orderCoords.lat}, ${orderCoords.lng}`;
    try {
      await navigator.clipboard.writeText(coordsText);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error("Failed to copy coordinates:", err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            <span>🗺️</span>
            {isFreelancer
              ? "Navigate to Client Location"
              : "Track Freelancer Location"}
          </h2>
          <button className={styles.closeBtn} onClick={onClose}>
            ×
          </button>
        </div>

        <div className={styles.modalBody}>
          {/* Address Section - Enhanced for Freelancer */}
          <div className={styles.addressSection}>
            <h3 className={styles.addressTitle}>📍 Service Address</h3>
            <div className={styles.addressContent}>
              <p className={styles.addressText}>
                {address || order?.address || "Address not provided"}
              </p>
              {(address || order?.address) && (
                <button
                  className={`${styles.copyBtn} ${
                    copySuccess ? styles.copySuccess : ""
                  }`}
                  onClick={handleCopyAddress}
                  title="Copy address to clipboard"
                >
                  {copySuccess ? "✅ Copied!" : "📋 Copy Address"}
                </button>
              )}
            </div>

            {/* Real Coordinates for Freelancer */}
            {isFreelancer && orderCoords && (
              <div className={styles.coordinatesSection}>
                <h4 className={styles.coordinatesTitle}>
                  🎯 Exact Coordinates
                </h4>
                <div className={styles.coordinatesContent}>
                  <span className={styles.coordinatesText}>
                    {orderCoords.lat.toFixed(6)}, {orderCoords.lng.toFixed(6)}
                  </span>
                  <button
                    className={`${styles.copyBtn} ${styles.copyBtnSmall} ${
                      copySuccess ? styles.copySuccess : ""
                    }`}
                    onClick={handleCopyCoordinates}
                    title="Copy coordinates to clipboard"
                  >
                    {copySuccess ? "✅" : "📋"}
                  </button>
                </div>
                <p className={styles.coordinatesHelp}>
                  💡 Copy these coordinates to use in Google Maps or other
                  navigation apps
                </p>
              </div>
            )}
          </div>

          {/* Client Controls - Live Tracking Toggle */}
          {isClient && (
            <div className={styles.trackingControls}>
              <div className={styles.trackingInfo}>
                <h4 className={styles.trackingTitle}>🚗 Live Tracking</h4>
                <p className={styles.trackingDescription}>
                  Track your freelancer's location in real-time to know when
                  they'll arrive.
                </p>
                {!freelancerOnline && (
                  <p className={styles.offlineWarning}>
                    ⚠️ Freelancer is currently offline. Tracking will start when
                    they come online.
                  </p>
                )}
              </div>
              <button
                className={`${styles.trackingBtn} ${
                  enableLiveTracking ? styles.trackingActive : ""
                }`}
                onClick={handleTrackingToggle}
                disabled={!freelancerOnline}
              >
                {enableLiveTracking ? (
                  <>
                    <span className={styles.trackingIcon}>🔴</span>
                    Stop Tracking
                  </>
                ) : (
                  <>
                    <span className={styles.trackingIcon}>📍</span>
                    Start Live Tracking
                  </>
                )}
              </button>
            </div>
          )}

          {/* Freelancer Controls - Location Sharing */}
          {isFreelancer && (
            <div className={styles.trackingControls}>
              <div className={styles.trackingInfo}>
                <h4 className={styles.trackingTitle}>📍 Share Your Location</h4>
                <p className={styles.trackingDescription}>
                  Share your real-time location with the client so they can
                  track your arrival.
                </p>
              </div>
              <button
                className={`${styles.trackingBtn} ${
                  enableLiveTracking ? styles.trackingActive : ""
                }`}
                onClick={handleTrackingToggle}
              >
                {enableLiveTracking ? (
                  <>
                    <span className={styles.trackingIcon}>🔴</span>
                    Stop Sharing Location
                  </>
                ) : (
                  <>
                    <span className={styles.trackingIcon}>📍</span>
                    Start Sharing Location
                  </>
                )}
              </button>
            </div>
          )}

          {/* Map Component - Using Real Data */}
          <div className={styles.mapSection}>
            <DynamicMap
              clientAddress={address || order?.address}
              isFreelancer={isFreelancer}
              enableLiveTracking={enableLiveTracking}
              showDirections={isFreelancer}
              trackingInterval={30000} // 30 seconds
              onLocationUpdate={handleLocationUpdate}
              onTrackingStart={handleTrackingStart}
              onTrackingStop={handleTrackingStop}
              order={order} // Pass the real order object
              freelancerOnline={freelancerOnline}
            />
          </div>

          {/* Tracking Status */}
          {trackingStarted && (
            <div className={styles.trackingStatus}>
              <div className={styles.statusIcon}>📡</div>
              <div className={styles.statusText}>
                <h4>
                  {isFreelancer
                    ? "Location Sharing Active"
                    : "Live Tracking Active"}
                </h4>
                <p>
                  {isFreelancer
                    ? "Your location is being shared with the client"
                    : "Freelancer location updates every 30 seconds"}
                </p>
              </div>
            </div>
          )}

          {/* Real-time Status Indicators */}
          {order && (
            <div className={styles.statusIndicators}>
              <div className={styles.statusRow}>
                <div className={styles.statusItem}>
                  <span className={styles.statusLabel}>Order Status:</span>
                  <span
                    className={`${styles.statusValue} ${styles[order.status]}`}
                  >
                    {order.status?.toUpperCase() || "PENDING"}
                  </span>
                </div>
                {order.isReached?.value && (
                  <div className={styles.statusItem}>
                    <span className={styles.statusLabel}>Arrival:</span>
                    <span className={`${styles.statusValue} ${styles.arrived}`}>
                      ✅ ARRIVED
                    </span>
                  </div>
                )}
              </div>

              {order.expectedReachTime && (
                <div className={styles.statusRow}>
                  <div className={styles.statusItem}>
                    <span className={styles.statusLabel}>
                      Expected Arrival:
                    </span>
                    <span className={styles.statusValue}>
                      {new Date(order.expectedReachTime).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
