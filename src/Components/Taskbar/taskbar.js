"use client";

import { useState } from "react";
import styles from "./taskbar.module.css";
import RequestsModal from "@/Components/For Home/RequestsModal/requestsModal";
// import { useUserData } from "@/Context/context";
import OffersModal from "../For Home/OffersModal/offersModal";
import Link from "next/link";

export default function Taskbar({ userData }) {
  const [activeTab, setActiveTab] = useState("home");
  const [isRequestsModalOpen, setIsRequestsModalOpen] = useState(false);
  const [isOffersModalOpen, setIsOffersModalOpen] = useState(false);
  // const { initialUserData } = useUserData() || {};
  const handleRequestsClick = () => {
    setActiveTab("requests");
    setIsRequestsModalOpen(true);
  };
  const handleOffersClick = () => {
    setActiveTab("offers");
    setIsOffersModalOpen(true);
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
            </button>
            <button
              className={`${styles.taskbarBtn} ${
                activeTab === "offers" ? styles.taskbarBtnActive : ""
              }`}
              onClick={handleOffersClick}
            >
              Offers
              <div className={styles.notificationDot}></div>
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
