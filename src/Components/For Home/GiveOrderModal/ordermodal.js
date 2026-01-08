"use client";

import { useState, useRef, useEffect } from "react";
import { validateOrderForm } from "@/Zod/Orders/schema";
import { createOrder } from "@/Actions/Orders/orders";
import styles from "./ordermodal.module.css";
import AudioRecorder from "@/Utils/Audio/AudioRecorder";
import { v4 as uuidv4 } from "uuid";
import {
  checkFreelancerOnline,
  sendOrderRealtime,
} from "@/Actions/Orders/orderSocketClient";

export default function OrderModal({
  isOpen,
  onClose,
  freelancer,
  clientUsername,
  clientProfilePicture,
}) {
  const { startRecording, stopRecording, isRecording, finalAudioBlob } =
    AudioRecorder();
  const [orderMode, setOrderMode] = useState(null);
  const [currentOrderId, setCurrentOrderId] = useState(null);
  const [formData, setFormData] = useState({
    budget: "",
    currency: "",
    problemStatement: "",
    expertiseRequired: [],
    city: "",
    deadline: "",
    address: "",
    phoneNumber: "",
    images: [],
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const fileInputRef = useRef(null);
  const audioRef = useRef(null);

  const expertiseOptions = [
    "Plumbing",
    "Electrical Work",
    "Carpentry",
    "Painting",
    "HVAC Repair",
    "Appliance Repair",
    "Cleaning Services",
    "Gardening",
    "Pest Control",
    "General Handyman",
  ];

  const currencies = [
    { code: "USD", name: "USD - US Dollar" },
    { code: "EUR", name: "EUR - Euro" },
    { code: "GBP", name: "GBP - British Pound" },
    { code: "PKR", name: "PKR - Pakistani Rupee" },
  ];

  // ===== ALL REAL-TIME EVENT LISTENERS CENTRALIZED IN ordersSidebar.js =====
  // No listeners here - ordersSidebar.js handles all real-time events

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleExpertiseChange = (expertise, checked) => {
    setFormData((prev) => {
      const newExpertise = checked
        ? [...prev.expertiseRequired, expertise]
        : prev.expertiseRequired.filter((item) => item !== expertise);
      return { ...prev, expertiseRequired: newExpertise };
    });
    if (errors.expertiseRequired) {
      setErrors((prev) => ({ ...prev, expertiseRequired: null }));
    }
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    const currentImages = formData.images.length;
    const remainingSlots = 4 - currentImages;

    if (files.length > remainingSlots) {
      setErrors((prev) => ({
        ...prev,
        images: `You can only add ${remainingSlots} more image(s)`,
      }));
      return;
    }

    const validFiles = files.filter((file) => {
      const isValidType = file.type.startsWith("image/");
      const isValidSize = file.size <= 5 * 1024 * 1024;
      return isValidType && isValidSize;
    });

    if (validFiles.length !== files.length) {
      setErrors((prev) => ({
        ...prev,
        images: "Some files were invalid. Only images under 5MB are allowed.",
      }));
    }

    const newImages = validFiles.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      id: Date.now() + Math.random(),
    }));

    setFormData((prev) => ({
      ...prev,
      images: [...prev.images, ...newImages],
    }));

    if (errors.images) {
      setErrors((prev) => ({ ...prev, images: null }));
    }
  };

  const removeImage = (imageId) => {
    setFormData((prev) => {
      const updatedImages = prev.images.filter((img) => img.id !== imageId);
      const imageToRemove = prev.images.find((img) => img.id === imageId);
      if (imageToRemove) {
        URL.revokeObjectURL(imageToRemove.preview);
      }
      return { ...prev, images: updatedImages };
    });
  };

  const playAudio = () => {
    if (finalAudioBlob && audioRef.current) {
      if (isPlayingAudio) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsPlayingAudio(false);
      } else {
        const audioUrl = URL.createObjectURL(finalAudioBlob);
        audioRef.current.src = audioUrl;
        audioRef.current.play();
        setIsPlayingAudio(true);

        audioRef.current.onended = () => {
          setIsPlayingAudio(false);
          URL.revokeObjectURL(audioUrl);
        };
      }
    }
  };

  // ===== SAVE TO DATABASE FUNCTION =====
  const saveToDatabase = async () => {
    try {
      const submissionData = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        if (key === "expertiseRequired") {
          submissionData.append("expertiseRequired", JSON.stringify(value));
        } else if (key === "images") {
          return;
        } else {
          submissionData.append(key, value);
        }
      });

      if (finalAudioBlob) {
        submissionData.append("audio", finalAudioBlob, "recording.webm");
      }

      formData.images.forEach((img, index) => {
        submissionData.append(`image_${index}`, img.file, img.file.name);
      });

      const res = await createOrder(
        submissionData,
        clientUsername,
        freelancer.username
      );

      if (res?.success) {
        return true;
      } else {
        throw new Error(res?.error || "Failed to submit order");
      }
    } catch (error) {
      console.error("Database save error:", error);
      throw error;
    }
  };


  // ===== MAIN SUBMIT HANDLER =====
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    const validation = validateOrderForm(formData);
    if (!validation.success) {
      setErrors(validation.errors);
      setIsSubmitting(false);
      return;
    }

    try {
      const orderId = uuidv4();
      setCurrentOrderId(orderId);

      const orderData = {
        orderId,
        budget: parseFloat(formData.budget),
        currency: formData.currency,
        problemStatement: formData.problemStatement,
        expertiseRequired: formData.expertiseRequired,
        city: formData.city,
        deadline: formData.deadline,
        address: formData.address,
        phoneNumber: formData.phoneNumber,
        images: formData.images?.map((img) => img.file.name) || [],
        audioId: finalAudioBlob ? `audio-${orderId}` : null,
        clientProfilePicture: clientProfilePicture || null,
        freelancerProfilePicture: freelancer?.profilePicture || null,
      };

      console.log(`🔍 Checking if ${freelancer.username} is online...`);
      const isOnline = await checkFreelancerOnline(freelancer.username);

      if (isOnline) {
        // ===== FREELANCER ONLINE - USE SOCKETS =====
        console.log(`✅ ${freelancer.username} is ONLINE! Using real-time...`);
        setOrderMode("realtime");

        try {
          const response = await sendOrderRealtime(
            freelancer.username,
            orderData
          );

          if (response.success && response.isOnline) {
            console.log(`✅ Order sent to ${freelancer.username} in real-time`);
            resetAndClose();
          } else {
            console.log(
              "❌ Freelancer went offline, using database fallback..."
            );
            await saveToDatabase();
            resetAndClose();
          }
        } catch (socketError) {
          console.error("Socket error:", socketError);
          console.log("Using database fallback due to socket error");
          await saveToDatabase();
          resetAndClose();
        }
      } else {
        // ===== FREELANCER OFFLINE - USE DATABASE =====
        console.log(
          `🔴 ${freelancer.username} is OFFLINE. Saving to database...`
        );
        setOrderMode("database");
        await saveToDatabase();
        resetAndClose();
      }
    } catch (error) {
      console.error("Order submission error:", error);
      setErrors({ general: error.message || "Failed to send order." });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ===== RESET AND CLOSE =====
  const resetAndClose = () => {
    resetForm();
    onClose();
  };

  const resetForm = () => {
    formData.images.forEach((img) => URL.revokeObjectURL(img.preview));
    setFormData({
      budget: "",
      currency: "",
      problemStatement: "",
      expertiseRequired: [],
      city: "",
      deadline: "",
      address: "",
      phoneNumber: "",
      images: [],
    });
    setOrderMode(null);
    setCurrentOrderId(null);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className={styles.modalOverlay} onClick={resetAndClose}>
        <div
          className={styles.modalContent}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.modalHeader}>
            <h2 className={styles.modalTitle}>
              Give Order to {freelancer?.username || "Freelancer"}
            </h2>
            <button className={styles.closeBtn} onClick={resetAndClose}>
              ×
            </button>
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            {errors.general && (
              <div className={styles.errorMessage}>{errors.general}</div>
            )}

            {/* Budget and Currency */}
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Budget *</label>
                <input
                  type="number"
                  name="budget"
                  value={formData.budget}
                  onChange={handleInputChange}
                  className={`${styles.formInput} ${
                    errors.budget ? styles.inputError : ""
                  }`}
                  placeholder="Enter your budget"
                  min="0"
                  step="0.01"
                />
                {errors.budget && (
                  <span className={styles.errorText}>{errors.budget}</span>
                )}
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Currency *</label>
                <select
                  name="currency"
                  value={formData.currency}
                  onChange={handleInputChange}
                  className={`${styles.formSelect} ${
                    errors.currency ? styles.inputError : ""
                  }`}
                >
                  <option value="">Select currency</option>
                  {currencies.map((currency) => (
                    <option key={currency.code} value={currency.code}>
                      {currency.name}
                    </option>
                  ))}
                </select>
                {errors.currency && (
                  <span className={styles.errorText}>{errors.currency}</span>
                )}
              </div>
            </div>

            {/* Problem Statement */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Problem Statement</label>
              <textarea
                name="problemStatement"
                value={formData.problemStatement}
                onChange={handleInputChange}
                className={`${styles.formTextarea} ${
                  errors.problemStatement ? styles.inputError : ""
                }`}
                placeholder="Describe your project requirements in detail..."
              />
              {errors.problemStatement && (
                <span className={styles.errorText}>
                  {errors.problemStatement}
                </span>
              )}
            </div>

            {/* Image Upload Section */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>
                Project Images (Optional - Max 4)
              </label>

              <div className={styles.imageUploadSection}>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/*"
                  multiple
                  className={styles.hiddenInput}
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={styles.uploadButton}
                  disabled={formData.images.length >= 4}
                >
                  📷{" "}
                  {formData.images.length === 0
                    ? "Add Images"
                    : `Add More (${formData.images.length}/4)`}
                </button>

                {formData.images.length > 0 && (
                  <div className={styles.imagePreviewGrid}>
                    {formData.images.map((image) => (
                      <div key={image.id} className={styles.imagePreview}>
                        <img
                          src={image.preview}
                          alt="Preview"
                          className={styles.previewImage}
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(image.id)}
                          className={styles.removeImageBtn}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {errors.images && (
                <span className={styles.errorText}>{errors.images}</span>
              )}
            </div>

            {/* Audio Recording */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Voice Note (Optional)</label>
              <div className={styles.recordingContainer}>
                <div className={styles.recordingButtonsDiv}>
                  {isRecording ? (
                    <button
                      type="button"
                      className={`${styles.RecordingButtons} ${styles.recording}`}
                      onClick={(e) => {
                        e.preventDefault();
                        stopRecording();
                      }}
                    >
                      🎤 Stop Recording
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={styles.RecordingButtons}
                      onClick={(e) => {
                        e.preventDefault();
                        startRecording();
                      }}
                    >
                      🎤 {finalAudioBlob ? "Re-record" : "Start Recording"}
                    </button>
                  )}

                  {finalAudioBlob && !isRecording && (
                    <button
                      type="button"
                      className={styles.playButton}
                      onClick={playAudio}
                    >
                      {isPlayingAudio ? "⏸️ Pause" : "▶️ Play"}
                    </button>
                  )}
                </div>

                {isRecording && (
                  <div className={styles.recordingStatus}>Recording...</div>
                )}

                {finalAudioBlob && !isRecording && (
                  <div className={styles.recordingStatus}>
                    ✓ Voice note recorded
                  </div>
                )}
              </div>
              <audio ref={audioRef} style={{ display: "none" }} />
            </div>

            {/* Expertise */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Expertise Required *</label>
              <div className={styles.checkboxGrid}>
                {expertiseOptions.map((expertise) => (
                  <div key={expertise} className={styles.checkboxItem}>
                    <input
                      type="checkbox"
                      id={expertise}
                      className={styles.checkbox}
                      checked={formData.expertiseRequired.includes(expertise)}
                      onChange={(e) =>
                        handleExpertiseChange(expertise, e.target.checked)
                      }
                    />
                    <label htmlFor={expertise} className={styles.checkboxLabel}>
                      {expertise}
                    </label>
                  </div>
                ))}
              </div>
              {errors.expertiseRequired && (
                <span className={styles.errorText}>
                  {errors.expertiseRequired}
                </span>
              )}
            </div>

            {/* City + Deadline */}
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>City *</label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleInputChange}
                  className={`${styles.formInput} ${
                    errors.city ? styles.inputError : ""
                  }`}
                  placeholder="Enter city"
                />
                {errors.city && (
                  <span className={styles.errorText}>{errors.city}</span>
                )}
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Deadline *</label>
                <input
                  type="date"
                  name="deadline"
                  value={formData.deadline}
                  onChange={handleInputChange}
                  className={`${styles.formInput} ${
                    errors.deadline ? styles.inputError : ""
                  }`}
                  min={new Date().toISOString().split("T")[0]}
                />
                {errors.deadline && (
                  <span className={styles.errorText}>{errors.deadline}</span>
                )}
              </div>
            </div>

            {/* Address */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Address *</label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                className={`${styles.formInput} ${
                  errors.address ? styles.inputError : ""
                }`}
                placeholder="Enter your address"
              />
              {errors.address && (
                <span className={styles.errorText}>{errors.address}</span>
              )}
            </div>

            {/* Phone Number */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Phone Number *</label>
              <input
                type="tel"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleInputChange}
                className={`${styles.formInput} ${
                  errors.phoneNumber ? styles.inputError : ""
                }`}
                placeholder="Enter your phone number"
              />
              {errors.phoneNumber && (
                <span className={styles.errorText}>{errors.phoneNumber}</span>
              )}
            </div>

            {/* Actions */}
            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={resetAndClose}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={styles.btnPrimary}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Submitting..." : "Submit Order"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
