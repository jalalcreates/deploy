"use client";

import { useState } from "react";
import styles from "./requestDetailModal.module.css";
import AudioPlayer from "../AudioPlayer/audioPlayer";
import FullScreenImageModal from "../FullScreenImageModal/fullScreenImageModal";
import OfferServiceModal from "../OfferServiceModal/offerServiceModal";

export default function RequestDetailModal({ isOpen, onClose, request }) {
  const [selectedImage, setSelectedImage] = useState(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  console.log("Request in Modal:", request);
  const handleImageClick = (image) => {
    setSelectedImage(image);
    setIsImageModalOpen(true);
  };

  const handleCloseImageModal = () => {
    setIsImageModalOpen(false);
    setSelectedImage(null);
  };

  const handleOfferService = () => {
    setIsOfferModalOpen(true);
  };

  const handleCloseOfferModal = () => {
    setIsOfferModalOpen(false);
  };

  const handleOfferSubmit = (offerData) => {
    console.log("Offer submitted:", offerData);
  };

  if (!isOpen || !request) return null;

  return (
    <>
      <div className={styles.modalOverlay} onClick={onClose}>
        <div
          className={styles.modalContent}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.modalHeader}>
            <h2 className={styles.modalTitle}>Request Details</h2>
            <button className={styles.closeBtn} onClick={onClose}>
              ×
            </button>
          </div>

          <div className={styles.modalBody}>
            {/* User Section */}
            <div className={styles.userSection}>
              <div className={styles.userAvatar}>
                {request.customerInfo?.profilePicture ? (
                  <img
                    src={request.customerInfo.profilePicture}
                    alt={request.customerInfo.username}
                  />
                ) : (
                  <div className={styles.userAvatarFallback}>
                    {request.customerInfo?.username
                      ?.split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </div>
                )}
              </div>
              <div className={styles.userInfo}>
                <h3 className={styles.username}>
                  {request.customerInfo?.username}
                </h3>
                <p className={styles.userCity}>📍 {request.city}</p>
              </div>
            </div>

            {/* Problem Statement */}
            <div className={styles.detailSection}>
              <h4 className={styles.sectionTitle}>📝 Problem Description</h4>
              {request.problemDescription ? (
                <p className={styles.problemStatement}>
                  {request.problemDescription}
                </p>
              ) : (
                <p className={styles.noProblemStatement}>
                  No problem description provided
                </p>
              )}
            </div>

            {/* Pictures Section */}
            <div className={styles.detailSection}>
              <h4 className={styles.sectionTitle}>🖼️ Reference Pictures</h4>
              <div className={styles.picturesSection}>
                {request.serviceImages && request.serviceImages.length > 0 ? (
                  <div className={styles.picturesGrid}>
                    {request.serviceImages.map((imagePath, index) => (
                      <div
                        key={index}
                        className={styles.pictureItem}
                        onClick={() =>
                          handleImageClick({
                            url: `/images/service-requests/${imagePath}`,
                            title: `Reference image ${index + 1}`,
                            filename: imagePath,
                          })
                        }
                      >
                        <img
                          src={`images/service-requests/${imagePath}`}
                          alt={`Reference image ${index + 1}`}
                          className={styles.pictureImage}
                          onError={(e) => {
                            // Fallback if image fails to load
                            e.target.src = "/placeholder.svg";
                            e.target.alt = "Image not available";
                          }}
                        />
                        <div className={styles.pictureOverlay}>
                          <span className={styles.pictureOverlayIcon}>🔍</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={styles.noPicturesMessage}>
                    📷 No reference pictures provided
                  </div>
                )}
              </div>
            </div>

            {/* Expertise Required */}
            {request.expertiseRequired?.length > 0 && (
              <div className={styles.detailSection}>
                <h4 className={styles.sectionTitle}>🎯 Expertise Required</h4>
                <div className={styles.expertiseGrid}>
                  {request.expertiseRequired.map((expertise, index) => (
                    <span key={index} className={styles.expertiseBadge}>
                      {expertise}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Budget and Deadline */}
            <div className={styles.detailSection}>
              <h4 className={styles.sectionTitle}>💰 Budget & Timeline</h4>
              <div className={styles.budgetDeadlineRow}>
                <div className={styles.budgetSection}>
                  <div className={styles.budgetAmount}>
                    {request.willingPrice} {request.currency}
                  </div>
                  <div className={styles.budgetCurrency}>Budget</div>
                </div>
                <div className={styles.deadlineSection}>
                  <div className={styles.deadlineDate}>
                    {request.deadline
                      ? new Date(request.deadline).toLocaleDateString()
                      : "N/A"}
                  </div>
                  <div className={styles.deadlineLabel}>Deadline</div>
                </div>
              </div>
            </div>

            {/* Audio Section */}
            {request.problemAudioId && (
              <div className={styles.detailSection}>
                <h4 className={styles.sectionTitle}>🎵 Audio Recording</h4>
                <div className={styles.audioSection}>
                  <AudioPlayer
                    audioData={{ audioId: request.problemAudioId }}
                  />
                </div>
              </div>
            )}

            {/* Offer Service Button */}
            <div className={styles.detailSection}>
              <button
                className={styles.offerServiceBtn}
                onClick={handleOfferService}
              >
                💼 Offer Service
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Full Screen Image Modal */}
      <FullScreenImageModal
        isOpen={isImageModalOpen}
        onClose={handleCloseImageModal}
        image={selectedImage}
      />

      {/* Offer Service Modal */}
      <OfferServiceModal
        isOpen={isOfferModalOpen}
        onClose={handleCloseOfferModal}
        request={request}
        onSubmit={handleOfferSubmit}
      />
    </>
  );
}
