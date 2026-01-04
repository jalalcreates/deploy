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
  const globalSocket = getSocket();
  console.log({ globalSocket });
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
  // CRITICAL FIX: LISTEN FOR REAL-TIME INCOMING ORDERS
  // ============================================
  useEffect(() => {
    // Check if user is freelancer
    if (!initialUserData?.isFreelancer) return;

    const socket = getSocket();

    if (!socket) {
      console.error("❌ Socket not available");
      return;
    }

    // if (!socket.connected) {
    //   console.warn("⚠️ Socket not connected yet, waiting...");

    //   // Wait for socket to connect
    //   const onConnect = () => {
    //     console.log("✅ Socket connected, now listening for orders");
    //     setupListener();
    //   };

    //   socket.once("connect", onConnect);

    //   // If already connected, setup immediately
    //   if (socket.connected) {
    //     console.log("ready to listen");
    //     setupListener(socket);
    //   }

    //   return () => {
    //     socket.off("connect", onConnect);
    //     socket.off("new-order-realtime", handleIncomingOrder);
    //   };
    // } else {
    // Socket already connected
    console.log("✅ Socket already connected, setting up listener");
    // setupListener();
    socket.on("new-order-realtime", handleIncomingOrder);

    return () => {
      socket.off("new-order-realtime", handleIncomingOrder);
    };
    // }

    function setupListener(socketRecieved) {
      if (!socketRecieved) return;
      console.log({ socket });
      console.log("📡 Registering 'new-order-realtime' listener");

      // Register the listener
      socketRecieved.on("new-order-realtime", handleIncomingOrder);

      console.log("✅ Listener registered successfully");
    }

    function handleIncomingOrder(orderData) {
      console.log("🔔🔔🔔 REAL-TIME ORDER RECEIVED! 🔔🔔🔔");
      console.log("Order data:", orderData);

      // Format order data to match schema
      const formattedOrder = {
        orderId: orderData.orderId,
        customerInfo: {
          username: orderData.clientUsername,
          profilePicture: orderData.clientProfilePicture || "",
        },
        user: orderData.clientUsername, // CRITICAL: OrderDetailModal needs this
        priceToBePaid: orderData.budget,
        currency: orderData.currency,
        problemDescription: orderData.problemStatement,
        problemStatement: orderData.problemStatement, // Some components check this field
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

      console.log("✅ Formatted order:", formattedOrder);

      // Add to orders list
      setOrders((prevOrders) => {
        console.log("📝 Adding order to orders list");
        return [...prevOrders, formattedOrder];
      });

      // Show order detail modal immediately
      console.log("🪟 Opening OrderDetailModal");
      setRealtimeOrder(formattedOrder);
      setShowRealtimeOrderModal(true);

      console.log("✅ Modal state updated, should be visible now!");
    }
  }, [initialUserData?.isFreelancer, globalSocket?.connected, globalSocket]);

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
        "Order accepted"
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

  // Helper function to check and show appropriate modals
  const checkAndShowModals = useCallback(
    (givenOrders, pendingOrders, allOrders) => {
      // Priority 1: Freelancer reminder modal (CRITICAL)
      const acceptedFreelancerOrder = pendingOrders?.find(
        (order) =>
          order.status === "accepted" && order.isReached?.value === false
      );

      if (acceptedFreelancerOrder) {
        setCurrentReminderOrder(acceptedFreelancerOrder);
        setShowReminderModal(true);
        return;
      }

      // Priority 2: Location permission for accepted given orders
      const needsPermission = givenOrders.some(
        (order) =>
          order.status === "accepted" &&
          !order.location?.latitude &&
          !order.location?.longitude &&
          !locationPermissionGranted
      );
      if (needsPermission && !locationPermissionGranted) {
        setShowLocationModal(true);
        return;
      }

      // Priority 3: Negotiation modal
      const negotiationOrder = allOrders.find(
        (order) =>
          order.negotiation?.isNegotiating === true &&
          ((order.type === "given" &&
            order.negotiation.currentOfferTo === "client") ||
            (order.type === "received" &&
              order.negotiation.currentOfferTo === "freelancer"))
      );
      if (negotiationOrder) {
        setCurrentNegotiation(negotiationOrder);
        setShowNegotiationModal(true);
        return;
      }

      // Priority 4: Arrival confirmation (client view)
      const arrivedOrders = givenOrders.filter(
        (order) =>
          order.status === "accepted" &&
          order.isReached?.value === true &&
          order.isReached?.confirmed !== true
      );
      if (arrivedOrders.length > 0) {
        setArrivalOrder(arrivedOrders[0]);
        setShowArrivalModal(true);
        return;
      }

      // Priority 5: Service completion (freelancer view)
      const confirmedOrders = pendingOrders.filter(
        (order) =>
          order.status === "in-progress" &&
          order.isReached?.value === true &&
          order.isReached?.confirmed === true
      );
      if (confirmedOrders.length > 0) {
        setServiceOrder(confirmedOrders[0]);
        setShowServiceModal(true);
        return;
      }

      // Priority 6: Satisfaction feedback (client view)
      const completedOrders = givenOrders.filter(
        (order) =>
          order.status === "completed" &&
          order.proofPictures?.after?.length > 0 &&
          order.review === undefined &&
          order.isSatisfied === false
      );
      if (completedOrders.length > 0) {
        setSatisfactionOrder(completedOrders[0]);
        setShowSatisfactionModal(true);
      }
    },
    [
      initialUserData,
      locationPermissionGranted,
      currentNegotiation,
      showArrivalModal,
      showServiceModal,
      showSatisfactionModal,
    ]
  );

  const handleReminderClose = () => {
    setShowReminderModal(false);
    setCurrentReminderOrder(null);
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

  const handleLocationPermission = async (granted) => {
    if (granted && navigator.geolocation) {
      try {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });

        const { latitude, longitude } = position.coords;

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
    setShowLocationModal(false);
  };

  const handleNegotiationResponse = (updatedOrders) => {
    if (updatedOrders) {
      setOrders(updatedOrders);
    }
    setShowNegotiationModal(false);
    setCurrentNegotiation(null);
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
        setShowArrivalModal(false);
        setArrivalOrder(null);
      }
    } catch (error) {
      console.error("Error confirming arrival:", error);
    }
  };

  const handleRejectArrival = async (orderId) => {
    try {
      const formData = new FormData();
      formData.append("orderId", orderId);
      formData.append("clientUsername", initialUserData?.username);
      formData.append("confirmed", "false");

      const result = await confirmArrival(formData);

      if (result.success) {
        setOrders((prevOrders) =>
          prevOrders.map((order) =>
            order.orderId === orderId
              ? {
                  ...order,
                  isReached: {
                    value: false,
                    time: null,
                    confirmed: false,
                  },
                }
              : order
          )
        );

        console.log("Arrival rejected for order:", orderId);
        setShowArrivalModal(false);
        setArrivalOrder(null);
      }
    } catch (error) {
      console.error("Error rejecting arrival:", error);
    }
  };

  const handleServiceCompleted = async (serviceData) => {
    setShowServiceModal(false);
    setServiceOrder(null);
  };

  const handleServiceCancelled = (orderId) => {
    setShowServiceModal(false);
    setServiceOrder(null);
  };

  const handleSatisfactionSubmitted = async (satisfactionData) => {
    setShowSatisfactionModal(false);
    setSatisfactionOrder(null);
  };

  return (
    <>
      <div className={styles.ordersSidebar}>
        <h2 className={styles.ordersHeader}>Orders</h2>
        <div className={styles.ordersList}>
          {orders.length > 0 ? (
            orders.map((order) => (
              <OrderCard
                key={order.orderId}
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
