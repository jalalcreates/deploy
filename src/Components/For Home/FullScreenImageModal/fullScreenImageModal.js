"use client";

import { useEffect } from "react";
import styles from "./fullScreenImageModal.module.css";

export default function FullScreenImageModal({ isOpen, onClose, image }) {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen || !image) return null;

  return (
    <div className={styles.fullScreenOverlay} onClick={onClose}>
      <div
        className={styles.fullScreenContent}
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={image.url || "/placeholder.svg"}
          alt={image.title || "Request image"}
          className={styles.fullScreenImage}
        />

        <button
          className={styles.closeButton}
          onClick={onClose}
          title="Close (Esc)"
        >
          ×
        </button>

        {(image.title || image.description) && (
          <div className={styles.imageInfo}>
            {image.title && (
              <div className={styles.imageTitle}>{image.title}</div>
            )}
            {image.description && (
              <div className={styles.imageDescription}>{image.description}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
