"use client";

import { useEffect, useState } from "react";
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

  // New modal states for the three features
  const [showArrivalModal, setShowArrivalModal] = useState(false);
  const [arrivalOrder, setArrivalOrder] = useState(null);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [serviceOrder, setServiceOrder] = useState(null);
  const [showSatisfactionModal, setShowSatisfactionModal] = useState(false);
  const [satisfactionOrder, setSatisfactionOrder] = useState(null);

  useEffect(() => {
    if (!initialUserData) return;

    const givenOrders = initialUserData.ordersGiven || [];
    const pendingOrders = initialUserData.pendingOrders || [];

    const allOrders = [
      ...givenOrders.map((o) => ({ ...o, type: "given" })),
      ...pendingOrders.map((o) => ({ ...o, type: "received" })),
    ];

    setOrders(allOrders);

    // Location permission for accepted given orders without address
    const needsPermission = givenOrders.some(
      (order) =>
        order.status === "accepted" &&
        !order.location?.latitude &&
        !order.location?.longitude &&
        !locationPermissionGranted
    );
    if (needsPermission) setShowLocationModal(true);

    // Freelancer reminder modal for accepted received orders
    const acceptedOrder = pendingOrders?.find(
      (order) => order.status === "accepted" && order.isReached.value === false
    );

    if (acceptedOrder) {
      setCurrentReminderOrder(acceptedOrder);
      setShowReminderModal(true);
    }

    // Negotiation modal for orders where currentOfferTo is this user
    const negotiationOrder = allOrders.find(
      (order) =>
        order.negotiation.isNegotiating === true &&
        ((order.type === "given" &&
          order.negotiation.currentOfferTo === "client") ||
          (order.type === "received" &&
            order.negotiation.currentOfferTo === "freelancer"))
    );
    if (negotiationOrder) {
      setCurrentNegotiation(negotiationOrder);
      setShowNegotiationModal(true);
    }

    // NEW FEATURE 1: Check for arrival confirmation needed (client view)
    const arrivedOrders = givenOrders.filter(
      (order) =>
        order.status === "accepted" &&
        order.isReached?.value === true &&
        order.isReached?.confirmed !== true
    );
    if (arrivedOrders.length > 0 && !showArrivalModal) {
      setArrivalOrder(arrivedOrders[0]);
      setShowArrivalModal(true);
    }

    // NEW FEATURE 2: Check for service completion needed (freelancer view)
    const confirmedOrders = pendingOrders.filter(
      (order) =>
        order.status === "in-progress" &&
        order.isReached?.value === true &&
        order.isReached?.confirmed === true
    );
    if (confirmedOrders.length > 0 && !showServiceModal) {
      setServiceOrder(confirmedOrders[0]);
      setShowServiceModal(true);
    }

    // NEW FEATURE 3: Check for satisfaction feedback needed (client view)
    const completedOrders = givenOrders.filter(
      (order) =>
        order.status === "completed" &&
        order.proofPictures?.after?.length > 0 &&
        order.review === undefined &&
        order.isSatisfied === undefined
    );
    if (completedOrders.length > 0 && !showSatisfactionModal) {
      setSatisfactionOrder(completedOrders[0]);
      setShowSatisfactionModal(true);
    }
  }, [
    initialUserData,
    locationPermissionGranted,
    currentNegotiation,
    showArrivalModal,
    showServiceModal,
    showSatisfactionModal,
  ]);

  const handleReminderClose = () => {
    setShowReminderModal(false);
    setCurrentReminderOrder(null);
  };

  const handleFreelancerReached = () => {
    console.log("Freelancer has marked themselves as reached.");
    // Update the order status
    if (currentReminderOrder) {
      setOrders((prevOrders) =>
        prevOrders.map((order) =>
          order.orderId === currentReminderorder.orderId
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
    }
    handleReminderClose();
  };

  const handleOrderCancel = () => {
    console.log("Freelancer cancelled the order.");
    // Update the order status
    if (currentReminderOrder) {
      setOrders((prevOrders) =>
        prevOrders.map((order) =>
          order.orderId === currentReminderorder.orderId
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
    }
    handleReminderClose();
  };

  const handleReminderLocationPermission = () => {
    console.log("Freelancer allowed location access.");
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

  const handleLocationPermission = (granted) => {
    setLocationPermissionGranted(granted);
    setShowLocationModal(false);
  };

  const handleNegotiationResponse = (response) => {
    // Future logic to update backend with response
    setShowNegotiationModal(false);
    setCurrentNegotiation(null);
  };

  // NEW FEATURE HANDLERS

  // 1. Arrival Confirmation Handlers
  const handleConfirmArrival = async (orderId) => {
    try {
      // Update order with confirmed arrival
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

      // Here you would make API call to update backend
      // await updateOrderArrivalStatus(orderId, { confirmed: true });

      console.log("Arrival confirmed for order:", orderId);
      setShowArrivalModal(false);
      setArrivalOrder(null);
    } catch (error) {
      console.error("Error confirming arrival:", error);
    }
  };

  const handleRejectArrival = async (orderId) => {
    try {
      // Update order with rejected arrival
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

      // Here you would make API call to update backend
      // await updateOrderArrivalStatus(orderId, { confirmed: false, reached: false });

      console.log("Arrival rejected for order:", orderId);
      setShowArrivalModal(false);
      setArrivalOrder(null);
    } catch (error) {
      console.error("Error rejecting arrival:", error);
    }
  };

  // 2. Service Completion Handlers
  const handleServiceCompleted = async (serviceData) => {
    try {
      const { orderId, beforeImages, afterImages, description } = serviceData;

      // Update order with service completion
      setOrders((prevOrders) =>
        prevOrders.map((order) =>
          order.orderId === orderId
            ? {
                ...order,
                status: "completed",
                proofPictures: {
                  before: beforeImages || [],
                  after: afterImages || [],
                  description: description || "",
                },
                finishDate: new Date(),
              }
            : order
        )
      );

      // Here you would make API call to update backend
      // await updateOrderCompletion(orderId, serviceData);

      console.log("Service completed for order:", orderId);
      setShowServiceModal(false);
      setServiceOrder(null);
    } catch (error) {
      console.error("Error completing service:", error);
    }
  };

  const handleServiceCancelled = (orderId) => {
    try {
      // Update order status to cancelled
      setOrders((prevOrders) =>
        prevOrders.map((order) =>
          order.orderId === orderId
            ? {
                ...order,
                status: "cancelled",
                cancelled: {
                  isCancelled: true,
                  cancelledBy: initialUserData?.username,
                },
              }
            : order
        )
      );

      console.log("Service cancelled for order:", orderId);
      setShowServiceModal(false);
      setServiceOrder(null);
    } catch (error) {
      console.error("Error cancelling service:", error);
    }
  };

  // 3. Satisfaction Handlers
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

      {/* Existing Modals */}
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
          onRespond={(updatedOrders) => {
            setOrders(updatedOrders);
            setCurrentNegotiation(null);
            setShowNegotiationModal(false);
          }}
          username={initialUserData?.username}
        />
      </ModalPortal>

      {/* NEW FEATURE MODALS */}

      {/* 1. Client Arrival Confirmation Modal */}
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

      {/* 2. Freelancer Service Modal */}
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

      {/* 3. Client Satisfaction Modal */}
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
    </>
  );
}
