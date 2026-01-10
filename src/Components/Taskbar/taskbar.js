"use client";

import { useState } from "react";
import styles from "./taskbar.module.css";
import RequestsModal from "@/Components/For Home/RequestsModal/requestsModal";
import OffersModal from "../For Home/OffersModal/offersModal";
import Link from "next/link";
import { useNotifications } from "@/hooks/useNotifications";
import { HiHome, HiUser, HiClipboardDocumentList, HiBriefcase, HiBars3, HiXMark } from "react-icons/hi2";

export default function Taskbar({ userData }) {
  const [activeTab, setActiveTab] = useState("home");
  const [isRequestsModalOpen, setIsRequestsModalOpen] = useState(false);
  const [isOffersModalOpen, setIsOffersModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Notification system - MUST be called before any early returns
  const {
    requestsCount,
    offersCount,
    showRequestsBadge,
    showOffersBadge,
    markRequestsAsSeen,
    markOffersAsSeen,
  } = useNotifications(userData?.username, userData?.currentCity);

  // Don't render Taskbar if user is not authenticated
  if (!userData || !userData.username) {
    return null;
  }

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
      {/* Desktop Taskbar */}
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

      {/* Mobile Hamburger Menu */}
      <button
        className={styles.mobileMenuBtn}
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        aria-label="Toggle navigation menu"
      >
        {isMobileMenuOpen ? (
          <HiXMark className={styles.hamburgerIcon} />
        ) : (
          <HiBars3 className={styles.hamburgerIcon} />
        )}
        {(showRequestsBadge || showOffersBadge) && (
          <span className={styles.mobileNotificationDot} />
        )}
      </button>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className={styles.mobileMenuOverlay}
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Menu Panel */}
      <div
        className={`${styles.mobileMenuPanel} ${
          isMobileMenuOpen ? styles.mobileMenuOpen : ""
        }`}
      >
        <div className={styles.mobileMenuHeader}>
          <h3>Menu</h3>
          <button
            className={styles.mobileMenuClose}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <HiXMark />
          </button>
        </div>
        <nav className={styles.mobileMenuNav}>
          <Link href="/" onClick={() => setIsMobileMenuOpen(false)}>
            <div
              className={`${styles.mobileMenuItem} ${
                activeTab === "home" ? styles.mobileMenuItemActive : ""
              }`}
              onClick={() => setActiveTab("home")}
            >
              <HiHome className={styles.mobileMenuIcon} />
              <span>Home</span>
            </div>
          </Link>
          <Link
            href={`/${userData?.username}`}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <div
              className={`${styles.mobileMenuItem} ${
                activeTab === "profile" ? styles.mobileMenuItemActive : ""
              }`}
              onClick={() => setActiveTab("profile")}
            >
              <HiUser className={styles.mobileMenuIcon} />
              <span>Profile</span>
            </div>
          </Link>
          <div
            className={`${styles.mobileMenuItem} ${
              activeTab === "requests" ? styles.mobileMenuItemActive : ""
            }`}
            onClick={() => {
              handleRequestsClick();
              setIsMobileMenuOpen(false);
            }}
          >
            <HiClipboardDocumentList className={styles.mobileMenuIcon} />
            <span>Requests</span>
            {showRequestsBadge && (
              <span className={styles.mobileMenuBadge}>
                {requestsCount > 99 ? "99+" : requestsCount}
              </span>
            )}
          </div>
          <div
            className={`${styles.mobileMenuItem} ${
              activeTab === "offers" ? styles.mobileMenuItemActive : ""
            }`}
            onClick={() => {
              handleOffersClick();
              setIsMobileMenuOpen(false);
            }}
          >
            <HiBriefcase className={styles.mobileMenuIcon} />
            <span>Offers</span>
            {showOffersBadge && (
              <span className={styles.mobileMenuBadge}>
                {offersCount > 99 ? "99+" : offersCount}
              </span>
            )}
          </div>
        </nav>
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
