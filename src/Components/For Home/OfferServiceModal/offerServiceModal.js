"use client";

import { useState } from "react";
import styles from "./offerServiceModal.module.css";
import axios from "axios";
import { useUserData } from "@/Context/context";
import {
  submitOfferRealtime,
  listenForOfferAccepted,
  listenForOfferDeclined,
} from "@/Actions/ServiceRequests/serviceRequestSocketClient";
import { saveOfferToDatabase } from "@/Actions/ServiceRequests/serviceRequestFallbackHandler";

export default function OfferServiceModal({
  isOpen,
  onClose,
  request,
  onSubmit,
}) {
  const { initialUserData } = useUserData();
  const [formData, setFormData] = useState({
    reachTime: "",
    offerPrice: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

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

    const offerData = {
      freelancerInfo: {
        username: initialUserData.username,
        profilePicture: initialUserData.profilePicture,
        satisfiedCustomers: initialUserData.customers?.satisfiedCustomers || 0,
        totalOrdersRecieved: initialUserData.totalOrdersRecieved || 0,
        expertise: initialUserData.expertise || [],
        averageStars: initialUserData.averageStars || 0,
        reviews: initialUserData.reviews || [],
      },
      offeredPrice: parseFloat(formData.offerPrice) || request.willingPrice,
      reachTime: formData.reachTime,
      accepted: false,
    };

    try {
      // First save to database (for persistence)
      const dbResponse = await axios.post("/api/offer-service", {
        requestId: request.requestId,
        ...offerData,
      });

      if (!dbResponse.data.success) {
        throw new Error(dbResponse.data.error || "Failed to save offer");
      }

      // Then try real-time notification
      try {
        const rtResponse = await submitOfferRealtime(
          request.requestId,
          request.customerInfo?.username,
          offerData,
          request
        );

        if (rtResponse.requiresDbFallback) {
          console.log("Requester offline - offer saved to DB only");
        } else {
          console.log("✅ Offer submitted in real-time");
        }
      } catch (rtError) {
        console.error("Real-time offer submission failed:", rtError);
        // Continue anyway since DB save succeeded
      }

      setShowSuccess(true);
      setTimeout(() => {
        setIsSubmitting(false);
        setShowSuccess(false);
        setFormData({ reachTime: "", offerPrice: "" });
        onSubmit?.(formData);
        onClose();
      }, 1500);
    } catch (error) {
      console.error("Failed to submit offer:", error);
      alert(
        error.response?.data?.error ||
          error.message ||
          "Failed to submit offer"
      );
      setIsSubmitting(false);
    }
  };

  const isFormValid = formData.reachTime;

  if (!isOpen || !request) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            <span>💼</span> Offer Your Service
          </h2>
          <button className={styles.closeBtn} onClick={onClose}>
            ×
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.requestSummary}>
            <div className={styles.summaryTitle}>
              <span>📋</span> Request Summary
            </div>
            <div className={styles.summaryContent}>
              <strong>{request.username}</strong> is looking for{" "}
              {request.expertiseRequired?.join(", ") || "professional services"}{" "}
              with a budget of{" "}
              <strong>
                {request.budget} {request.currency}
              </strong>{" "}
              by <strong>{request.deadline}</strong>.
            </div>
          </div>

          {showSuccess && (
            <div className={styles.successMessage}>
              <span>✅</span> Your service offer has been submitted
              successfully!
            </div>
          )}

          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>
                <span>⏰</span> When can you start working?
              </label>
              <input
                type="datetime-local"
                name="reachTime"
                value={formData.reachTime}
                onChange={handleInputChange}
                className={styles.datetimeInput}
                required
                min={new Date().toISOString().slice(0, 16)}
              />
              <div className={styles.helpText}>
                Select the date and time when you can begin this project
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>
                <span>💰</span> Your Offer Price
              </label>
              <div className={styles.priceInputGroup}>
                <input
                  type="number"
                  name="offerPrice"
                  value={formData.offerPrice}
                  onChange={handleInputChange}
                  className={styles.priceInput}
                  placeholder="Enter your price"
                  min="0"
                  step="0.01"
                />
                <div className={styles.currencyDisplay}>{request.currency}</div>
              </div>
              <div className={styles.helpText}>
                Client's budget: {request.willingPrice} {request.currency}
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
