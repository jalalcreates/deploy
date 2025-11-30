"use client";

import { useState } from "react";
import AudioRecorder from "@/Utils/Audio/AudioRecorder";
import ClientReviewModal from "../ClientReviewModal/clientReviewModal";
import styles from "./clientSatisfactionModal.module.css";
import {
  clientFeedbackFormSchema,
  validateFeedbackImages,
  validateAudioFeedback,
} from "@/Zod/PopUp Modals/schema";
import axios from "axios";

export default function ClientSatisfactionModal({
  isOpen,
  onClose,
  order,
  clientUsername,
  onSatisfactionSubmitted,
}) {
  const [step, setStep] = useState("initial"); // 'initial', 'feedback', 'review', 'success'
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [formData, setFormData] = useState({
    serviceCompleted: null,
    satisfied: null,
    textFeedback: "",
    images: [],
    rating: 0,
    review: "",
    wouldRecommend: null,
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hoveredStar, setHoveredStar] = useState(0);

  // Audio recorder hook
  const { startRecording, stopRecording, isRecording, finalAudioBlob } =
    AudioRecorder();

  const handleServiceCompletedResponse = (completed) => {
    setFormData((prev) => ({ ...prev, serviceCompleted: completed }));
    if (!completed) {
      // If service not completed, automatically set satisfied to false and show feedback
      setFormData((prev) => ({ ...prev, satisfied: false }));
      setStep("feedback");
    }
  };

  const handleSatisfactionResponse = (satisfied) => {
    setFormData((prev) => ({ ...prev, satisfied }));
    if (!satisfied) {
      setStep("feedback");
    } else {
      // If satisfied, show review modal instead of submitting immediately
      setShowReviewModal(true);
    }
  };

  const submitFeedback = async (feedbackData) => {
    console.log("Submitting feedback data:", feedbackData);
    setIsSubmitting(true);
    setErrors({});

    try {
      // Client-side Zod validation
      // const formValidation = clientFeedbackFormSchema.safeParse(feedbackData);

      // if (!formValidation.success) {
      //   const zodErrors = {};
      //   formValidation.error.errors.forEach((error) => {
      //     zodErrors[error.path.join(".")] = error.message;
      //   });
      //   console.log("Client validation errors:", zodErrors);
      //   setErrors(zodErrors);
      //   setIsSubmitting(false);
      //   return;
      // }
      // console.log(formValidation.data);
      // // Validate files if not satisfied
      // if (!feedbackData.satisfied) {
      //   const imageValidation = validateFeedbackImages(formData.images);
      //   if (!imageValidation.valid) {
      //     setErrors((prev) => ({
      //       ...prev,
      //       images: imageValidation.errors.join(", "),
      //     }));
      //     setIsSubmitting(false);
      //     return;
      //   }

      //   const audioValidation = validateAudioFeedback(finalAudioBlob);
      //   if (!audioValidation.valid) {
      //     setErrors((prev) => ({
      //       ...prev,
      //       audio: audioValidation.errors.join(", "),
      //     }));
      //     setIsSubmitting(false);
      //     return;
      //   }
      // }
      // console.log(audioValidation.data, imageValidation.data);

      // Create FormData for API call
      const submitFormData = new FormData();

      // Append validated data
      submitFormData.append("orderId", order.orderId);
      submitFormData.append("clientUsername", clientUsername);
      submitFormData.append(
        "freelancerUsername",
        order.freelancerInfo?.username
      );
      submitFormData.append("satisfied", feedbackData.satisfied);
      submitFormData.append("rating", feedbackData.rating);
      submitFormData.append("review", feedbackData.review);
      submitFormData.append("wouldRecommend", feedbackData.wouldRecommend);
      submitFormData.append("textFeedback", feedbackData.textFeedback || "");

      // Append files for unsatisfied customers
      if (!feedbackData.satisfied) {
        formData.images.forEach((image) => {
          submitFormData.append("feedbackImages", image);
        });

        if (finalAudioBlob) {
          submitFormData.append("audioFeedback", finalAudioBlob);
        }
      }
      // for (const pair of submitFormData.entries()) {
      //   console.log(`${pair[0]}: ${pair[1]}`);
      // }
      console.log("Making API call...");
      const response = await axios.post(
        "/api/client-feedback",
        submitFormData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      // const response = await fetch("/api/client-feedback", {
      //   method: "POST",
      //   body: { msg: "hi" },
      //   headers: { "Content-Type": "application/json" },
      // });
      console.log("Feedback submitted successfully:", response);

      // Call parent callback with unified data
      const unifiedData = {
        orderId: order.orderId,
        satisfied: feedbackData.satisfied,
        feedback: {
          textFeedback: feedbackData.textFeedback,
          audioFeedback: finalAudioBlob,
          images: formData.images,
        },
        review: {
          rating: feedbackData.rating,
          review: feedbackData.review,
          wouldRecommend: feedbackData.wouldRecommend,
          freelancerName: order.freelancerInfo?.username,
          serviceName: order.expertiseRequired?.join(", "),
          completedAt: new Date().toISOString(),
          clientName: clientUsername,
        },
      };

      await onSatisfactionSubmitted(unifiedData);

      if (feedbackData.satisfied) {
        setShowReviewModal(false);
      } else {
        setStep("success");
        setTimeout(() => onClose(), 3000);
      }

      onClose();
    } catch (error) {
      console.error("Submission error:", error);
      let errorMessage = "Failed to submit feedback. Please try again.";

      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
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

  const handleReviewSubmitted = async (reviewData) => {
    await submitFeedback(reviewData);
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length + formData.images.length > 4) {
      setErrors((prev) => ({ ...prev, images: "Maximum 4 images allowed" }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      images: [...prev.images, ...files],
    }));
    setErrors((prev) => ({ ...prev, images: null }));
  };

  const removeImage = (index) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const handleStarClick = (rating) => {
    setFormData((prev) => ({ ...prev, rating }));
    setErrors((prev) => ({ ...prev, rating: null }));
  };

  const proceedToReview = (e) => {
    e.preventDefault();
    setStep("review");
  };

  const handleFinalSubmit = async () => {
    await submitFeedback({
      satisfied: formData.satisfied,
      rating: formData.rating,
      review: formData.review,
      wouldRecommend: formData.wouldRecommend,
      textFeedback: formData.textFeedback,
    });
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
    <>
      <div
        className={styles.modalOverlay}
        onClick={step !== "success" ? onClose : undefined}
      >
        <div
          className={styles.modalContent}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.modalHeader}>
            <div className={styles.satisfactionIcon}>
              {step === "success" ? "✅" : "⭐"}
            </div>
            <h2 className={styles.modalTitle}>
              {step === "success"
                ? "Feedback Submitted"
                : step === "review"
                ? "Rate Your Experience"
                : "Service Feedback"}
            </h2>
            {step !== "success" && (
              <button className={styles.closeBtn} onClick={onClose}>
                ×
              </button>
            )}
          </div>

          {step === "initial" && (
            <div className={styles.modalBody}>
              <div className={styles.serviceInfo}>
                <h3 className={styles.serviceTitle}>{order.service}</h3>
                <p className={styles.freelancerName}>
                  Freelancer: {order.freelancerInfo?.name || order.user}
                </p>
                <p className={styles.completionTime}>
                  Completed at: {new Date().toLocaleString()}
                </p>
              </div>

              <div className={styles.questionSection}>
                <h4 className={styles.questionTitle}>
                  Was the service completed as expected?
                </h4>
                <div className={styles.buttonGroup}>
                  <button
                    className={`${styles.responseBtn} ${styles.yesBtn}`}
                    onClick={() => handleServiceCompletedResponse(true)}
                  >
                    ✅ Yes, Completed
                  </button>
                  <button
                    className={`${styles.responseBtn} ${styles.noBtn}`}
                    onClick={() => handleServiceCompletedResponse(false)}
                  >
                    ❌ No, Incomplete
                  </button>
                </div>
              </div>

              {formData.serviceCompleted === true && (
                <div className={styles.questionSection}>
                  <h4 className={styles.questionTitle}>
                    Are you satisfied with the service quality?
                  </h4>
                  <div className={styles.buttonGroup}>
                    <button
                      className={`${styles.responseBtn} ${styles.yesBtn}`}
                      onClick={() => handleSatisfactionResponse(true)}
                    >
                      😊 Yes, Satisfied
                    </button>
                    <button
                      className={`${styles.responseBtn} ${styles.noBtn}`}
                      onClick={() => handleSatisfactionResponse(false)}
                    >
                      😞 No, Not Satisfied
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === "feedback" && (
            <div className={styles.feedbackForm}>
              <div className={styles.formHeader}>
                <h3 className={styles.formTitle}>We're Sorry to Hear That</h3>
                <p className={styles.formSubtitle}>
                  Please provide detailed feedback so we can improve our service
                </p>
              </div>

              <div className={styles.formBody}>
                {/* Text Feedback */}
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>
                    📝 Describe the issue (Optional but recommended)
                  </label>
                  <textarea
                    value={formData.textFeedback}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        textFeedback: e.target.value,
                      }))
                    }
                    placeholder="Please describe what went wrong or what could be improved..."
                    className={styles.feedbackTextarea}
                    maxLength={1000}
                  />
                  <span className={styles.charCount}>
                    {formData.textFeedback.length}/1000
                  </span>
                  {errors["feedback.textFeedback"] && (
                    <span className={styles.error}>
                      {errors["feedback.textFeedback"]}
                    </span>
                  )}
                </div>

                {/* Audio Feedback */}
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>
                    🎤 Audio Feedback (Optional)
                  </label>
                  <div className={styles.audioSection}>
                    <div className={styles.audioControls}>
                      {!isRecording ? (
                        <button
                          type="button"
                          onClick={startRecording}
                          className={styles.recordBtn}
                        >
                          🎤 Record Audio Feedback
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={stopRecording}
                          className={styles.stopBtn}
                        >
                          ⏹️ Stop Recording
                        </button>
                      )}
                    </div>

                    {finalAudioBlob && (
                      <div className={styles.audioPreview}>
                        <audio controls className={styles.audioPlayer}>
                          <source
                            src={URL.createObjectURL(finalAudioBlob)}
                            type="audio/webm"
                          />
                        </audio>
                      </div>
                    )}
                  </div>
                </div>

                {/* Image Upload */}
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>
                    📸 Upload Images (Optional - Max 4)
                  </label>
                  <div className={styles.imageUploadSection}>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleImageUpload}
                      className={styles.fileInput}
                      id="feedback-images"
                    />
                    <label
                      htmlFor="feedback-images"
                      className={styles.uploadButton}
                    >
                      📁 Choose Images
                    </label>
                    {errors.images && (
                      <span className={styles.error}>{errors.images}</span>
                    )}
                  </div>

                  {formData.images.length > 0 && (
                    <div className={styles.imagePreview}>
                      {formData.images.map((file, index) => (
                        <div key={index} className={styles.imageItem}>
                          <img
                            src={
                              URL.createObjectURL(file) || "/placeholder.svg"
                            }
                            alt={`Feedback ${index + 1}`}
                            className={styles.previewImage}
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className={styles.removeImageBtn}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.formActions}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setStep("initial");
                  }}
                  className={styles.backBtn}
                >
                  ← Back
                </button>
                <button onClick={proceedToReview} className={styles.submitBtn}>
                  Continue to Review →
                </button>
              </div>
            </div>
          )}

          {step === "review" && (
            <div className={styles.reviewForm}>
              <div className={styles.reviewHeader}>
                <h3 className={styles.reviewTitle}>Rate Your Experience</h3>
                <p className={styles.reviewSubtitle}>
                  Your rating helps other users make informed decisions
                </p>
              </div>

              <div className={styles.formBody}>
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
                      setFormData((prev) => ({
                        ...prev,
                        review: e.target.value,
                      }))
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
                        setFormData((prev) => ({
                          ...prev,
                          wouldRecommend: true,
                        }))
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
                        setFormData((prev) => ({
                          ...prev,
                          wouldRecommend: false,
                        }))
                      }
                    >
                      👎 No, I wouldn't recommend
                    </button>
                  </div>
                  {errors.wouldRecommend && (
                    <span className={styles.error}>
                      {errors.wouldRecommend}
                    </span>
                  )}
                </div>
              </div>

              <div className={styles.formActions}>
                <button
                  type="button"
                  onClick={() => setStep("feedback")}
                  className={styles.backBtn}
                >
                  ← Back
                </button>
                <button
                  onClick={handleFinalSubmit}
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
          )}

          {step === "success" && (
            <div className={styles.successMessage}>
              <div className={styles.successIcon}>✅</div>
              <h3 className={styles.successTitle}>
                Thank You for Your Feedback
              </h3>
              <p className={styles.successText}>
                {formData.satisfied
                  ? "We're glad you had a positive experience!"
                  : "Sorry for the inconvenience. Actions will be taken soon."}
              </p>
              <div className={styles.autoCloseNote}>
                <p>This window will close automatically in 3 seconds...</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Review Modal for Satisfied Clients */}
      <ClientReviewModal
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        order={order}
        onReviewSubmitted={handleReviewSubmitted}
      />
    </>
  );
}
