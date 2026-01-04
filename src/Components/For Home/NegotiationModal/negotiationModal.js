"use client";

import { useState } from "react";
import styles from "./negotiationModal.module.css";
import { useNegotiateOrder } from "@/Utils/Mutations/mutations";
import {
  checkFreelancerOnline,
  respondToOrderRealtime,
} from "@/Actions/Orders/orderSocketClient";
import { getSocket } from "@/Socket_IO/socket";

export default function NegotiationModal({
  isOpen,
  onClose,
  order,
  onRespond,
  username,
  isRealtime = false, // NEW: Flag to indicate if this is a real-time negotiation
}) {
  const [showCounterInput, setShowCounterInput] = useState(false);
  const [counterPrice, setCounterPrice] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { mutate: negotiate } = useNegotiateOrder(onRespond);

  const isClient = order.type === "given";
  const offerGiverInfo = isClient ? order.freelancerInfo : order.customerInfo;
  const offerGiverName = offerGiverInfo?.username;
  const offeredPrice =
    order.negotiation?.offeredPrice || order.offeredPrice || 0;
  const currency = order.currency || "USD";

  const handleAccept = async () => {
    setIsLoading(true);
    try {
      const acceptedPrice = order.negotiation?.offeredPrice;
      const isOnline = await checkFreelancerOnline(freelancer.username);
      if (isOnline) {
        // USE SOCKETS for real-time negotiations
        console.log("✅ Accepting offer via socket");

        await respondToOrderRealtime(
          order.orderId,
          "accept",
          acceptedPrice,
          "Offer accepted"
        );

        console.log("✅ Acceptance sent via socket");
      } else {
        // USE DATABASE for offline negotiations
        console.log("✅ Accepting offer via database");

        negotiate({
          orderId: order.orderId,
          action: "accept",
          newPrice: acceptedPrice,
          currentUserType: isClient ? "client" : "freelancer",
          currentUsername: username,
          otherUsername: offerGiverInfo?.username,
        });
      }

      onClose();
    } catch (err) {
      console.error("Error accepting offer:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCounterOffer = async () => {
    if (!counterPrice || parseFloat(counterPrice) <= 0) return;
    setIsLoading(true);

    try {
      const newPrice = parseFloat(counterPrice);

      if (isRealtime) {
        // USE SOCKETS for real-time negotiations
        console.log("💰 Sending counter offer via socket");

        await respondToOrderRealtime(
          order.orderId,
          "counter",
          newPrice,
          `Counter offer: ${newPrice}`
        );

        console.log("💰 Counter offer sent via socket");
      } else {
        // USE DATABASE for offline negotiations
        console.log("💰 Sending counter offer via database");

        negotiate({
          orderId: order.orderId,
          action: "counter",
          newPrice,
          currentUserType: isClient ? "client" : "freelancer",
          currentUsername: username,
          otherUsername: offerGiverInfo?.username,
        });
      }

      onClose();
    } catch (err) {
      console.error("Error countering offer:", err);
    } finally {
      setIsLoading(false);
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
        <div className={styles.cardHeader}>
          <div className={styles.headerContent}>
            <div className={styles.headerTitle}>
              <h1>Order Negotiation</h1>
            </div>
            <p className={styles.headerDescription}>
              Review the offer and decide whether to accept or make a counter
              offer.
            </p>
          </div>
        </div>

        <div className={styles.cardContent}>
          <div className={styles.offerGiverSection}>
            <div className={styles.offerGiverAvatar}>
              {offerGiverInfo?.profilePicture ? (
                <img src={offerGiverInfo.profilePicture} alt={offerGiverName} />
              ) : (
                <div className={styles.offerGiverAvatarFallback}>
                  {offerGiverName
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>
              )}
            </div>
            <div className={styles.offerGiverInfo}>
              <h3 className={styles.offerGiverName}>{offerGiverName}</h3>
              <p className={styles.offerGiverRole}>
                {isClient ? "Freelancer Offer" : "Client Counter Offer"}
              </p>
            </div>
          </div>

          <div className={styles.orderSummary}>
            <div className={styles.summaryTitle}>
              <span>📋</span>
              Order Summary
            </div>
            <div className={styles.summaryContent}>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>Service:</span>
                <span className={styles.summaryValue}>
                  {order.service ||
                    order.problemDescription?.substring(0, 50) + "..." ||
                    "Service Request"}
                </span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>City:</span>
                <span className={styles.summaryValue}>
                  {order.city || "Not specified"}
                </span>
              </div>
              {order.deadline && (
                <div className={styles.summaryRow}>
                  <span className={styles.summaryLabel}>Deadline:</span>
                  <span className={styles.summaryValue}>
                    {new Date(order.deadline).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className={styles.currentOfferSection}>
            <div className={styles.offerTitle}>
              <span>💰</span>
              Current Offer
            </div>
            <div className={styles.offerAmount}>
              {currency === "USD" && "$"}
              {currency === "EUR" && "€"}
              {currency === "GBP" && "£"}
              {offeredPrice}
              <span className={styles.currency}>{currency}</span>
            </div>
            <div className={styles.offerLabel}>Offered by {offerGiverName}</div>
          </div>

          {!showCounterInput ? (
            <div className={styles.actionButtons}>
              <button
                className={styles.acceptButton}
                onClick={handleAccept}
                disabled={isLoading}
              >
                {isLoading ? "Processing..." : "✅ Accept Offer"}
              </button>
              <button
                className={styles.counterButton}
                onClick={() => setShowCounterInput(true)}
                disabled={isLoading}
              >
                💬 Counter Offer
              </button>
            </div>
          ) : (
            <div className={styles.counterOfferSection}>
              <div className={styles.counterTitle}>
                <span>💵</span>
                Your Counter Offer
              </div>
              <div className={styles.priceInputGroup}>
                <span className={styles.currencySymbol}>
                  {currency === "USD" && "$"}
                  {currency === "EUR" && "€"}
                  {currency === "GBP" && "£"}
                </span>
                <input
                  type="number"
                  value={counterPrice}
                  onChange={(e) => setCounterPrice(e.target.value)}
                  className={styles.priceInput}
                  placeholder="Enter your offer"
                  min="0"
                  step="0.01"
                />
                <span className={styles.currencyLabel}>{currency}</span>
              </div>
              <div className={styles.helpText}>
                Current offer: {currency === "USD" && "$"}
                {currency === "EUR" && "€"}
                {currency === "GBP" && "£"}
                {offeredPrice} {currency}
              </div>
              <div className={styles.counterActions}>
                <button
                  className={styles.cancelCounterButton}
                  onClick={() => {
                    setShowCounterInput(false);
                    setCounterPrice("");
                  }}
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button
                  className={styles.submitCounterButton}
                  onClick={handleCounterOffer}
                  disabled={
                    isLoading || !counterPrice || parseFloat(counterPrice) <= 0
                  }
                >
                  {isLoading ? "Submitting..." : "Submit Counter"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
