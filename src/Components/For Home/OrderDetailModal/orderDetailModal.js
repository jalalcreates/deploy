"use client";

import styles from "./orderDetailModal.module.css";

export default function OrderDetailModal({
  isOpen,
  onClose,
  order,
  onAcceptOrder,
  onGiveOffer,
}) {
  if (!isOpen || !order) return null;

  const isFreelancerView = order.type === "received";

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Order Details</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            ×
          </button>
        </div>

        <div className={styles.modalBody}>
          {/* User Section */}
          <div className={styles.userSection}>
            <div className={styles.userAvatar}>
              {(order?.type === "given" ? order?.freelancerInfo?.profilePicture : order?.customerInfo?.profilePicture) ? (
                <img
                  src={
                    order?.type === "given"
                      ? order?.freelancerInfo?.profilePicture
                      : order?.customerInfo?.profilePicture
                  }
                  alt={order.user}
                />
              ) : (
                <div className={styles.userAvatarFallback}>
                  {order?.type === "given"
                    ? (order?.freelancerInfo?.username || order?.user || "F")
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                    : (order?.customerInfo?.username || order?.user || "C")
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                </div>
              )}
            </div>
            <div>
              <h3 className={styles.username}>{order.user}</h3>
              <p className={styles.userCity}>
                📍 {order.city || "Location not specified"}
              </p>
            </div>
          </div>

          {/* Service Details */}
          {/* <div className={styles.detailSection}>
            <h4 className={styles.sectionTitle}>🛠️ Service Required</h4>
            <p className={styles.serviceDescription}>
              {order.expertiseRequired}
            </p>
          </div> */}

          {/* Problem Statement */}
          {order.problemStatement && (
            <div className={styles.detailSection}>
              <h4 className={styles.sectionTitle}>📝 Problem Description</h4>
              <p className={styles.problemStatement}>
                {order.problemDescription}
              </p>
            </div>
          )}

          {/* Budget and Timeline */}
          <div className={styles.detailSection}>
            <h4 className={styles.sectionTitle}>💰 Budget & Timeline</h4>
            <div className={styles.budgetDeadlineRow}>
              <div className={styles.budgetSection}>
                <div className={styles.budgetAmount}>
                  ${order.priceToBePaid}
                </div>
                <div className={styles.budgetLabel}>Budget</div>
              </div>
              {order.deadline && (
                <div className={styles.deadlineSection}>
                  <div className={styles.deadlineDate}>
                    {new Date(order.deadline).toLocaleDateString()}
                  </div>
                  <div className={styles.deadlineLabel}>Deadline</div>
                </div>
              )}
            </div>
          </div>

          {/* Address (for accepted orders) */}
          {order.status === "accepted" && order.address && (
            <div className={styles.detailSection}>
              <h4 className={styles.sectionTitle}>📍 Service Address</h4>
              <p className={styles.addressText}>{order.address}</p>
            </div>
          )}

          {/* Expertise Required */}
          {order.expertiseRequired && order.expertiseRequired.length > 0 && (
            <div className={styles.detailSection}>
              <h4 className={styles.sectionTitle}>🎯 Expertise Required</h4>
              <div className={styles.expertiseGrid}>
                {order.expertiseRequired.map((expertise, index) => (
                  <span key={index} className={styles.expertiseBadge}>
                    {expertise}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons for Freelancer */}
          {isFreelancerView &&
            order.status === "pending" &&
            !order.negotiation?.isNegotiating && (
              <div className={styles.actionButtons}>
                <button className={styles.acceptBtn} onClick={onAcceptOrder}>
                  ✅ Accept Order
                </button>
                <button className={styles.offerBtn} onClick={onGiveOffer}>
                  💰 Give Your Offer
                </button>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
