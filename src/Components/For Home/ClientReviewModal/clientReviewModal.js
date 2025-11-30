"use client";

import { useState } from "react";
import { z } from "zod";
import styles from "./clientReviewModal.module.css";

// Review validation schema
const reviewSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  rating: z
    .number()
    .min(1, "Please select a rating")
    .max(5, "Rating cannot exceed 5 stars"),
  review: z
    .string()
    .min(10, "Review must be at least 10 characters")
    .max(500, "Review cannot exceed 500 characters"),
  wouldRecommend: z.boolean(),
});

export default function ClientReviewModal({
  isOpen,
  onClose,
  order,
  onReviewSubmitted,
}) {
  const [formData, setFormData] = useState({
    rating: 0,
    review: "",
    wouldRecommend: null,
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hoveredStar, setHoveredStar] = useState(0);

  const handleStarClick = (rating) => {
    setFormData((prev) => ({ ...prev, rating }));
    setErrors((prev) => ({ ...prev, rating: null }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setErrors({});

    try {
      const feedbackData = {
        satisfied: true,
        rating: formData.rating,
        review: formData.review,
        wouldRecommend: formData.wouldRecommend,
      };
      await onReviewSubmitted(feedbackData);
      onClose();
    } catch (error) {
      console.error("Review submission error:", error);

      let errorMessage = "Failed to submit review. Please try again.";

      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }

      // Handle Zod validation errors from API
      if (error.response?.data?.details) {
        const apiErrors = {};
        error.response.data.details.forEach((detail) => {
          apiErrors[detail.field] = detail.message;
        });
        setErrors(apiErrors);
        setIsSubmitting(false);
        return;
      }

      setErrors({ submit: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRatingText = (rating) => {
    const ratingTexts = {
      1: "Poor",
      2: "Fair",
      3: "Good",
      4: "Very Good",
      5: "Excellent",
    };
    return ratingTexts[rating] || "";
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.reviewIcon}>⭐</div>
          <h2 className={styles.modalTitle}>Rate Your Experience</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            ×
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.serviceInfo}>
            <h3 className={styles.serviceTitle}>{order.service}</h3>
            <p className={styles.freelancerName}>
              Freelancer: {order.freelancerInfo?.name || order.user}
            </p>
            <p className={styles.completionTime}>
              Completed: {new Date().toLocaleString()}
            </p>
          </div>

          <div className={styles.ratingSection}>
            <h4 className={styles.ratingTitle}>
              How would you rate this service?
            </h4>
            <div className={styles.starRating}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className={`${styles.star} ${
                    star <= (hoveredStar || formData.rating)
                      ? styles.starFilled
                      : styles.starEmpty
                  }`}
                  onClick={() => handleStarClick(star)}
                  onMouseEnter={() => setHoveredStar(star)}
                  onMouseLeave={() => setHoveredStar(0)}
                >
                  ★
                </button>
              ))}
            </div>
            {formData.rating > 0 && (
              <p className={styles.ratingText}>
                {formData.rating} star{formData.rating !== 1 ? "s" : ""} -{" "}
                {getRatingText(formData.rating)}
              </p>
            )}
            {errors.rating && (
              <span className={styles.error}>{errors.rating}</span>
            )}
          </div>

          <div className={styles.reviewSection}>
            <label className={styles.reviewLabel}>
              📝 Share your experience (10-500 characters)
            </label>
            <textarea
              value={formData.review}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, review: e.target.value }))
              }
              placeholder="Tell others about your experience with this service..."
              className={styles.reviewTextarea}
              maxLength={500}
            />
            <div className={styles.charCount}>
              {formData.review.length}/500 characters
            </div>
            {errors.review && (
              <span className={styles.error}>{errors.review}</span>
            )}
          </div>

          <div className={styles.recommendSection}>
            <h4 className={styles.recommendTitle}>
              Would you recommend this freelancer?
            </h4>
            <div className={styles.recommendButtons}>
              <button
                type="button"
                className={`${styles.recommendBtn} ${
                  formData.wouldRecommend === true
                    ? styles.recommendYes
                    : styles.recommendNeutral
                }`}
                onClick={() =>
                  setFormData((prev) => ({ ...prev, wouldRecommend: true }))
                }
              >
                👍 Yes, I would recommend
              </button>
              <button
                type="button"
                className={`${styles.recommendBtn} ${
                  formData.wouldRecommend === false
                    ? styles.recommendNo
                    : styles.recommendNeutral
                }`}
                onClick={() =>
                  setFormData((prev) => ({ ...prev, wouldRecommend: false }))
                }
              >
                👎 No, I wouldn't recommend
              </button>
            </div>
          </div>
        </div>

        <div className={styles.modalActions}>
          <button type="button" onClick={onClose} className={styles.cancelBtn}>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={
              isSubmitting ||
              formData.rating === 0 ||
              formData.review.length < 10 ||
              formData.wouldRecommend === null
            }
            className={styles.submitBtn}
          >
            {isSubmitting ? "Submitting..." : "📤 Submit Review"}
          </button>
        </div>
      </div>
    </div>
  );
}
