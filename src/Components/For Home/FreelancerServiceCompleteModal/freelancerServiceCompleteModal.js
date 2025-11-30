"use client";

import { useState } from "react";
import { serviceCompletionSchema } from "@/Zod/PopUp Modals/schema";
import AudioRecorder from "@/Utils/Audio/AudioRecorder";
import styles from "./freelancerServiceCompleteModal.module.css";
import axios from "axios";

export default function FreelancerServiceModal({
  isOpen,
  onClose,
  order,
  refreshOrders,
  onOrderCancelled,
  freelancerUsername,
}) {
  const [showCompletionForm, setShowCompletionForm] = useState(false);
  const [formData, setFormData] = useState({
    proofImages: [],
    notes: "",
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Audio recorder hook
  const { startRecording, stopRecording, isRecording, finalAudioBlob } =
    AudioRecorder();

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length + formData.proofImages.length > 4) {
      setErrors((prev) => ({ ...prev, images: "Maximum 4 images allowed" }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      proofImages: [...prev.proofImages, ...files],
    }));
    setErrors((prev) => ({ ...prev, images: null }));
  };

  const removeImage = (index) => {
    setFormData((prev) => ({
      ...prev,
      proofImages: prev.proofImages.filter((_, i) => i !== index),
    }));
  };

  const handleServiceCompleted = () => {
    setShowCompletionForm(true);
  };

  const handleCancelMidway = () => {
    onOrderCancelled(order.id || order._id);
    onClose();
  };

  // try {
  // const validationData = {
  //   orderId: order.id || order._id,
  //   serviceCompleted: true,
  //   proofImages: formData.proofImages,
  //   audioRecording: finalAudioBlob,
  //   notes: formData.notes,
  // };

  // const validatedData = serviceCompletionSchema.parse(validationData);

  //   await onServiceCompleted(validatedData);
  //   onClose();
  // } catch (error) {
  //   if (error.errors) {
  //     const newErrors = {};
  //     error.errors.forEach((err) => {
  //       newErrors[err.path[0]] = err.message;
  //     });
  //     setErrors(newErrors);
  //   }
  // } finally {
  //   setIsSubmitting(false);
  // }
  const handleSubmitCompletion = async (e) => {
    e.preventDefault();
    setErrors({});
    setIsSubmitting(true);

    // Validate required fields
    if (formData.proofImages.length === 0) {
      setErrors({ images: "At least one proof image is required" });
      setIsSubmitting(false);
      return;
    }

    const clientUsername = order.customerInfo?.username;

    if (!freelancerUsername || !clientUsername) {
      setErrors({ submit: "Missing user information. Please try again." });
      setIsSubmitting(false);
      return;
    }

    try {
      const submitFormData = new FormData();

      // Append basic data
      submitFormData.append("orderId", order.orderId);
      submitFormData.append("freelancerUsername", freelancerUsername);
      submitFormData.append("clientUsername", clientUsername);
      submitFormData.append("notes", formData.notes || "");

      // Append proof images
      formData.proofImages.forEach((image, index) => {
        submitFormData.append("proofImages", image);
      });

      // Append audio recording if exists
      if (finalAudioBlob) {
        submitFormData.append("audioRecording", finalAudioBlob);
      }
      const response = await axios.post(
        "/api/service-completed",
        submitFormData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          timeout: 60000, // 60 second timeout for file uploads
        }
      );

      const { data } = response;

      console.log("Service completion successful:", data.message);

      refreshOrders(data?.updatedOrders || []);

      onClose();
    } catch (error) {
      if (error.errors) {
        const newErrors = {};
        error.errors.forEach((err) => {
          newErrors[err.path[0]] = err.message;
        });
        setErrors(newErrors);
      }
      console.error("Service completion failed:", error);

      let errorMessage = "Failed to submit completion proof. Please try again.";

      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.code === "ECONNABORTED") {
        errorMessage =
          "Upload timeout. Please check your connection and try again.";
      } else if (!navigator.onLine) {
        errorMessage =
          "No internet connection. Please check your connection and try again.";
      }

      setErrors({ submit: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.serviceIcon}>🔧</div>
          <h2 className={styles.modalTitle}>Service Status</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            ×
          </button>
        </div>

        {!showCompletionForm ? (
          <div className={styles.modalBody}>
            <div className={styles.orderInfo}>
              <h3 className={styles.orderTitle}>{order.service}</h3>
              <p className={styles.clientName}>Client: {order.user}</p>
              <p className={styles.orderAddress}>📍 {order.address}</p>
            </div>

            <div className={styles.statusMessage}>
              <p className={styles.messageText}>
                You have arrived at the service location. What would you like to
                do?
              </p>
            </div>

            <div className={styles.actionButtons}>
              <button
                className={styles.completeBtn}
                onClick={handleServiceCompleted}
              >
                ✅ Service Completed
              </button>
              <button className={styles.cancelBtn} onClick={handleCancelMidway}>
                ❌ Cancel Midway
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmitCompletion}
            className={styles.completionForm}
          >
            <div className={styles.formHeader}>
              <h3 className={styles.formTitle}>Service Completion Proof</h3>
              <p className={styles.formSubtitle}>
                Please provide proof of completed service
              </p>
            </div>

            <div className={styles.formBody}>
              {/* Image Upload Section */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>
                  📸 Proof Images (Max 4){" "}
                  <span className={styles.required}>*</span>
                </label>
                <div className={styles.imageUploadSection}>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageUpload}
                    className={styles.fileInput}
                    id="proof-images"
                  />
                  <label htmlFor="proof-images" className={styles.uploadButton}>
                    📁 Choose Images
                  </label>
                  {errors.images && (
                    <span className={styles.error}>{errors.images}</span>
                  )}
                </div>

                {/* Image Previews */}
                {formData.proofImages.length > 0 && (
                  <div className={styles.imagePreview}>
                    {formData.proofImages.map((file, index) => (
                      <div key={index} className={styles.imageItem}>
                        <img
                          src={URL.createObjectURL(file) || "/placeholder.svg"}
                          alt={`Proof ${index + 1}`}
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

              {/* Audio Recording Section */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>
                  🎤 Audio Description (Optional)
                </label>
                <div className={styles.audioSection}>
                  <div className={styles.audioControls}>
                    {!isRecording ? (
                      <button
                        type="button"
                        onClick={startRecording}
                        className={styles.recordBtn}
                      >
                        🎤 Start Recording
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

              {/* Notes Section */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>
                  📝 Additional Notes (Optional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  placeholder="Any additional details about the service..."
                  className={styles.notesTextarea}
                  maxLength={500}
                />
                <span className={styles.charCount}>
                  {formData.notes.length}/500
                </span>
              </div>
            </div>

            <div className={styles.formActions}>
              <button
                type="button"
                onClick={() => setShowCompletionForm(false)}
                className={styles.backBtn}
              >
                ← Back
              </button>
              <button
                type="submit"
                disabled={isSubmitting || formData.proofImages.length === 0}
                className={styles.submitBtn}
              >
                {isSubmitting ? "Submitting..." : "✅ Submit Completion"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
