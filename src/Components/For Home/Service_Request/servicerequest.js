"use client";

import { useState, useRef } from "react";
import styles from "./servicerequest.module.css";
import { useUserData } from "@/Context/context";
import AudioRecorder from "@/Utils/Audio/AudioRecorder";
import { serviceRequestFormSchema } from "@/Zod/ServiceRequest/schema";
import axios from "axios";
import { socket } from "@/Socket_IO/socket";

export default function ServiceRequest({ closeForm }) {
  const { initialUserData } = useUserData();
  const [errors, setErrors] = useState({});
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const fileInputRef = useRef(null);
  const audioRef = useRef(null);

  const { startRecording, stopRecording, isRecording, finalAudioBlob } =
    AudioRecorder();

  const [formData, setFormData] = useState({
    willingPrice: "",
    currency: "",
    problemDescription: "",
    expertiseRequired: [],
    city: "",
    address: "",
    deadline: "",
    images: [],
    phoneNumber: "",
  });

  const handleExpertiseChange = (expertise, checked) => {
    setFormData((prev) => ({
      ...prev,
      expertiseRequired: checked
        ? [...prev.expertiseRequired, expertise]
        : prev.expertiseRequired.filter((item) => item !== expertise),
    }));
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

  async function handleSubmit(e) {
    e.preventDefault();
    setErrors({});

    const result = serviceRequestFormSchema.safeParse(formData);

    if (!result.success) {
      const errorMap = {};
      result.error.errors.forEach((err) => {
        errorMap[err.path[0]] = err.message;
      });
      setErrors(errorMap);
      console.warn("Zod validation failed:", result.error.format());
      return;
    }

    const finalForm = new FormData();
    finalForm.append(
      "customerInfo",
      JSON.stringify({
        username: initialUserData?.username,
        profilePicture: initialUserData?.profilePicture,
      })
    );
    finalForm.append("willingPrice", formData.willingPrice);
    finalForm.append("currency", formData.currency);
    finalForm.append("problemDescription", formData.problemDescription);
    finalForm.append(
      "expertiseRequired",
      JSON.stringify(formData.expertiseRequired)
    );
    finalForm.append("city", formData.city);
    finalForm.append("address", formData.address);
    finalForm.append("deadline", formData.deadline);
    finalForm.append("phoneNumber", formData.phoneNumber);

    if (finalAudioBlob) {
      finalForm.append("audio", finalAudioBlob, "recording.webm");
    }

    // Add images
    formData.images.forEach((img, index) => {
      finalForm.append(`image_${index}`, img.file, img.file.name);
    });

    try {
      const response = await axios.post(
        "/api/post-service-request",
        finalForm,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      console.log(response.data);
      //socket io goes here for notifications to freelancers in the city.

      // Reset form on success
      setFormData({
        willingPrice: "",
        currency: "",
        problemDescription: "",
        expertiseRequired: [],
        city: "",
        address: "",
        deadline: "",
        images: [],
        phoneNumber: "",
      });

      // Clean up image URLs
      formData.images.forEach((img) => {
        URL.revokeObjectURL(img.preview);
      });
    } catch (error) {
      if (error.response) {
        return error.response.data;
      }
      console.error("Unexpected error:", error);
      return { success: false, error: "Unexpected error occurred" };
    }
    closeForm();
  }

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
    { code: "USD", symbol: "$", name: "US Dollar" },
    { code: "EUR", symbol: "€", name: "Euro" },
    { code: "GBP", symbol: "£", name: "British Pound" },
    { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
    { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  ];

  return (
    <>
      <div className={styles.formCard}>
        <div className={styles.cardHeader}>
          <div className={styles.headerTitle}>
            <h1>Service Request Form</h1>
          </div>
          <p className={styles.headerDescription}>
            Tell us about your project requirements and we'll connect you with
            the right experts.
          </p>
        </div>

        <div className={styles.cardContent}>
          <form onSubmit={handleSubmit} className={styles.form}>
            {/* Budget and Currency */}
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label htmlFor="willingPrice" className={styles.formLabel}>
                  Budget
                </label>
                <input
                  type="number"
                  id="willingPrice"
                  name="willingPrice"
                  value={formData.willingPrice}
                  placeholder="Enter your budget"
                  min="0"
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      willingPrice: e.target.value,
                    }))
                  }
                  className={styles.formInput}
                />
                {errors.willingPrice && (
                  <p className={styles.errorMessage}>{errors.willingPrice}</p>
                )}
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="currency" className={styles.formLabel}>
                  Currency
                </label>
                <select
                  id="currency"
                  name="currency"
                  value={formData.currency}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      currency: e.target.value,
                    }))
                  }
                  className={styles.formSelect}
                >
                  <option value="">Select currency</option>
                  {currencies.map((cur) => (
                    <option key={cur.code} value={cur.code}>
                      {cur.symbol} {cur.name}
                    </option>
                  ))}
                </select>
                {errors.currency && (
                  <p className={styles.errorMessage}>{errors.currency}</p>
                )}
              </div>
            </div>

            {/* Problem Description */}
            <div className={styles.formGroup}>
              <label htmlFor="problemDescription" className={styles.formLabel}>
                Problem Statement
              </label>
              <textarea
                id="problemDescription"
                name="problemDescription"
                value={formData.problemDescription}
                placeholder="Describe your project requirements in detail..."
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    problemDescription: e.target.value,
                  }))
                }
                className={styles.formTextarea}
              />
              {errors.problemDescription && (
                <p className={styles.errorMessage}>
                  {errors.problemDescription}
                </p>
              )}
            </div>

            {/* Image Upload Section */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>
                Project Images (Optional - Max 4)
                <span className={styles.labelHelper}>
                  Help freelancers understand your requirements better
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
                <p className={styles.errorMessage}>{errors.images}</p>
              )}
            </div>

            {/* Audio Recorder */}
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
                  <div
                    className={`${styles.recordingStatus} ${styles.recorded}`}
                  >
                    <span>✓ Voice note recorded</span>
                  </div>
                )}
              </div>
              <audio ref={audioRef} style={{ display: "none" }} />
            </div>

            {/* Expertise Required */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Expertise Required</label>
              <div className={styles.checkboxGrid}>
                {expertiseOptions.map((expertise) => (
                  <div key={expertise} className={styles.checkboxItem}>
                    <input
                      type="checkbox"
                      id={expertise}
                      name="expertiseRequired"
                      checked={formData.expertiseRequired.includes(expertise)}
                      onChange={(e) =>
                        handleExpertiseChange(expertise, e.target.checked)
                      }
                      className={styles.formCheckbox}
                    />
                    <label htmlFor={expertise} className={styles.checkboxLabel}>
                      {expertise}
                    </label>
                  </div>
                ))}
              </div>
              {errors.expertiseRequired && (
                <p className={styles.errorMessage}>
                  {errors.expertiseRequired}
                </p>
              )}
            </div>

            {/* City and Deadline */}
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label htmlFor="city" className={styles.formLabel}>
                  City
                </label>
                <input
                  type="text"
                  id="city"
                  name="city"
                  value={formData.city}
                  placeholder="Enter city"
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      city: e.target.value,
                    }))
                  }
                  className={styles.formInput}
                />
                {errors.city && (
                  <p className={styles.errorMessage}>{errors.city}</p>
                )}
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="deadline" className={styles.formLabel}>
                  Deadline
                </label>
                <input
                  type="date"
                  id="deadline"
                  name="deadline"
                  value={formData.deadline}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      deadline: e.target.value,
                    }))
                  }
                  className={styles.formInput}
                />
                {errors.deadline && (
                  <p className={styles.errorMessage}>{errors.deadline}</p>
                )}
              </div>
            </div>

            {/* Address */}
            <div className={styles.formGroup}>
              <label htmlFor="address" className={styles.formLabel}>
                Address
              </label>
              <input
                type="text"
                id="address"
                name="address"
                value={formData.address}
                placeholder="Enter your address"
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    address: e.target.value,
                  }))
                }
                className={styles.formInput}
              />
              {errors.address && (
                <p className={styles.errorMessage}>{errors.address}</p>
              )}
            </div>

            {/* Phone Number */}
            {/* Phone Number */}
            <div className={styles.formGroup}>
              <label htmlFor="phoneNumber" className={styles.formLabel}>
                Phone Number
              </label>
              <input
                type="tel"
                id="phoneNumber"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    phoneNumber: e.target.value,
                  }))
                }
                className={styles.formInput}
                placeholder="Enter your phone number"
              />
              {errors.phoneNumber && (
                <p className={styles.errorMessage}>{errors.phoneNumber}</p>
              )}
            </div>

            {/* Submit */}
            <button type="submit" className={styles.submitButton}>
              Submit
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
