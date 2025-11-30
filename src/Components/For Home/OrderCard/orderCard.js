"use client";

import { useState } from "react";
import styles from "./orderCard.module.css";
import OrderDetailModal from "../OrderDetailModal/orderDetailModal";
import FreelancerOfferModal from "../FreelancerOfferModal/freelancerOfferModal";
import GoogleMapsModal from "../GoogleMapsModal/googleMapsModal";
import ModalPortal from "../ModalPortal/modalPortal";

export default function OrderCard({
  order,
  onOrderUpdate,
  onFreelancerArrived,
}) {
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [showMapsModal, setShowMapsModal] = useState(false);

  const getCardStatus = () => {
    if (order.type === "given") {
      switch (order.status) {
        case "given":
          return "order-given";
        case "accepted":
          return "offer-accepted";
        case "in-progress":
          return "on-way";
        case "completed":
          return "completed";
        default:
          return "order-given";
      }
    } else {
      // received orders
      switch (order.status) {
        case "initiated":
          return "order-received";
        case "accepted":
          return "client-waiting";
        case "in-progress":
          return "in-progress";
        case "completed":
          return "completed";
        default:
          return "order-received";
      }
    }
  };

  const getTimePassed = (timestamp) => {
    const now = new Date();
    const orderTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now - orderTime) / (1000 * 60));

    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}h ago`;
    } else {
      return `${Math.floor(diffInMinutes / 1440)}d ago`;
    }
  };

  const handleAcceptOrder = () => {
    onOrderUpdate(order._id, {
      status: "accepted",
      acceptedAt: new Date().toISOString(),
    });
    setShowDetailModal(false);
  };

  const handleGiveOffer = () => {
    setShowDetailModal(false);
    setShowOfferModal(true);
  };

  const handleOfferSubmit = (offerData) => {
    onOrderUpdate(order._id, {
      status: "offer-given",
      offer: offerData,
      offerGivenAt: new Date().toISOString(),
    });
    setShowOfferModal(false);
  };

  const handleShowLocation = () => {
    setShowMapsModal(true);
  };

  const handleSeeFreelancer = () => {
    setShowMapsModal(true);
  };

  // Get user info based on order type
  const getUserInfo = () => {
    if (order.type === "given") {
      // For given orders, show freelancer info
      return {
        name: order.freelancerInfo?.username || "Freelancer",
        avatar: order.freelancerInfo?.profilePicture,
      };
    } else {
      // For received orders, show customer info
      return {
        name: order.customerInfo?.username || "Customer",
        avatar: order.customerInfo?.profilePicture,
      };
    }
  };

  const userInfo = getUserInfo();
  const cardStatus = getCardStatus();

  return (
    <>
      <div
        className={`${styles.orderCard} ${styles[cardStatus]}`}
        onClick={() => setShowDetailModal(true)}
      >
        <div className={styles.orderContent}>
          <div className={styles.orderAvatar}>
            {userInfo.avatar ? (
              <img
                src={userInfo.avatar || "/placeholder.svg"}
                alt={userInfo.name}
              />
            ) : (
              <div className={styles.orderAvatarFallback}>
                {userInfo.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </div>
            )}
          </div>
          <div className={styles.orderInfo}>
            <p className={styles.orderUser}>{userInfo.name}</p>
            <p className={styles.orderService}>
              {order.expertiseRequired?.join(", ") || "Service"}
            </p>

            {/* Dynamic content based on status */}
            {order.type === "given" && (
              <>
                {order.status === "given" && (
                  <div className={styles.orderMeta}>
                    <span className={styles.orderTime}>
                      {getTimePassed(order.createdOn)}
                    </span>
                    <span className={styles.orderBudget}>
                      ${order.priceToBePaid}
                    </span>
                  </div>
                )}
                {order.status === "accepted" && (
                  <div className={styles.orderMeta}>
                    <span className={styles.acceptedText}>
                      Offer accepted for ${order.priceToBePaid}
                    </span>
                    <span className={styles.arrivalTime}>
                      Arriving:{" "}
                      {order.expectedReachTime
                        ? new Date(order.expectedReachTime).toLocaleString()
                        : "TBD"}
                    </span>
                    <button
                      className={styles.seeFreelancerBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSeeFreelancer();
                      }}
                    >
                      🗺️ See Freelancer
                    </button>
                  </div>
                )}
                {order.status === "in-progress" && (
                  <div className={styles.orderMeta}>
                    <span className={styles.onWayText}>
                      {order.isReached?.value ? "Arrived" : "On the way"}
                    </span>
                    <span className={styles.arrivalTime}>
                      {order.expectedReachTime
                        ? `ETA: ${new Date(
                            order.expectedReachTime
                          ).toLocaleTimeString()}`
                        : "ETA: TBD"}
                    </span>
                    <button
                      className={styles.seeFreelancerBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSeeFreelancer();
                      }}
                    >
                      🗺️ Track Live
                    </button>
                  </div>
                )}
                {order.negotiation?.isNegotiating && (
                  <div className={styles.orderMeta}>
                    <span className={styles.offerReceivedText}>
                      Counter offer: ${order.negotiation.offeredPrice}
                    </span>
                    <span className={styles.arrivalTime}>
                      Proposed:{" "}
                      {order.expectedReachTime
                        ? new Date(order.expectedReachTime).toLocaleString()
                        : "TBD"}
                    </span>
                  </div>
                )}
              </>
            )}

            {order.type === "received" && (
              <>
                {order.status === "initiated" && (
                  <div className={styles.orderMeta}>
                    <span className={styles.receivedText}>
                      You received an order
                    </span>
                    <span className={styles.orderTime}>
                      {getTimePassed(order.createdOn)}
                    </span>
                  </div>
                )}
                {order.negotiation?.isNegotiating && (
                  <div className={styles.orderMeta}>
                    <span className={styles.offerGivenText}>
                      Offer given, waiting for response
                    </span>
                    <span className={styles.orderTime}>
                      {getTimePassed(order.createdOn)}
                    </span>
                  </div>
                )}
                {order.status === "accepted" && (
                  <div className={styles.orderMeta}>
                    <span className={styles.clientWaitingText}>
                      Client is waiting
                    </span>
                    <button
                      className={styles.locationBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShowLocation();
                      }}
                    >
                      Show exact location
                    </button>
                  </div>
                )}
              </>
            )}

            <div className={styles.orderBadges}>
              <span
                className={`${styles.orderBadge} ${
                  styles[`badge-${order.type}`]
                }`}
              >
                {order.type}
              </span>
              <span
                className={`${styles.orderBadge} ${
                  styles[`badge-${order.status}`]
                }`}
              >
                {order.status}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Order Detail Modal - Using Portal for proper positioning */}
      <ModalPortal isOpen={showDetailModal}>
        <OrderDetailModal
          isOpen={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          order={order}
          onAcceptOrder={handleAcceptOrder}
          onGiveOffer={handleGiveOffer}
        />
      </ModalPortal>

      {/* Freelancer Offer Modal - Using Portal for proper positioning */}
      <ModalPortal isOpen={showOfferModal}>
        <FreelancerOfferModal
          isOpen={showOfferModal}
          onClose={() => setShowOfferModal(false)}
          order={order}
          onSubmit={handleOfferSubmit}
        />
      </ModalPortal>

      {/* Google Maps Modal - Using Portal for proper positioning */}
      <ModalPortal isOpen={showMapsModal}>
        <GoogleMapsModal
          isOpen={showMapsModal}
          onClose={() => setShowMapsModal(false)}
          address={order.address}
          order={order}
          onFreelancerArrived={onFreelancerArrived}
        />
      </ModalPortal>
    </>
  );
}
