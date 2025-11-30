"use client";

import { useState, useRef } from "react";
import { validateOrderForm } from "@/Zod/Orders/schema";
import { createOrder } from "@/Actions/Orders/orders";
import styles from "./ordermodal.module.css";
import AudioRecorder from "@/Utils/Audio/AudioRecorder";

export default function OrderModal({
  isOpen,
  onClose,
  freelancer,
  clientUsername,
}) {
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

  const { startRecording, stopRecording, isRecording, finalAudioBlob } =
    AudioRecorder();

  const expertiseOptions = [
    "Web Development",
    "Mobile Development",
    "UI/UX Design",
    "Data Analysis",
    "Digital Marketing",
    "Content Writing",
    "Graphic Design",
    "SEO Optimization",
    "Database Management",
    "Cloud Services",
  ];

  const currencies = [
    "USD - US Dollar",
    "EUR - Euro",
    "GBP - British Pound",
    "CAD - Canadian Dollar",
    "AUD - Australian Dollar",
    "JPY - Japanese Yen",
  ];

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
      const isValidSize = file.size <= 5 * 1024 * 1024; // 5MB
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
      // Revoke object URL to prevent memory leaks
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
      const submissionData = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        if (key === "expertiseRequired") {
          submissionData.append("expertiseRequired", JSON.stringify(value));
        } else if (key === "images") {
          // Skip images here, we'll handle them separately
          return;
        } else {
          submissionData.append(key, value);
        }
      });

      if (finalAudioBlob) {
        submissionData.append("audio", finalAudioBlob, "recording.webm");
      }

      // Add images with original file names
      formData.images.forEach((img, index) => {
        submissionData.append(`image_${index}`, img.file, img.file.name);
      });
      // for(let pair of submissionData.entries()){
      //   console.log(pair[0]+ ', ' + pair[1]);
      // }
      const res = await createOrder(
        submissionData,
        clientUsername,
        freelancer.username
      );

      if (res?.success) {
        console.log(res);
        onClose();
        // Clean up image URLs
        formData.images.forEach((img) => {
          URL.revokeObjectURL(img.preview);
        });
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
      } else {
        setErrors({ general: res?.error || "Failed to submit order" });
      }
    } catch (err) {
      setErrors({ general: "Something went wrong. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            Give Order to {freelancer?.username || "Freelancer"}
          </h2>
          <button className={styles.closeBtn} onClick={onClose}>
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
                  <option key={currency} value={currency}>
                    {currency}
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
              <span className={styles.labelHelper}>
                Help freelancer understand your requirements better
              </span>
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
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="9" cy="9" r="2" />
                  <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                </svg>
                {formData.images.length === 0
                  ? "Add Images"
                  : `Add More (${formData.images.length}/4)`}
              </button>

              {formData.images.length > 0 && (
                <div className={styles.imagePreviewGrid}>
                  {formData.images.map((image) => (
                    <div key={image.id} className={styles.imagePreview}>
                      <img
                        src={image.preview || "/placeholder.svg"}
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
                    <div className={styles.recordingDot}></div>
                    Stop Recording
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
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                      <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                    {finalAudioBlob ? "Re-record" : "Start Recording"}
                  </button>
                )}

                {finalAudioBlob && !isRecording && (
                  <button
                    type="button"
                    className={styles.playButton}
                    onClick={playAudio}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      {isPlayingAudio ? (
                        <rect x="6" y="4" width="4" height="16" />
                      ) : (
                        <polygon points="5,3 19,12 5,21" />
                      )}
                      {isPlayingAudio && (
                        <rect x="14" y="4" width="4" height="16" />
                      )}
                    </svg>
                    {isPlayingAudio ? "Pause" : "Play"}
                  </button>
                )}
              </div>

              {isRecording && (
                <div
                  className={`${styles.recordingStatus} ${styles.recordingAnimation}`}
                >
                  <div className={styles.recordingDot}></div>
                  <span>Recording...</span>
                </div>
              )}

              {finalAudioBlob && !isRecording && (
                <div className={`${styles.recordingStatus} ${styles.recorded}`}>
                  <span>✓ Voice note recorded</span>
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
              onClick={onClose}
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
  );
}
