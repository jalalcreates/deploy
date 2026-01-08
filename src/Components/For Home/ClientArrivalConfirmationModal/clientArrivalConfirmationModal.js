"use client";

import { useState } from "react";
import styles from "./clientArrivalConfirmationModal.module.css";
import { getSocket } from "@/Socket_IO/socket";
import { confirmArrival } from "@/Actions/Orders/orders";

export default function ClientArrivalConfirmationModal({
  isOpen,
  onClose,
  order,
  onConfirmArrival,
  onRejectArrival,
}) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleConfirm = async (confirmed) => {
    try {
      const socket = getSocket();

      if (socket && socket.connected) {
        // ===== USE SOCKETS =====
        console.log(`✅ Confirming arrival via socket: ${confirmed}`);

        socket.emit("confirm-arrival-realtime", {
          orderId: order.orderId,
          confirmed,
          orderData: order, // Pass full order data for reconstruction
        });

        // Wait for confirmation
        await new Promise((resolve) => {
          const handler = (data) => {
            if (data.orderId === order.orderId) {
              socket.off("confirmation-sent", handler);
              resolve();
            }
          };
          socket.on("confirmation-sent", handler);

          setTimeout(() => {
            socket.off("confirmation-sent", handler);
            resolve();
          }, 5000);
        });

        console.log("✅ Arrival confirmation sent via socket");
      } else {
        // ===== USE DATABASE =====
        console.log(`✅ Confirming arrival via database: ${confirmed}`);

        const formData = new FormData();
        formData.append("orderId", order.orderId);
        formData.append("clientUsername", order.customerInfo?.username);
        formData.append("confirmed", confirmed.toString());

        await confirmArrival(formData);
      }

      onConfirmArrival(order.orderId);
      onClose();
    } catch (error) {
      console.error("Error confirming arrival:", error);
      alert("Failed to confirm arrival. Please try again.");
    }
  };

  const handleReject = async () => {
    setIsProcessing(true);
    try {
      await onRejectArrival(order.orderId);
      onClose();
    } catch (error) {
      console.error("Error rejecting arrival:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.arrivalIcon}>📍</div>
          <h2 className={styles.modalTitle}>Freelancer Has Arrived</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            ×
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.freelancerInfo}>
            <div className={styles.freelancerAvatar}>
              {order.freelancerInfo?.avatar ? (
                <img
                  src={order.freelancerInfo.avatar || "/placeholder.svg"}
                  alt={order.freelancerInfo.name}
                />
              ) : (
                <div className={styles.avatarFallback}>
                  {order.freelancerInfo?.name?.charAt(0) ||
                    order.user?.charAt(0) ||
                    "F"}
                </div>
              )}
            </div>
            <div className={styles.freelancerDetails}>
              <h3 className={styles.freelancerName}>
                {order.freelancerInfo?.name || order.user || "Freelancer"}
              </h3>
              <p className={styles.serviceType}>{order.service}</p>
            </div>
          </div>

          <div className={styles.arrivalMessage}>
            <p className={styles.messageText}>
              <strong>{order.freelancerInfo?.name || "The freelancer"}</strong>{" "}
              claims to have arrived at your service location.
            </p>
            <div className={styles.locationInfo}>
              <span className={styles.locationIcon}>📍</span>
              <span className={styles.locationText}>{order.address}</span>
            </div>
          </div>

          <div className={styles.confirmationNote}>
            <div className={styles.noteIcon}>💡</div>
            <p className={styles.noteText}>
              Please confirm if the freelancer has actually arrived at your
              location. This will help maintain service quality and accuracy.
            </p>
          </div>
        </div>

        <div className={styles.modalActions}>
          <button
            className={styles.rejectBtn}
            onClick={handleReject}
            disabled={isProcessing}
          >
            {isProcessing ? "Processing..." : "❌ Not Here Yet"}
          </button>
          <button
            className={styles.confirmBtn}
            onClick={() => handleConfirm(true)}
            disabled={isProcessing}
          >
            {isProcessing ? "Processing..." : "✅ Confirm Arrival"}
          </button>
        </div>

        <div className={styles.modalFooter}>
          <p className={styles.footerText}>
            Arrived at {new Date().toLocaleTimeString()}
          </p>
        </div>
      </div>
    </div>
  );
}
