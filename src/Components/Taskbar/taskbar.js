"use client";

import { useState } from "react";
import styles from "./taskbar.module.css";
import RequestsModal from "@/Components/For Home/RequestsModal/requestsModal";
import OffersModal from "../For Home/OffersModal/offersModal";
import Link from "next/link";
import { useNotifications } from "@/hooks/useNotifications";

export default function Taskbar({ userData }) {
  const [activeTab, setActiveTab] = useState("home");
  const [isRequestsModalOpen, setIsRequestsModalOpen] = useState(false);
  const [isOffersModalOpen, setIsOffersModalOpen] = useState(false);

  // Notification system
  const {
    requestsCount,
    offersCount,
    showRequestsBadge,
    showOffersBadge,
    markRequestsAsSeen,
    markOffersAsSeen,
  } = useNotifications(userData?.username, userData?.currentCity);

  const handleRequestsClick = () => {
    setActiveTab("requests");
    setIsRequestsModalOpen(true);
    markRequestsAsSeen(); // Clear notifications when opening requests modal
  };

  const handleOffersClick = () => {
    setActiveTab("offers");
    setIsOffersModalOpen(true);
    markOffersAsSeen(); // Clear notifications when opening offers modal
  };

  const handleCloseRequestsModal = () => {
    setIsRequestsModalOpen(false);
  };

  const handleCloseOffersModal = () => {
    setIsOffersModalOpen(false);
  };
  return (
    <>
      <div className={styles.floatingTaskbar}>
        <div className={styles.taskbarCard}>
          <div className={styles.taskbarNav}>
            <Link href="/">
              <button
                className={`${styles.taskbarBtn} ${
                  activeTab === "home" ? styles.taskbarBtnActive : ""
                }`}
                onClick={() => setActiveTab("home")}
              >
                Home
              </button>
            </Link>
            <Link href={`/${userData?.username}`}>
              <button
                className={`${styles.taskbarBtn} ${
                  activeTab === "profile" ? styles.taskbarBtnActive : ""
                }`}
                onClick={() => setActiveTab("profile")}
              >
                Profile
              </button>
            </Link>
            <button
              className={`${styles.taskbarBtn} ${
                activeTab === "requests" ? styles.taskbarBtnActive : ""
              }`}
              onClick={handleRequestsClick}
            >
              Requests
              {showRequestsBadge && (
                <div className={styles.notificationBadge}>
                  {requestsCount > 99 ? "99+" : requestsCount}
                </div>
              )}
            </button>
            <button
              className={`${styles.taskbarBtn} ${
                activeTab === "offers" ? styles.taskbarBtnActive : ""
              }`}
              onClick={handleOffersClick}
            >
              Offers
              {showOffersBadge && (
                <div className={styles.notificationBadge}>
                  {offersCount > 99 ? "99+" : offersCount}
                </div>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Requests Modal */}
      <RequestsModal
        isOpen={isRequestsModalOpen}
        onClose={handleCloseRequestsModal}
        // requests={requestsData}
        city={userData?.currentCity}
      />
      <OffersModal
        isOpen={isOffersModalOpen}
        onClose={handleCloseOffersModal}
      />
    </>
  );
}
