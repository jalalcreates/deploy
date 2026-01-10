"use client";

import { useEffect, useState, useCallback } from "react";
import styles from "./ordersSidebar.module.css";
import OrderCard from "../OrderCard/orderCard";
import LocationPermissionModal from "../LocationPermissionModal/locationPermissionModal";
import ModalPortal from "../ModalPortal/modalPortal";
import { useUserData } from "@/Context/context";
import NegotiationModal from "../NegotiationModal/negotiationModal";
import FreelancerReminderModal from "../FreelancerReminderModal/freelancerReminderModal";
import ClientArrivalConfirmationModal from "../ClientArrivalConfirmationModal/clientArrivalConfirmationModal";
import FreelancerServiceModal from "../FreelancerServiceCompleteModal/freelancerServiceCompleteModal";
import ClientSatisfactionModal from "../ClientSatisfactionModal/clientSatisfactionModal";
import OrderDetailModal from "../OrderDetailModal/orderDetailModal";
import FreelancerOfferModal from "../FreelancerOfferModal/freelancerOfferModal";
import { respondToOrderRealtime } from "@/Actions/Orders/orderSocketClient";
import { getSocket } from "@/Socket_IO/socket";
import {
  handleFreelancerReminderAction,
  confirmArrival,
  updateOrderLocation,
} from "@/Actions/Orders/orders";
import { updateOrderProgress } from "@/Actions/Orders/fallbackHandler";
import { HiClipboardDocumentList } from "react-icons/hi2";

export default function OrdersSidebar() {
  const { initialUserData } = useUserData();
  const [orders, setOrders] = useState([]);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showNegotiationModal, setShowNegotiationModal] = useState(false);
  const [currentNegotiation, setCurrentNegotiation] = useState(null);
  const [locationPermissionGranted, setLocationPermissionGranted] =
    useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [currentReminderOrder, setCurrentReminderOrder] = useState(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Modal states for the features
  const [showArrivalModal, setShowArrivalModal] = useState(false);
  const [arrivalOrder, setArrivalOrder] = useState(null);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [serviceOrder, setServiceOrder] = useState(null);
  const [showSatisfactionModal, setShowSatisfactionModal] = useState(false);
  const [satisfactionOrder, setSatisfactionOrder] = useState(null);

  // Real-time incoming order states
  const [showRealtimeOrderModal, setShowRealtimeOrderModal] = useState(false);
  const [realtimeOrder, setRealtimeOrder] = useState(null);
  const [showRealtimeOfferModal, setShowRealtimeOfferModal] = useState(false);
  const [socketReady, setSocketReady] = useState(false);

  // ============================================
  // MODAL PRIORITY QUEUE SYSTEM
  // ============================================
  const [modalQueue, setModalQueue] = useState([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);

  const MODAL_TYPES = {
    FREELANCER_REMINDER: "FREELANCER_REMINDER",
    REALTIME_ORDER: "REALTIME_ORDER",
    LOCATION_PERMISSION: "LOCATION_PERMISSION",
    NEGOTIATION: "NEGOTIATION",
    ARRIVAL_CONFIRMATION: "ARRIVAL_CONFIRMATION",
    SERVICE_COMPLETE: "SERVICE_COMPLETE",
    SATISFACTION: "SATISFACTION",
  };

  const MODAL_PRIORITIES = {
    [MODAL_TYPES.FREELANCER_REMINDER]: 7, // Highest - CRITICAL - Freelancer must mark "I have reached"
    [MODAL_TYPES.REALTIME_ORDER]: 6, // Incoming real-time order
    [MODAL_TYPES.LOCATION_PERMISSION]: 5, // Location sharing needed
    [MODAL_TYPES.NEGOTIATION]: 4, // Counter-offer response needed
    [MODAL_TYPES.ARRIVAL_CONFIRMATION]: 3, // Freelancer arrival confirmation
    [MODAL_TYPES.SERVICE_COMPLETE]: 2, // Service completion form
    [MODAL_TYPES.SATISFACTION]: 1, // Client satisfaction/review
  };

  // Add modal to queue with priority
  const enqueueModal = useCallback((modalType, data) => {
    setModalQueue((prevQueue) => {
      // Check if this modal type is already in queue or currently showing
      const existsInQueue = prevQueue.some((item) => item.type === modalType);
      if (existsInQueue) {
        return prevQueue; // Don't add duplicates
      }

      const newModal = {
        type: modalType,
        data,
        priority: MODAL_PRIORITIES[modalType] || 0,
      };

      // Add to queue and sort by priority (highest first)
      const newQueue = [...prevQueue, newModal].sort(
        (a, b) => b.priority - a.priority
      );

      console.log(
        `📋 Modal queued: ${modalType} (Priority: ${newModal.priority})`
      );
      return newQueue;
    });
  }, []);

  // Process next modal in queue
  const processNextModal = useCallback(() => {
    setModalQueue((prevQueue) => {
      if (prevQueue.length === 0) {
        setIsProcessingQueue(false);
        return [];
      }

      const [nextModal, ...remainingQueue] = prevQueue;
      console.log(`▶️ Processing modal: ${nextModal.type}`);

      // Show the appropriate modal based on type
      switch (nextModal.type) {
        case MODAL_TYPES.FREELANCER_REMINDER:
          setCurrentReminderOrder(nextModal.data);
          setShowReminderModal(true);
          break;

        case MODAL_TYPES.REALTIME_ORDER:
          setRealtimeOrder(nextModal.data);
          setShowRealtimeOrderModal(true);
          break;

        case MODAL_TYPES.LOCATION_PERMISSION:
          setShowLocationModal(true);
          break;

        case MODAL_TYPES.NEGOTIATION:
          setCurrentNegotiation(nextModal.data);
          setShowNegotiationModal(true);
          break;

        case MODAL_TYPES.ARRIVAL_CONFIRMATION:
          setArrivalOrder(nextModal.data);
          setShowArrivalModal(true);
          break;

        case MODAL_TYPES.SERVICE_COMPLETE:
          setServiceOrder(nextModal.data);
          setShowServiceModal(true);
          break;

        case MODAL_TYPES.SATISFACTION:
          setSatisfactionOrder(nextModal.data);
          setShowSatisfactionModal(true);
          break;

        default:
          console.warn(`Unknown modal type: ${nextModal.type}`);
      }

      setIsProcessingQueue(true);
      return remainingQueue;
    });
  }, []);

  // Auto-process queue when items added and not currently processing
  useEffect(() => {
    if (modalQueue.length > 0 && !isProcessingQueue) {
      processNextModal();
    }
  }, [modalQueue, isProcessingQueue, processNextModal]);

  // Handle modal close - process next in queue
  const handleModalClose = useCallback(
    (modalType) => {
      console.log(`✅ Modal closed: ${modalType}`);
      setIsProcessingQueue(false);

      // Close the specific modal
      switch (modalType) {
        case MODAL_TYPES.FREELANCER_REMINDER:
          setShowReminderModal(false);
          setCurrentReminderOrder(null);
          break;

        case MODAL_TYPES.REALTIME_ORDER:
          setShowRealtimeOrderModal(false);
          setRealtimeOrder(null);
          break;

        case MODAL_TYPES.LOCATION_PERMISSION:
          setShowLocationModal(false);
          break;

        case MODAL_TYPES.NEGOTIATION:
          setShowNegotiationModal(false);
          setCurrentNegotiation(null);
          break;

        case MODAL_TYPES.ARRIVAL_CONFIRMATION:
          setShowArrivalModal(false);
          setArrivalOrder(null);
          break;

        case MODAL_TYPES.SERVICE_COMPLETE:
          setShowServiceModal(false);
          setServiceOrder(null);
          break;

        case MODAL_TYPES.SATISFACTION:
          setShowSatisfactionModal(false);
          setSatisfactionOrder(null);
          break;
      }

      // Process next modal after a small delay for smooth UX
      setTimeout(() => {
        if (modalQueue.length > 0) {
          processNextModal();
        }
      }, 300);
    },
    [modalQueue, processNextModal, MODAL_TYPES]
  );

  // Load orders from initialUserData
  useEffect(() => {
    if (!initialUserData) return;

    const givenOrders = initialUserData.ordersGiven || [];
    const pendingOrders = initialUserData.pendingOrders || [];

    const allOrders = [
      ...givenOrders.map((o) => ({ ...o, type: "given" })),
      ...pendingOrders.map((o) => ({ ...o, type: "received" })),
    ];

    setOrders(allOrders);
    checkAndShowModals(givenOrders, pendingOrders, allOrders);
  }, [initialUserData]);

  // ============================================
  // UNIFIED SOCKET EVENT LISTENERS (ALL REAL-TIME EVENTS)
  // ============================================
  useEffect(() => {
    if (!initialUserData?.username) {
      console.log("⏳ Waiting for user data...");
      return;
    }

    const socket = getSocket();

    if (!socket) {
      console.warn("⚠️ Socket not initialized yet, retrying...");
      const retryInterval = setInterval(() => {
        const retrySocket = getSocket();
        if (retrySocket && retrySocket.connected) {
          console.log("✅ Socket now available, triggering re-setup");
          clearInterval(retryInterval);
          setSocketReady(true); // Trigger re-render
        }
      }, 500);
      return () => clearInterval(retryInterval);
    }

    // If socket exists but not connected, wait for connection
    if (!socket.connected) {
      console.warn("⚠️ Socket exists but not connected, waiting...");

      const handleConnect = () => {
        console.log("✅ Socket connected! Triggering listener setup...");
        setSocketReady(true); // Trigger re-render to setup listeners
      };

      socket.on("connect", handleConnect);

      return () => {
        socket.off("connect", handleConnect);
      };
    }

    console.log(
      "🔌 Setting up socket listeners for:",
      initialUserData.username,
      "| Socket ID:",
      socket.id,
      "| Connected:",
      socket.connected
    );

    // ========================================
    // FREELANCER ONLY: Listen for incoming orders
    // ========================================
    const handleIncomingOrder = (orderData) => {
      console.log("🔔 REAL-TIME ORDER RECEIVED!", orderData);

      const formattedOrder = {
        orderId: orderData.orderId,
        customerInfo: {
          username: orderData.clientUsername,
          profilePicture: orderData.clientProfilePicture || "",
        },
        freelancerInfo: {
          username: initialUserData.username,
          profilePicture:
            orderData.freelancerProfilePicture ||
            initialUserData.profilePicture ||
            "",
        },
        user: orderData.clientUsername,
        priceToBePaid: orderData.budget,
        currency: orderData.currency,
        problemDescription: orderData.problemStatement,
        problemStatement: orderData.problemStatement,
        expertiseRequired: orderData.expertiseRequired,
        city: orderData.city,
        deadline: orderData.deadline,
        address: orderData.address,
        phoneNumber: orderData.phoneNumber,
        status: "pending",
        type: "received",
        orderImages: orderData.images || [],
        audioId: orderData.audioId || null,
        createdOn: new Date(),
      };

      setOrders((prevOrders) => {
        // Prevent duplicates
        if (prevOrders.some((o) => o.orderId === formattedOrder.orderId)) {
          return prevOrders;
        }
        return [...prevOrders, formattedOrder];
      });

      setRealtimeOrder(formattedOrder);
      setShowRealtimeOrderModal(true);
    };

    // ========================================
    // BOTH: Order accepted
    // ========================================
    const handleOrderAccepted = (data) => {
      console.log("🎉 Order accepted:", data);

      setOrders((prevOrders) => {
        const updatedOrders = prevOrders.map((order) => {
          if (order.orderId === data.orderId) {
            const updatedOrder = {
              ...order,
              status: "accepted",
              priceToBePaid: data.acceptedPrice,
              expectedReachTime:
                data.order?.expectedReachTime || order.expectedReachTime,
              acceptedAt: data.order?.acceptedAt || new Date(),
              acceptedBy: data.acceptedBy,
            };

            // Only show location modal for CLIENT (type: "given")
            if (order.type === "given") {
              console.log(
                "📍 Client order accepted - enqueuing location modal"
              );
              // Use queue system for proper priority handling
              setTimeout(() => {
                enqueueModal(MODAL_TYPES.LOCATION_PERMISSION, null);
              }, 100);
            } else {
              console.log(
                "✅ Freelancer order accepted - no location modal needed"
              );
            }

            return updatedOrder;
          }
          return order;
        });

        return updatedOrders;
      });

      setShowRealtimeOrderModal(false);
      setShowNegotiationModal(false);
    };

    // ========================================
    // BOTH: Order rejected
    // ========================================
    const handleOrderRejected = (data) => {
      console.log("❌ Order rejected:", data);

      setOrders((prevOrders) =>
        prevOrders.filter((order) => order.orderId !== data.orderId)
      );

      setShowRealtimeOrderModal(false);
      setShowNegotiationModal(false);
    };

    // ========================================
    // BOTH: Negotiation updates
    // ========================================
    const handleNegotiationUpdate = async (data) => {
      console.log("💰 Negotiation update:", data);

      // First, update the orders
      setOrders((prevOrders) => {
        const existingOrder = prevOrders.find(
          (o) => o.orderId === data.orderId
        );

        let updatedOrders;
        let clientUsername, freelancerUsername;

        if (existingOrder) {
          // Order exists - update it
          updatedOrders = prevOrders.map((order) => {
            if (order.orderId === data.orderId) {
              // Extract usernames for database persistence
              if (order.type === "given") {
                clientUsername = initialUserData.username;
                freelancerUsername = order.freelancerInfo?.username;
              } else {
                clientUsername = order.customerInfo?.username;
                freelancerUsername = initialUserData.username;
              }

              return {
                ...order,
                negotiation: {
                  isNegotiating: true,
                  currentOfferTo: initialUserData.username,
                  offeredPrice: data.newPrice,
                  lastOfferBy: data.offeredBy || data.offeredByUsername,
                },
                expectedReachTime:
                  data.expectedReachTime || order.expectedReachTime,
              };
            }
            return order;
          });

          // PERSIST NEGOTIATION STATE TO DATABASE
          if (clientUsername && freelancerUsername) {
            updateOrderProgress({
              orderId: data.orderId,
              clientUsername,
              freelancerUsername,
              updateType: "negotiation",
              updateData: {
                negotiation: {
                  isNegotiating: true,
                  currentOfferTo: initialUserData.username,
                  offeredPrice: data.newPrice,
                  lastOfferBy: data.offeredBy || data.offeredByUsername,
                },
                offeredPrice: data.newPrice,
                expectedReachTime: data.expectedReachTime,
              },
            }).catch((err) =>
              console.error("Failed to persist negotiation:", err)
            );
          }
        } else {
          // Order doesn't exist - create it from counter-offer data
          console.log(
            "🆕 Order not in list, creating from counter-offer data:",
            data.orderId
          );

          const newOrder = {
            orderId: data.orderId,
            type: "given", // Client sent this order
            status: "pending",
            user: data.offeredBy || data.offeredByUsername,
            freelancerInfo: {
              username: data.offeredBy || data.offeredByUsername,
            },
            priceToBePaid: data.newPrice,
            offeredPrice: data.newPrice,
            currency: data.currency || "USD",
            expectedReachTime: data.expectedReachTime,
            negotiation: {
              isNegotiating: true,
              currentOfferTo: initialUserData.username,
              offeredPrice: data.newPrice,
              lastOfferBy: data.offeredBy || data.offeredByUsername,
            },
            createdOn: new Date(),
          };

          updatedOrders = [...prevOrders, newOrder];

          // For new orders created from counter-offer, also persist to database
          clientUsername = initialUserData.username;
          freelancerUsername = data.offeredBy || data.offeredByUsername;

          if (clientUsername && freelancerUsername) {
            updateOrderProgress({
              orderId: data.orderId,
              clientUsername,
              freelancerUsername,
              updateType: "negotiation",
              updateData: {
                negotiation: newOrder.negotiation,
                offeredPrice: data.newPrice,
                expectedReachTime: data.expectedReachTime,
              },
            }).catch((err) =>
              console.error("Failed to persist new negotiation:", err)
            );
          }
        }

        // After updating, find the order and set modal
        const updatedOrder = updatedOrders.find(
          (o) => o.orderId === data.orderId
        );
        if (updatedOrder) {
          console.log(
            "✅ Setting negotiation modal with order:",
            updatedOrder.orderId
          );
          // Use setTimeout to ensure state updates happen after orders update
          setTimeout(() => {
            setCurrentNegotiation(updatedOrder);
            setShowNegotiationModal(true);
          }, 0);
        } else {
          console.error("❌ Order not found for negotiation:", data.orderId);
        }

        return updatedOrders;
      });
    };

    // ========================================
    // FREELANCER ONLY: Location shared
    // ========================================
    const handleLocationShared = (data) => {
      console.log("📍 Client shared location:", data);

      setOrders((prevOrders) => {
        const updatedOrders = prevOrders.map((order) =>
          order.orderId === data.orderId
            ? {
                ...order,
                location: {
                  latitude: data.latitude,
                  longitude: data.longitude,
                },
              }
            : order
        );

        // Show freelancer reminder modal if flag is set
        if (data.showReminderModal) {
          const order = updatedOrders.find((o) => o.orderId === data.orderId);
          if (order) {
            setTimeout(() => {
              setCurrentReminderOrder(order);
              setShowReminderModal(true);
            }, 100);
          }
        }

        return updatedOrders;
      });
    };

    // ========================================
    // CLIENT ONLY: Freelancer reached
    // ========================================
    const handleFreelancerReached = (data) => {
      console.log("🚗 Freelancer reached:", data);

      setOrders((prevOrders) => {
        const updatedOrders = prevOrders.map((order) =>
          order.orderId === data.orderId
            ? {
                ...order,
                isReached: {
                  value: true,
                  time: data.reachedAt,
                  confirmed: false,
                },
              }
            : order
        );

        // Enqueue arrival confirmation modal with high priority
        const order = updatedOrders.find((o) => o.orderId === data.orderId);
        if (order) {
          enqueueModal(MODAL_TYPES.ARRIVAL_CONFIRMATION, order);
        }

        return updatedOrders;
      });
    };

    // ========================================
    // FREELANCER ONLY: Arrival confirmed
    // ========================================
    const handleArrivalConfirmed = (data) => {
      console.log("✅ Arrival confirmed:", data);

      setOrders((prevOrders) =>
        prevOrders.map((order) =>
          order.orderId === data.orderId
            ? {
                ...order,
                isReached: {
                  ...order.isReached,
                  confirmed: data.confirmed,
                  confirmedAt: new Date(),
                },
                status: data.confirmed ? "in-progress" : "disputed",
              }
            : order
        )
      );
    };

    // ========================================
    // CLIENT ONLY: Order completed
    // ========================================
    const handleOrderCompleted = (data) => {
      console.log("✅ Order completed:", data);

      setOrders((prevOrders) => {
        const updatedOrders = prevOrders.map((order) =>
          order.orderId === data.orderId
            ? {
                ...order,
                status: "completed",
                proofPictures: data.proofPictures,
                finishDate: data.completedAt,
              }
            : order
        );

        // Show satisfaction modal
        const order = updatedOrders.find((o) => o.orderId === data.orderId);
        if (order) {
          setSatisfactionOrder(order);
          setShowSatisfactionModal(true);
        }

        return updatedOrders;
      });
    };

    // ========================================
    // BOTH: Save to database (fallback)
    // ========================================
    const handleSaveToDatabase = async (data) => {
      console.log("💾 Saving order to database:", data.reason);

      try {
        const { saveRealtimeOrderToDatabase } = await import(
          "@/Actions/Orders/fallbackHandler"
        );

        const result = await saveRealtimeOrderToDatabase(data.orderData);

        if (result.success) {
          console.log("✅ Order saved to database successfully");

          setOrders((prev) =>
            prev.filter((order) => order.orderId !== data.orderId)
          );
        } else {
          console.error("❌ Failed to save order to database");
        }
      } catch (error) {
        console.error("Error in handleSaveToDatabase:", error);
      }
    };

    // ========================================
    // REGISTER EVENT LISTENERS BASED ON USER TYPE
    // ========================================

    // FREELANCER listeners
    // if (initialUserData.isFreelancer) {
    socket.on("new-order-realtime", handleIncomingOrder);
    socket.on("location-shared-realtime", handleLocationShared);
    socket.on("arrival-confirmed-realtime", handleArrivalConfirmed);
    // }

    // CLIENT listeners

    // BOTH listeners (common events)
    socket.on("order-completed-realtime", handleOrderCompleted);
    socket.on("freelancer-reached-realtime", handleFreelancerReached);
    socket.on("order-accepted-realtime", handleOrderAccepted);
    socket.on("order-rejected-realtime", handleOrderRejected);
    socket.on("counter-offer-realtime", handleNegotiationUpdate);
    socket.on("save-order-to-database", handleSaveToDatabase);
    socket.on("save-location-to-database", handleSaveToDatabase);
    socket.on("save-reached-to-database", handleSaveToDatabase);
    socket.on("save-arrival-confirmation-to-database", handleSaveToDatabase);
    socket.on("save-completion-to-database", handleSaveToDatabase);
    socket.on("save-review-to-database", handleSaveToDatabase);

    console.log("✅ All socket listeners registered");

    // ========================================
    // CLEANUP - Remove all listeners on unmount
    // ========================================
    return () => {
      console.log("🧹 Cleaning up socket listeners");

      // if (initialUserData.isFreelancer) {
      socket.off("new-order-realtime", handleIncomingOrder);
      socket.off("location-shared-realtime", handleLocationShared);
      socket.off("arrival-confirmed-realtime", handleArrivalConfirmed);
      // }

      socket.off("order-completed-realtime", handleOrderCompleted);
      socket.off("freelancer-reached-realtime", handleFreelancerReached);
      socket.off("order-accepted-realtime", handleOrderAccepted);
      socket.off("order-rejected-realtime", handleOrderRejected);
      socket.off("counter-offer-realtime", handleNegotiationUpdate);
      socket.off("save-order-to-database", handleSaveToDatabase);
      socket.off("save-location-to-database", handleSaveToDatabase);
      socket.off("save-reached-to-database", handleSaveToDatabase);
      socket.off("save-arrival-confirmation-to-database", handleSaveToDatabase);
      socket.off("save-completion-to-database", handleSaveToDatabase);
      socket.off("save-review-to-database", handleSaveToDatabase);
    };
  }, [initialUserData?.username, socketReady]); // ✅ Re-run when user data loads or socket becomes ready
  // ============================================
  // Real-time order handlers
  // ============================================
  const handleRealtimeAcceptOrder = async () => {
    if (!realtimeOrder) return;

    try {
      console.log("✅ Accepting real-time order:", realtimeOrder.orderId);

      await respondToOrderRealtime(
        realtimeOrder.orderId,
        "accept",
        null,
        "Order accepted",
        realtimeOrder // Pass full order data for reconstruction
      );

      // Update order status locally
      setOrders((prevOrders) =>
        prevOrders.map((order) =>
          order.orderId === realtimeOrder.orderId
            ? { ...order, status: "accepted" }
            : order
        )
      );

      setShowRealtimeOrderModal(false);
      setRealtimeOrder(null);

      console.log("✅ Order accepted successfully");
    } catch (error) {
      console.error("Error accepting order:", error);
    }
  };

  const handleRealtimeGiveOffer = () => {
    console.log("💰 Opening offer modal");
    setShowRealtimeOrderModal(false);
    setShowRealtimeOfferModal(true);
  };

  // Helper function to check and enqueue appropriate modals (Priority-Based Queue System)
  const checkAndShowModals = useCallback(
    (givenOrders, pendingOrders, allOrders) => {
      // Priority 1: Freelancer reminder modal (CRITICAL - Highest Priority)
      const acceptedFreelancerOrder = pendingOrders?.find(
        (order) =>
          order.status === "accepted" && order.isReached?.confi === false
      );
      console.log({ acceptedFreelancerOrder });

      if (acceptedFreelancerOrder && !showReminderModal) {
        enqueueModal(MODAL_TYPES.FREELANCER_REMINDER, acceptedFreelancerOrder);
      }

      // Priority 2: Location permission for accepted given orders
      const needsPermission = givenOrders.some(
        (order) =>
          order.status === "accepted" &&
          !order.location?.latitude &&
          !order.location?.longitude &&
          !locationPermissionGranted
      );
      console.log({ needsPermission });

      if (needsPermission && !locationPermissionGranted && !showLocationModal) {
        enqueueModal(MODAL_TYPES.LOCATION_PERMISSION, null);
      }

      // Priority 3: Negotiation modal
      const negotiationOrder = allOrders.find(
        (order) =>
          order.status === "pending" &&
          order.negotiation?.isNegotiating === true &&
          ((order.type === "given" &&
            order.negotiation.currentOfferTo === "client") ||
            (order.type === "received" &&
              order.negotiation.currentOfferTo === "freelancer"))
      );
      console.log({ negotiationOrder });

      if (negotiationOrder && !showNegotiationModal) {
        enqueueModal(MODAL_TYPES.NEGOTIATION, negotiationOrder);
      }

      // Priority 4: Arrival confirmation (client view)
      const arrivedOrders = givenOrders.filter(
        (order) =>
          order.status === "accepted" &&
          order.isReached?.value === true &&
          order.isReached?.confirmed !== true
      );
      console.log({ arrivedOrders });

      if (arrivedOrders.length > 0 && !showArrivalModal) {
        enqueueModal(MODAL_TYPES.ARRIVAL_CONFIRMATION, arrivedOrders[0]);
      }

      // Priority 5: Service completion (freelancer view)
      const confirmedOrders = pendingOrders.filter(
        (order) =>
          order.status === "in-progress" &&
          order.isReached?.value === true &&
          order.isReached?.confirmed === true
      );
      console.log({ confirmedOrders });
      if (confirmedOrders.length > 0 && !showServiceModal) {
        enqueueModal(MODAL_TYPES.SERVICE_COMPLETE, confirmedOrders[0]);
      }

      // Priority 6: Satisfaction feedback (client view) - Lowest Priority
      const completedOrders = givenOrders.filter(
        (order) =>
          order.status === "completed" &&
          order.proofPictures?.after?.length > 0 &&
          order.review === undefined &&
          order.isSatisfied === false
      );
      console.log({ completedOrders });

      if (completedOrders.length > 0 && !showSatisfactionModal) {
        enqueueModal(MODAL_TYPES.SATISFACTION, completedOrders[0]);
      }
    },
    [
      locationPermissionGranted,
      showReminderModal,
      showLocationModal,
      showNegotiationModal,
      showArrivalModal,
      showServiceModal,
      showSatisfactionModal,
      enqueueModal,
      MODAL_TYPES,
    ]
  );

  const handleReminderClose = () => {
    handleModalClose(MODAL_TYPES.FREELANCER_REMINDER);
  };

  const handleFreelancerReached = async () => {
    if (!currentReminderOrder) return;

    try {
      const formData = new FormData();
      formData.append("orderId", currentReminderOrder.orderId);
      formData.append("action", "reached");
      formData.append("freelancerUsername", initialUserData?.username);

      const result = await handleFreelancerReminderAction(formData);

      if (result.success) {
        setOrders((prevOrders) =>
          prevOrders.map((order) =>
            order.orderId === currentReminderOrder.orderId
              ? {
                  ...order,
                  isReached: {
                    value: true,
                    time: new Date(),
                    confirmed: false,
                  },
                  status: "in-progress",
                }
              : order
          )
        );
        handleReminderClose();
      }
    } catch (error) {
      console.error("Error marking as reached:", error);
    }
  };

  const handleOrderCancel = async () => {
    if (!currentReminderOrder) return;

    try {
      const formData = new FormData();
      formData.append("orderId", currentReminderOrder.orderId);
      formData.append("action", "cancel");
      formData.append("freelancerUsername", initialUserData?.username);

      const result = await handleFreelancerReminderAction(formData);

      if (result.success) {
        setOrders((prevOrders) =>
          prevOrders.map((order) =>
            order.orderId === currentReminderOrder.orderId
              ? {
                  ...order,
                  cancelled: {
                    isCancelled: true,
                    cancelledBy: initialUserData?.username,
                  },
                  status: "cancelled",
                }
              : order
          )
        );
        handleReminderClose();
      }
    } catch (error) {
      console.error("Error cancelling order:", error);
    }
  };

  const handleReminderLocationPermission = () => {
    console.log("Freelancer allowed location access");
  };

  const handleOrderUpdate = (orderId, updates) => {
    setOrders((prevOrders) =>
      prevOrders.map((order) =>
        order.orderId === orderId ? { ...order, ...updates } : order
      )
    );

    if (updates.status === "accepted" && updates.type === "given") {
      setShowLocationModal(true);
    }
  };

  const handleLocationPermission = async (granted, coordinates) => {
    // Close location modal and process next in queue
    handleModalClose(MODAL_TYPES.LOCATION_PERMISSION);
    if (granted && coordinates) {
      try {
        const { latitude, longitude } = coordinates;

        const orderNeedingLocation = orders.find(
          (order) =>
            order.type === "given" &&
            order.status === "accepted" &&
            !order.location?.latitude
        );

        if (orderNeedingLocation) {
          const formData = new FormData();
          formData.append("orderId", orderNeedingLocation.orderId);
          formData.append("clientUsername", initialUserData?.username);
          formData.append("latitude", latitude.toString());
          formData.append("longitude", longitude.toString());

          const result = await updateOrderLocation(formData);

          if (result.success) {
            setOrders((prevOrders) =>
              prevOrders.map((order) =>
                order.orderId === orderNeedingLocation.orderId
                  ? {
                      ...order,
                      location: {
                        latitude: latitude.toString(),
                        longitude: longitude.toString(),
                      },
                    }
                  : order
              )
            );
            setLocationPermissionGranted(true);
          }
        }
      } catch (error) {
        console.error("Error getting location:", error);
      }
    }
  };

  const handleNegotiationResponse = (updatedOrders) => {
    if (updatedOrders) {
      setOrders(updatedOrders);
    }
    handleModalClose(MODAL_TYPES.NEGOTIATION);
  };

  const handleConfirmArrival = async (orderId) => {
    try {
      const formData = new FormData();
      formData.append("orderId", orderId);
      formData.append("clientUsername", initialUserData?.username);
      formData.append("confirmed", "true");

      const result = await confirmArrival(formData);

      if (result.success) {
        setOrders((prevOrders) =>
          prevOrders.map((order) =>
            order.orderId === orderId
              ? {
                  ...order,
                  isReached: {
                    ...order.isReached,
                    confirmed: true,
                  },
                  status: "in-progress",
                }
              : order
          )
        );

        console.log("Arrival confirmed for order:", orderId);
        handleModalClose(MODAL_TYPES.ARRIVAL_CONFIRMATION);
      }
    } catch (error) {
      console.error("Error confirming arrival:", error);
    }
  };

  const handleRejectArrival = async (orderId) => {
    // try {
    //   const formData = new FormData();
    //   formData.append("orderId", orderId);
    //   formData.append("clientUsername", initialUserData?.username);
    //   formData.append("confirmed", "false");

    //   const result = await confirmArrival(formData);

    //   if (result?.success) {
    //     setOrders((prevOrders) =>
    //       prevOrders.map((order) =>
    //         order.orderId === orderId
    //           ? {
    //               ...order,
    //               isReached: {
    //                 value: false,
    //                 time: null,
    //                 confirmed: false,
    //               },
    //             }
    //           : order
    //       )
    //     );

    //     console.log("Arrival rejected for order:", orderId);
    handleModalClose(MODAL_TYPES.ARRIVAL_CONFIRMATION);
    //   }
    // } catch (error) {
    //   console.error("Error rejecting arrival:", error);
    // }
  };

  const handleServiceCompleted = async (serviceData) => {
    handleModalClose(MODAL_TYPES.SERVICE_COMPLETE);
  };

  const handleServiceCancelled = (orderId) => {
    handleModalClose(MODAL_TYPES.SERVICE_COMPLETE);
  };

  const handleSatisfactionSubmitted = async (satisfactionData) => {
    handleModalClose(MODAL_TYPES.SATISFACTION);
  };

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        className={styles.mobileToggleBtn}
        onClick={() => setIsMobileSidebarOpen(true)}
        aria-label="Open orders sidebar"
      >
        <HiClipboardDocumentList className={styles.toggleIcon} />
        {orders.length > 0 && (
          <span className={styles.orderCount}>{orders.length}</span>
        )}
      </button>

      {/* Mobile Overlay */}
      {isMobileSidebarOpen && (
        <div
          className={styles.mobileOverlay}
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`${styles.ordersSidebar} ${
          isMobileSidebarOpen ? styles.mobileOpen : ""
        }`}
      >
        {/* Mobile Close Button */}
        <button
          className={styles.mobileCloseBtn}
          onClick={() => setIsMobileSidebarOpen(false)}
          aria-label="Close orders sidebar"
        >
          ✕
        </button>

        <h2 className={styles.ordersHeader}>Orders</h2>
        <div className={styles.ordersList}>
          {orders.length > 0 ? (
            orders.map((order, index) => (
              <OrderCard
                key={index}
                order={order}
                onOrderUpdate={handleOrderUpdate}
                refreshOrders={(newOrders) => setOrders([...newOrders])}
              />
            ))
          ) : (
            <p className={styles.noOrdersText}>No orders found.</p>
          )}
        </div>
      </div>

      <ModalPortal isOpen={showLocationModal}>
        <LocationPermissionModal
          isOpen={showLocationModal}
          onClose={() => setShowLocationModal(false)}
          onPermissionGranted={handleLocationPermission}
          order={orders.find(
            (order) =>
              order.type === "given" &&
              order.status === "accepted" &&
              !order.location?.latitude
          )}
        />
      </ModalPortal>

      <ModalPortal isOpen={showReminderModal}>
        <FreelancerReminderModal
          isOpen={showReminderModal}
          onClose={handleReminderClose}
          order={currentReminderOrder}
          onReached={handleFreelancerReached}
          onCancel={handleOrderCancel}
          onLocationPermission={handleReminderLocationPermission}
          freelancerUsername={initialUserData?.username}
        />
      </ModalPortal>

      <ModalPortal isOpen={showNegotiationModal}>
        <NegotiationModal
          isOpen={showNegotiationModal}
          onClose={() => setShowNegotiationModal(false)}
          order={currentNegotiation}
          onRespond={handleNegotiationResponse}
          username={initialUserData?.username}
        />
      </ModalPortal>

      <ModalPortal isOpen={showArrivalModal}>
        <ClientArrivalConfirmationModal
          isOpen={showArrivalModal}
          onClose={() => {
            setShowArrivalModal(false);
            setArrivalOrder(null);
          }}
          order={arrivalOrder}
          onConfirmArrival={handleConfirmArrival}
          onRejectArrival={handleRejectArrival}
        />
      </ModalPortal>

      <ModalPortal isOpen={showServiceModal}>
        <FreelancerServiceModal
          isOpen={showServiceModal}
          onClose={() => {
            setShowServiceModal(false);
            setServiceOrder(null);
          }}
          order={serviceOrder}
          onServiceCompleted={handleServiceCompleted}
          onOrderCancelled={handleServiceCancelled}
          freelancerUsername={initialUserData?.username}
          refreshOrders={(newOrders) => setOrders([...newOrders])}
        />
      </ModalPortal>

      <ModalPortal isOpen={showSatisfactionModal}>
        <ClientSatisfactionModal
          isOpen={showSatisfactionModal}
          onClose={() => {
            setShowSatisfactionModal(false);
            setSatisfactionOrder(null);
          }}
          order={satisfactionOrder}
          onSatisfactionSubmitted={handleSatisfactionSubmitted}
          clientUsername={initialUserData?.username}
        />
      </ModalPortal>

      {/* CRITICAL: Real-time Order Detail Modal */}
      <ModalPortal isOpen={showRealtimeOrderModal}>
        <OrderDetailModal
          isOpen={showRealtimeOrderModal}
          onClose={() => {
            console.log("🚪 Closing real-time order modal");
            setShowRealtimeOrderModal(false);
            setRealtimeOrder(null);
          }}
          order={realtimeOrder}
          onAcceptOrder={handleRealtimeAcceptOrder}
          onGiveOffer={handleRealtimeGiveOffer}
        />
      </ModalPortal>

      {/* CRITICAL: Real-time Offer Modal */}
      <ModalPortal isOpen={showRealtimeOfferModal}>
        <FreelancerOfferModal
          isOpen={showRealtimeOfferModal}
          onClose={() => {
            console.log("🚪 Closing real-time offer modal");
            setShowRealtimeOfferModal(false);
            setRealtimeOrder(null);
          }}
          order={realtimeOrder}
          refreshOrders={(newOrders) => setOrders([...newOrders])}
        />
      </ModalPortal>
    </>
  );
}
