"use client";

import { useState } from "react";
import styles from "./freelancerOfferModal.module.css";
import axios from "axios";
import { useUserData } from "@/Context/context";
import { useNegotiateOrder } from "@/Utils/Mutations/mutations";

export default function FreelancerOfferModal({
  isOpen,
  onClose,
  order,
  refreshOrders,
}) {
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

  const handleSubmit = async (data) => {
    // e.preventDefault();
    setIsSubmitting(true);

    try {
      negotiate({
        orderId: order.orderId,
        action: "counter",
        newPrice: parseFloat(data.get("price")),
        expectedReachTime: data.get("arrivalDateTime"),
        currentUsername: initialUserData?.username,
        otherUsername: order.customerInfo.username,
        currentUserType: "freelancer",
      });
    } catch (err) {
      console.error("Error countering offer:", err);
    }

    // setFormData({ price: "", arrivalDateTime: "" });
    setIsSubmitting(false);
    onClose();
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
          {/* Order Summary */}
          <div className={styles.orderSummary}>
            <div className={styles.summaryTitle}>
              <span>📋</span>
              Order Summary
            </div>
            <div className={styles.summaryContent}>
              <strong>{order.customerInfo.username}</strong> is requesting your
              service with a budget of <strong>${order.priceToBePaid}</strong>
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

          <form className={styles.form} action={handleSubmit}>
            {/* Price */}
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

            {/* Arrival Date and Time */}
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

            {/* Form Actions */}
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
