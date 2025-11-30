"use client";

import { useEffect, useState, useRef } from "react";
import styles from "./dynamicMap.module.css";

const DynamicMap = ({
  // Core props
  clientAddress = null,
  isFreelancer = false,
  enableLiveTracking = false,

  // Advanced props
  showDirections = false,
  trackingInterval = 30000, // 30 seconds default
  onLocationUpdate = null,
  onTrackingStart = null,
  onTrackingStop = null,

  // Real data props (replacing mock data)
  order = null, // Pass the actual order object
  freelancerOnline = true,
}) => {
  const mapRef = useRef();
  const intervalRef = useRef(null);
  const trackingStartTimeRef = useRef(null);
  const watchIdRef = useRef(null);

  // State management
  const [clientCoords, setClientCoords] = useState(null);
  const [freelancerCoords, setFreelancerCoords] = useState(null);
  const [lastTrackedAt, setLastTrackedAt] = useState(null);
  const [trackingDuration, setTrackingDuration] = useState(0);
  const [isTracking, setIsTracking] = useState(false);
  const [locationHistory, setLocationHistory] = useState([]);
  const [error, setError] = useState(null);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const [distance, setDistance] = useState(null);
  const [locationPermissionDenied, setLocationPermissionDenied] =
    useState(false);

  // Initialize freelancer coordinates from order data
  useEffect(() => {
    if (!order) return;

    // For client view: get freelancer's current location from order
    if (!isFreelancer && order.type === "given") {
      // Check if freelancer has shared location in the order
      if (
        order.freelancerLocation?.latitude &&
        order.freelancerLocation?.longitude
      ) {
        const coords = {
          lat: parseFloat(order.freelancerLocation.latitude),
          lng: parseFloat(order.freelancerLocation.longitude),
        };
        setFreelancerCoords(coords);
        console.log("📍 Loaded freelancer location from order:", coords);
      }
    }

    // For freelancer view: get client location from order
    if (isFreelancer && order.type === "received") {
      if (order.location?.latitude && order.location?.longitude) {
        const coords = {
          lat: parseFloat(order.location.latitude),
          lng: parseFloat(order.location.longitude),
        };
        setClientCoords(coords);
        console.log("📍 Loaded client location from order:", coords);
        return; // Skip address geocoding if we have coordinates
      }
    }
  }, [order, isFreelancer]);

  // Enhanced geocoding with multiple attempts and better error handling
  useEffect(() => {
    if (!clientAddress) return;

    // Skip geocoding if we already have client coordinates from order
    if (clientCoords) return;

    const fetchClientCoords = async () => {
      try {
        setIsLoadingAddress(true);
        setError(null);

        // Try multiple geocoding approaches
        const geocodingAttempts = [
          // Primary: Nominatim with detailed query
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            clientAddress
          )}&limit=1&addressdetails=1`,
          // Fallback: Nominatim with simplified query (remove house numbers, etc.)
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            clientAddress.split(",")[0]
          )}&limit=1&addressdetails=1`,
          // Last resort: Just the city/area name
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            clientAddress.split(" ").slice(-3).join(" ")
          )}&limit=1&addressdetails=1`,
        ];

        let coords = null;
        let attemptIndex = 0;

        for (const url of geocodingAttempts) {
          try {
            console.log(`🔍 Geocoding attempt ${attemptIndex + 1}:`, url);
            const response = await fetch(url);
            const data = await response.json();

            if (data.length > 0) {
              const { lat, lon, display_name } = data[0];
              coords = {
                lat: Number.parseFloat(lat),
                lng: Number.parseFloat(lon),
                display_name,
              };
              console.log(
                `✅ Geocoding successful on attempt ${attemptIndex + 1}:`,
                coords
              );
              break;
            }
            attemptIndex++;
          } catch (err) {
            console.warn(
              `⚠️ Geocoding attempt ${attemptIndex + 1} failed:`,
              err
            );
            attemptIndex++;
            continue;
          }
        }

        if (coords) {
          setClientCoords(coords);
          console.log("📍 Client coordinates fetched:", coords);
        } else {
          setError(
            `Address "${clientAddress}" could not be found. Please check the address or try a more general location.`
          );
        }
      } catch (err) {
        console.error("Error fetching client coordinates:", err);
        setError("Failed to fetch address coordinates. Please try again.");
      } finally {
        setIsLoadingAddress(false);
      }
    };

    fetchClientCoords();
  }, [clientAddress, clientCoords]);

  // Calculate distance between freelancer and client
  useEffect(() => {
    if (clientCoords && freelancerCoords) {
      const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371; // Radius of the Earth in kilometers
        const dLat = (lat2 - lat1) * (Math.PI / 180);
        const dLon = (lon2 - lon1) * (Math.PI / 180);
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * (Math.PI / 180)) *
            Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;
        return distance;
      };

      const dist = calculateDistance(
        clientCoords.lat,
        clientCoords.lng,
        freelancerCoords.lat,
        freelancerCoords.lng
      );
      setDistance(dist.toFixed(2));
    }
  }, [clientCoords, freelancerCoords]);

  // Real-time location tracking functionality (only for freelancers)
  useEffect(() => {
    if (!enableLiveTracking || !isFreelancer) {
      // Clean up any existing tracking
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsTracking(false);
      onTrackingStop?.();
      return;
    }

    // Check if geolocation is supported
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser");
      return;
    }

    const startTracking = () => {
      setIsTracking(true);
      trackingStartTimeRef.current = new Date();
      onTrackingStart?.();

      // Use watchPosition for continuous tracking
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          const newCoords = { lat: latitude, lng: longitude };
          const timestamp = new Date();

          setFreelancerCoords(newCoords);
          setLastTrackedAt(timestamp.toLocaleTimeString());
          setLocationPermissionDenied(false);

          // Add to location history
          setLocationHistory((prev) => [
            ...prev.slice(-10), // Keep last 10 locations
            {
              coords: newCoords,
              timestamp: timestamp.toISOString(),
              accuracy,
            },
          ]);

          // Calculate tracking duration
          if (trackingStartTimeRef.current) {
            const duration = Math.floor(
              (timestamp - trackingStartTimeRef.current) / 1000
            );
            setTrackingDuration(duration);
          }

          // Callback for parent component with real location data
          onLocationUpdate?.(newCoords, timestamp);

          console.log("📍 Real freelancer location updated:", {
            coords: newCoords,
            accuracy,
            timestamp,
          });
        },
        (error) => {
          console.error("Geolocation error:", error);
          let errorMessage = "Location access error";

          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage =
                "Location permission denied. Please allow location access.";
              setLocationPermissionDenied(true);
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = "Location information is unavailable.";
              break;
            case error.TIMEOUT:
              errorMessage = "Location request timed out.";
              break;
            default:
              errorMessage = "An unknown location error occurred.";
              break;
          }

          setError(errorMessage);
          setIsTracking(false);
          onTrackingStop?.();
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 5000,
        }
      );

      console.log("🚀 Real-time location tracking started");
    };

    startTracking();

    // Cleanup function
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [
    enableLiveTracking,
    isFreelancer,
    onLocationUpdate,
    onTrackingStart,
    onTrackingStop,
  ]);

  // For client view: fetch freelancer location periodically if available
  useEffect(() => {
    if (isFreelancer || !enableLiveTracking || !order) return;

    const fetchFreelancerLocation = async () => {
      try {
        // In a real app, this would be an API call to get freelancer's current location
        // For now, we'll check if the order has updated location data
        if (
          order.freelancerLocation?.latitude &&
          order.freelancerLocation?.longitude
        ) {
          const coords = {
            lat: parseFloat(order.freelancerLocation.latitude),
            lng: parseFloat(order.freelancerLocation.longitude),
          };
          setFreelancerCoords(coords);
          setLastTrackedAt(new Date().toLocaleTimeString());

          console.log("📍 Updated freelancer location from server:", coords);
        }
      } catch (error) {
        console.error("Error fetching freelancer location:", error);
      }
    };

    // Initial fetch
    fetchFreelancerLocation();

    // Set up interval for periodic updates
    if (freelancerOnline) {
      intervalRef.current = setInterval(
        fetchFreelancerLocation,
        trackingInterval
      );
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [
    isFreelancer,
    enableLiveTracking,
    trackingInterval,
    freelancerOnline,
    order,
  ]);

  // Format tracking duration
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Generate OpenStreetMap embed URL with proper zoom and centering
  const generateMapUrl = () => {
    const hasClient = clientCoords?.lat != null && clientCoords?.lng != null;
    const hasFreelancer =
      freelancerCoords?.lat != null && freelancerCoords?.lng != null;

    if (!hasClient && !hasFreelancer) return null;

    let center, bbox;

    if (hasClient && hasFreelancer) {
      // Show both locations
      const centerLat = (clientCoords.lat + freelancerCoords.lat) / 2;
      const centerLng = (clientCoords.lng + freelancerCoords.lng) / 2;
      center = { lat: centerLat, lng: centerLng };

      const latMin = Math.min(clientCoords.lat, freelancerCoords.lat) - 0.01;
      const latMax = Math.max(clientCoords.lat, freelancerCoords.lat) + 0.01;
      const lngMin = Math.min(clientCoords.lng, freelancerCoords.lng) - 0.01;
      const lngMax = Math.max(clientCoords.lng, freelancerCoords.lng) + 0.01;
      bbox = `${lngMin},${latMin},${lngMax},${latMax}`;
    } else if (hasClient) {
      // Show only client location
      center = clientCoords;
      bbox = `${center.lng - 0.008},${center.lat - 0.008},${
        center.lng + 0.008
      },${center.lat + 0.008}`;
    } else if (hasFreelancer) {
      // Show only freelancer location
      center = freelancerCoords;
      bbox = `${center.lng - 0.008},${center.lat - 0.008},${
        center.lng + 0.008
      },${center.lat + 0.008}`;
    }

    return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${center.lat},${center.lng}`;
  };

  // Handle no address provided
  if (!clientAddress && !order?.location?.latitude) {
    return (
      <div className={styles.noAddressContainer}>
        <div className={styles.noAddressIcon}>📍</div>
        <h3 className={styles.noAddressTitle}>No Address Provided</h3>
        <p className={styles.noAddressDescription}>
          {isFreelancer
            ? "The client hasn't provided a service address yet. Please contact them for location details."
            : "Service address is required to show the map. Please provide the address in your order."}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorIcon}>⚠️</div>
        <div className={styles.errorText}>{error}</div>
        {locationPermissionDenied && (
          <div className={styles.permissionHelp}>
            <p>To enable location tracking:</p>
            <ol>
              <li>Click the location icon in your browser's address bar</li>
              <li>Select "Allow" for location access</li>
              <li>Refresh this page</li>
            </ol>
          </div>
        )}
        <button
          className={styles.retryBtn}
          onClick={() => {
            setError(null);
            window.location.reload();
          }}
        >
          🔄 Retry
        </button>
      </div>
    );
  }

  if (isLoadingAddress) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <div className={styles.loadingText}>Locating address...</div>
      </div>
    );
  }

  if (!clientCoords && !freelancerCoords) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <div className={styles.loadingText}>Loading map...</div>
      </div>
    );
  }

  const mapUrl = generateMapUrl();

  // Client view: Check if freelancer is trackable
  const canTrackFreelancer =
    !isFreelancer && freelancerOnline && freelancerCoords;
  const freelancerOffline = !isFreelancer && !freelancerOnline;

  return (
    <div className={styles.mapWrapper}>
      {/* Map Controls */}
      <div className={styles.mapControls}>
        {isFreelancer ? (
          // Freelancer Controls
          <div className={styles.freelancerControls}>
            <div className={styles.controlItem}>
              <span className={styles.controlLabel}>🎯 Navigation Mode</span>
              <span className={styles.controlValue}>To Client Location</span>
            </div>
            <div className={styles.controlItem}>
              <span className={styles.controlLabel}>📍 Your Location</span>
              <span className={styles.controlValue}>
                {isTracking
                  ? `Active (${formatDuration(trackingDuration)})`
                  : freelancerCoords
                  ? "Available"
                  : "Getting location..."}
              </span>
            </div>
            {distance && (
              <div className={styles.controlItem}>
                <span className={styles.controlLabel}>📏 Distance</span>
                <span className={styles.controlValue}>{distance} km</span>
              </div>
            )}
            {isTracking && (
              <div className={styles.controlItem}>
                <span className={styles.controlLabel}>🔄 Updates</span>
                <span className={styles.controlValue}>
                  Every {trackingInterval / 1000}s
                </span>
              </div>
            )}
          </div>
        ) : (
          // Client Controls
          <div className={styles.clientControls}>
            <div className={styles.controlItem}>
              <span className={styles.controlLabel}>🚗 Freelancer Status</span>
              <span
                className={`${styles.controlValue} ${
                  canTrackFreelancer ? styles.active : styles.inactive
                }`}
              >
                {freelancerOffline
                  ? "Offline"
                  : canTrackFreelancer
                  ? "Online & Trackable"
                  : "Location not available"}
              </span>
            </div>
            {canTrackFreelancer && distance && (
              <div className={styles.controlItem}>
                <span className={styles.controlLabel}>📏 Distance</span>
                <span className={styles.controlValue}>{distance} km away</span>
              </div>
            )}
            {lastTrackedAt && (
              <div className={styles.controlItem}>
                <span className={styles.controlLabel}>🕐 Last Update</span>
                <span className={styles.controlValue}>{lastTrackedAt}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Client Tracking Status (for client view when freelancer is offline) */}
      {!isFreelancer && !canTrackFreelancer && (
        <div className={styles.trackingStatus}>
          <div className={styles.statusIcon}>
            {freelancerOffline ? "📴" : "📍"}
          </div>
          <div className={styles.statusContent}>
            <h4 className={styles.statusTitle}>
              {freelancerOffline
                ? "Freelancer Offline"
                : "Location Not Available"}
            </h4>
            <p className={styles.statusDescription}>
              {freelancerOffline
                ? "The freelancer is currently offline. Location will update when they come online."
                : "The freelancer hasn't shared their location yet or location services are unavailable."}
            </p>
            {freelancerCoords && lastTrackedAt && (
              <div className={styles.lastKnownLocation}>
                <span className={styles.lastLocationLabel}>
                  Last known location:
                </span>
                <span className={styles.lastLocationTime}>{lastTrackedAt}</span>
                {distance && (
                  <span className={styles.lastLocationDistance}>
                    ({distance} km from destination)
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Square Map Container */}
      <div className={styles.mapContainer}>
        {mapUrl ? (
          <iframe
            src={mapUrl}
            className={styles.mapFrame}
            title="Interactive Map"
            frameBorder="0"
            scrolling="no"
            marginHeight="0"
            marginWidth="0"
          />
        ) : (
          <div className={styles.mapPlaceholder}>
            <div className={styles.mapIcon}>🗺️</div>
            <h3 className={styles.mapTitle}>Interactive Map</h3>
            <p className={styles.mapDescription}>
              Map will load once location data is available
            </p>
          </div>
        )}

        {/* Custom Overlay with Real Location Info */}
        <div className={styles.mapOverlay}>
          {clientCoords && (
            <div
              className={styles.locationPin}
              style={{ top: "15%", left: "15%" }}
            >
              <div className={styles.clientPin}>
                <span className={styles.pinIcon}>🏠</span>
                <div className={styles.pinTooltip}>
                  <strong>
                    {isFreelancer ? "Client Location" : "Service Location"}
                  </strong>
                  <br />
                  {clientAddress || order?.address || "Service Address"}
                  <br />
                  <small>
                    {clientCoords.lat.toFixed(4)}, {clientCoords.lng.toFixed(4)}
                  </small>
                </div>
              </div>
            </div>
          )}

          {freelancerCoords && (
            <div
              className={styles.locationPin}
              style={{ top: "25%", right: "15%" }}
            >
              <div
                className={`${styles.freelancerPin} ${
                  isTracking ? styles.tracking : ""
                }`}
              >
                <span className={styles.pinIcon}>
                  {isTracking ? "🚗" : "👨‍💻"}
                </span>
                <div className={styles.pinTooltip}>
                  <strong>
                    {isFreelancer ? "Your Location" : "Freelancer Location"}
                  </strong>
                  {lastTrackedAt && (
                    <>
                      <br />
                      Last updated: {lastTrackedAt}
                    </>
                  )}
                  {isTracking && (
                    <>
                      <br />
                      <span className={styles.trackingBadge}>
                        🔴 Live Tracking
                      </span>
                    </>
                  )}
                  <br />
                  <small>
                    {freelancerCoords.lat.toFixed(4)},{" "}
                    {freelancerCoords.lng.toFixed(4)}
                  </small>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Map Stats - Enhanced with Real Data */}
      <div className={styles.mapStats}>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>📍 Locations</span>
          <span className={styles.statValue}>
            {(clientCoords ? 1 : 0) + (freelancerCoords ? 1 : 0)}
          </span>
        </div>
        {distance && (
          <div className={styles.statItem}>
            <span className={styles.statLabel}>📏 Distance</span>
            <span className={styles.statValue}>{distance} km</span>
          </div>
        )}
        <div className={styles.statItem}>
          <span className={styles.statLabel}>🔄 Updates</span>
          <span className={styles.statValue}>
            {isTracking
              ? `Live (${trackingInterval / 1000}s)`
              : lastTrackedAt
              ? "Available"
              : "Waiting"}
          </span>
        </div>
        {locationHistory.length > 0 && (
          <div className={styles.statItem}>
            <span className={styles.statLabel}>📊 History</span>
            <span className={styles.statValue}>
              {locationHistory.length} points
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default DynamicMap;
