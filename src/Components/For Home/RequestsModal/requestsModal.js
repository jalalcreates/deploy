"use client";

import { useEffect, useState } from "react";
import styles from "./RequestsModal.module.css";
import AudioPlayer from "../AudioPlayer/audioPlayer";
import RequestDetailModal from "../RequestDetailModal/requestDetailModal";
import axios from "axios";
import {
  listenForNewServiceRequests,
  listenForServiceRequestFulfilled,
} from "@/Actions/ServiceRequests/serviceRequestSocketClient";

export default function RequestsModal({ isOpen, onClose, city }) {
  const [requests, setRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  useEffect(() => {
    if (isOpen && city) {
      // Fetch existing requests from database
      axios
        .post("/api/get-service-requests", { city })
        .then((res) => {
          if (res.data.success) {
            setRequests(res.data.requests);
          } else {
            console.error("Failed to load requests:", res.data.error);
          }
        })
        .catch((err) => {
          console.error("Error fetching service requests:", err);
        });

      // Listen for new service requests in real-time
      const unsubscribeNewRequests = listenForNewServiceRequests(
        (serviceRequest) => {
          console.log("📨 New service request received:", serviceRequest);

          // Only add if it's in the same city
          if (serviceRequest.city === city) {
            setRequests((prev) => {
              // Check if request already exists
              const exists = prev.some(
                (req) => req._id === serviceRequest._id || req.requestId === serviceRequest.requestId
              );
              if (exists) return prev;

              // Add to beginning of list (newest first)
              return [serviceRequest, ...prev];
            });
          }
        }
      );

      // Listen for service requests that got fulfilled
      const unsubscribeFulfilled = listenForServiceRequestFulfilled((data) => {
        console.log("📋 Service request fulfilled:", data);

        // Remove fulfilled request from list
        setRequests((prev) =>
          prev.filter((req) => req.requestId !== data.requestId)
        );
      });

      // Cleanup listeners on unmount
      return () => {
        unsubscribeNewRequests();
        unsubscribeFulfilled();
      };
    }
  }, [isOpen, city]);

  const handleViewRequest = (request) => {
    setSelectedRequest(request);
    setIsDetailModalOpen(true);
  };

  const handleCloseDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedRequest(null);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className={styles.modalOverlay} onClick={onClose}>
        <div
          className={styles.modalContent}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.modalHeader}>
            <h2 className={styles.modalTitle}>Requests in Your City</h2>
            <button className={styles.closeBtn} onClick={onClose}>
              ×
            </button>
          </div>

          <div className={styles.requestsList}>
            {requests && requests.length > 0 ? (
              requests.map((request) => (
                <div key={request._id} className={styles.requestRow}>
                  <div className={styles.requestHeader}>
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
                    <button
                      className={styles.viewBtn}
                      onClick={() => handleViewRequest(request)}
                    >
                      View
                    </button>
                  </div>

                  <div className={styles.requestContent}>
                    <p className={styles.problemLabel}>Problem Description:</p>
                    {request.problemDescription ? (
                      <p className={styles.problemStatement}>
                        {request.problemDescription.length > 150
                          ? `${request.problemDescription.substring(0, 150)}...`
                          : request.problemDescription}
                      </p>
                    ) : (
                      <p className={styles.noProblemStatement}>
                        No problem description
                      </p>
                    )}
                  </div>

                  {request.problemAudioId && (
                    <div className={styles.audioSection}>
                      <p className={styles.audioLabel}>Audio Recording:</p>
                      <div className={styles.audioPlayerWrapper}>
                        <AudioPlayer
                          audioData={{ audioId: request.problemAudioId }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className={styles.emptyState}>
                <div className={styles.emptyStateIcon}>📋</div>
                <p className={styles.emptyStateText}>No requests found</p>
                <p className={styles.emptyStateSubtext}>
                  There are currently no requests in your city.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <RequestDetailModal
        isOpen={isDetailModalOpen}
        onClose={handleCloseDetailModal}
        request={selectedRequest}
      />
    </>
  );
}
