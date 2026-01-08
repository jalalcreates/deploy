"use client";

import { useState } from "react";
import styles from "./freelancerOfferModal.module.css";
import { useUserData } from "@/Context/context";
import { useNegotiateOrder } from "@/Utils/Mutations/mutations";
import { respondToOrderRealtime } from "@/Actions/Orders/orderSocketClient";
import { getSocket } from "@/Socket_IO/socket";

export default function FreelancerOfferModal({
  isOpen,
  onClose,
  order,
  refreshOrders,
  isRealtime = false, // NEW: Flag to indicate if this is a real-time order
}) {
  const socket = getSocket();

  const [formData, setFormData] = useState({
    price: "",
    arrivalDateTime: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { mutate: negotiate } = useNegotiateOrder(refreshOrders);
  const { initialUserData } = useUserData();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const price = parseFloat(formData.price);

      if (!socket) {
        console.error("❌ Socket not available");
        console.log("💰 Sending counter offer via database");

        negotiate({
          orderId: order.orderId,
          action: "counter",
          newPrice: price,
          expectedReachTime: formData.arrivalDateTime,
          currentUsername: initialUserData?.username,
          otherUsername: order.customerInfo.username,
          currentUserType: "freelancer",
        });
        return;
      }
      // USE SOCKETS for real-time orders
      console.log("💰 Sending counter offer via socket");

      // Create order data with expectedReachTime
      const orderDataWithTime = {
        ...order,
        expectedReachTime: formData.arrivalDateTime,
      };

      await respondToOrderRealtime(
        order.orderId,
        "counter",
        price,
        `Counter offer: ${price}`,
        orderDataWithTime // Pass full order data with expectedReachTime
      );

      console.log("✅ Counter offer sent via socket");

      setFormData({ price: "", arrivalDateTime: "" });
      onClose();
    } catch (err) {
      console.error("Error countering offer:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = formData.price && formData.arrivalDateTime;

  if (!isOpen || !order) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            <span>💰</span>
            Give Your Offer
          </h2>
          <button className={styles.closeBtn} onClick={onClose}>
            ×
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.orderSummary}>
            <div className={styles.summaryTitle}>
              <span>📋</span>
              Order Summary
            </div>
            <div className={styles.summaryContent}>
              <strong>{order.customerInfo?.username || order.user}</strong> is
              requesting your service with a budget of{" "}
              <strong>${order.priceToBePaid}</strong>
              {order.deadline && (
                <>
                  {" "}
                  by{" "}
                  <strong>
                    {new Date(order.deadline).toLocaleDateString()}
                  </strong>
                </>
              )}
              .
            </div>
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>
                <span>💵</span>
                Your Offer Price
              </label>
              <div className={styles.priceInputGroup}>
                <span className={styles.currencySymbol}>$</span>
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleInputChange}
                  className={styles.priceInput}
                  placeholder="Enter your price"
                  min="0"
                  step="0.01"
                  required
                />
              </div>
              <div className={styles.helpText}>
                Client's budget: ${order.priceToBePaid}
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>
                <span>⏰</span>
                Arrival Date & Time
              </label>
              <input
                type="datetime-local"
                name="arrivalDateTime"
                value={formData.arrivalDateTime}
                onChange={handleInputChange}
                className={styles.datetimeInput}
                required
                min={new Date().toISOString().slice(0, 16)}
              />
              <div className={styles.helpText}>
                When can you arrive to start the work?
              </div>
            </div>

            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={styles.btnPrimary}
                disabled={!isFormValid || isSubmitting}
              >
                {isSubmitting ? "Submitting..." : "Submit Offer"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
