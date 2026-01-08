"use client";

import { useState, useEffect } from "react";
import { useUserData } from "@/Context/context";
import {
  getUserServiceRequests,
  updateOfferStatus,
} from "@/Actions/ServiceRequests/serviceRequests";
import {
  listenForNewOffers,
  acceptOfferRealtime,
  declineOfferRealtime,
} from "@/Actions/ServiceRequests/serviceRequestSocketClient";
import {
  createOrderFromAcceptedOffer,
  removeDeclinedOfferFromDatabase,
  deleteServiceRequestFromDatabase,
} from "@/Actions/ServiceRequests/serviceRequestFallbackHandler";
import styles from "./offersModal.module.css";
import AudioPlayer from "../AudioPlayer/audioPlayer";

export default function OffersModal({ isOpen, onClose }) {
  const { initialUserData } = useUserData() || {};
  const [currentRequestIndex, setCurrentRequestIndex] = useState(0);
  const [serviceRequests, setServiceRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch real data when modal opens
  useEffect(() => {
    if (isOpen && initialUserData?.username) {
      fetchServiceRequests();

      // Listen for new offers in real-time
      const unsubscribeOffers = listenForNewOffers((data) => {
        console.log("💼 New offer received:", data);

        // Update service requests to show the new offer
        setServiceRequests((prev) =>
          prev.map((request) =>
            request.requestId === data.requestId
              ? {
                  ...request,
                  offers: [...request.offers, data.offer],
                }
              : request
          )
        );
      });

      // Cleanup listener on unmount
      return () => {
        unsubscribeOffers();
      };
    }
  }, [isOpen, initialUserData?.username]);

  const fetchServiceRequests = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getUserServiceRequests(initialUserData.username);

      if (result.success) {
        setServiceRequests(result.serviceRequests);
        setCurrentRequestIndex(0); // Reset to first request
      } else {
        setError(result.error);
        setServiceRequests([]);
      }
    } catch (err) {
      console.error("Error fetching service requests:", err);
      setError("Failed to load service requests");
      setServiceRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptOffer = async (requestId, freelancerUsername) => {
    try {
      // Find the service request and accepted offer
      const serviceRequest = serviceRequests.find(
        (req) => req.requestId === requestId
      );
      if (!serviceRequest) {
        alert("Service request not found");
        return;
      }

      const acceptedOffer = serviceRequest.offers.find(
        (offer) => offer.freelancerInfo.username === freelancerUsername
      );
      if (!acceptedOffer) {
        alert("Offer not found");
        return;
      }

      // Prepare service request data for order creation
      const serviceRequestData = {
        requestId: serviceRequest.requestId,
        customerInfo: {
          username: initialUserData.username,
          profilePicture: initialUserData.profilePicture,
        },
        willingPrice: serviceRequest.willingPrice,
        currency: serviceRequest.currency,
        problemDescription: serviceRequest.problemDescription,
        problemAudioId: serviceRequest.problemAudioId,
        serviceImages: serviceRequest.serviceImages || [],
        phoneNumber: serviceRequest.phoneNumber,
        expertiseRequired: serviceRequest.expertiseRequired || [],
        city: serviceRequest.city,
        deadline: serviceRequest.deadline,
        address: serviceRequest.address,
        offers: serviceRequest.offers,
      };

      // Try real-time acceptance first
      try {
        const rtResponse = await acceptOfferRealtime(
          requestId,
          freelancerUsername,
          serviceRequestData,
          acceptedOffer
        );

        if (rtResponse.requiresDbFallback) {
          // Freelancer offline - save to database
          console.log("Freelancer offline, creating order in database");
          const dbResult = await createOrderFromAcceptedOffer(
            requestId,
            freelancerUsername,
            serviceRequestData,
            acceptedOffer
          );

          if (!dbResult.success) {
            throw new Error(dbResult.error);
          }
        } else {
          // Real-time success - also delete from database
          await deleteServiceRequestFromDatabase(requestId);
        }

        // Remove request from local state
        setServiceRequests((prev) =>
          prev.filter((req) => req.requestId !== requestId)
        );

        alert("Offer accepted! Order created successfully.");
      } catch (rtError) {
        console.error("Real-time acceptance failed:", rtError);
        // Fall back to database-only approach
        const dbResult = await createOrderFromAcceptedOffer(
          requestId,
          freelancerUsername,
          serviceRequestData,
          acceptedOffer
        );

        if (dbResult.success) {
          setServiceRequests((prev) =>
            prev.filter((req) => req.requestId !== requestId)
          );
          alert("Offer accepted! Order created successfully.");
        } else {
          throw new Error(dbResult.error);
        }
      }
    } catch (error) {
      console.error("Error accepting offer:", error);
      alert(error.message || "Failed to accept offer");
    }
  };

  const handleDeclineOffer = async (requestId, freelancerUsername) => {
    try {
      // Try real-time decline first
      try {
        const rtResponse = await declineOfferRealtime(
          requestId,
          freelancerUsername
        );

        if (rtResponse.requiresDbFallback) {
          // Freelancer offline - update database
          console.log("Freelancer offline, removing offer from database");
          const dbResult = await removeDeclinedOfferFromDatabase(
            requestId,
            freelancerUsername
          );

          if (!dbResult.success) {
            throw new Error(dbResult.error);
          }
        } else {
          // Real-time success - also update database
          await removeDeclinedOfferFromDatabase(requestId, freelancerUsername);
        }

        // Update local state
        setServiceRequests((prev) =>
          prev.map((request) =>
            request.requestId === requestId
              ? {
                  ...request,
                  offers: request.offers.filter(
                    (offer) =>
                      offer.freelancerInfo.username !== freelancerUsername
                  ),
                }
              : request
          )
        );
      } catch (rtError) {
        console.error("Real-time decline failed:", rtError);
        // Fall back to database-only approach
        const dbResult = await removeDeclinedOfferFromDatabase(
          requestId,
          freelancerUsername
        );

        if (dbResult.success) {
          setServiceRequests((prev) =>
            prev.map((request) =>
              request.requestId === requestId
                ? {
                    ...request,
                    offers: request.offers.filter(
                      (offer) =>
                        offer.freelancerInfo.username !== freelancerUsername
                    ),
                  }
                : request
            )
          );
        } else {
          throw new Error(dbResult.error);
        }
      }
    } catch (error) {
      console.error("Error declining offer:", error);
      alert(error.message || "Failed to decline offer");
    }
  };

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span
        key={i}
        className={
          i < Math.floor(rating) ? styles.starFilled : styles.starEmpty
        }
      >
        ★
      </span>
    ));
  };

  const nextRequest = () => {
    setCurrentRequestIndex((prev) => (prev + 1) % serviceRequests.length);
  };

  const prevRequest = () => {
    setCurrentRequestIndex(
      (prev) => (prev - 1 + serviceRequests.length) % serviceRequests.length
    );
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Your Service Request Offers</h2>
          <button className={styles.closeButton} onClick={onClose}>
            ×
          </button>
        </div>

        <div className={styles.modalBody}>
          {loading ? (
            <div className={styles.loadingState}>
              <div className={styles.spinner}></div>
              <p>Loading your service requests...</p>
            </div>
          ) : error ? (
            <div className={styles.errorState}>
              <div className={styles.errorIcon}>⚠️</div>
              <h3>Error Loading Requests</h3>
              <p>{error}</p>
              <button
                className={styles.retryButton}
                onClick={fetchServiceRequests}
              >
                Try Again
              </button>
            </div>
          ) : serviceRequests.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>📋</div>
              <h3>No Service Requests Yet</h3>
              <p>
                You haven't posted any service requests yet. Create your first
                request to start receiving offers from freelancers!
              </p>
            </div>
          ) : (
            <div className={styles.carouselContainer}>
              {/* Navigation */}
              {serviceRequests.length > 1 && (
                <div className={styles.carouselNav}>
                  <button
                    className={styles.navButton}
                    onClick={prevRequest}
                    disabled={serviceRequests.length <= 1}
                  >
                    ‹
                  </button>
                  <span className={styles.carouselIndicator}>
                    {currentRequestIndex + 1} of {serviceRequests.length}
                  </span>
                  <button
                    className={styles.navButton}
                    onClick={nextRequest}
                    disabled={serviceRequests.length <= 1}
                  >
                    ›
                  </button>
                </div>
              )}

              {/* Current Request */}
              {serviceRequests[currentRequestIndex] && (
                <div className={styles.requestCard}>
                  <div className={styles.requestHeader}>
                    <h3>
                      Service Request #
                      {serviceRequests[currentRequestIndex].requestId}
                    </h3>
                    <div className={styles.offerCount}>
                      {serviceRequests[currentRequestIndex].offers.length} Offer
                      {serviceRequests[currentRequestIndex].offers.length !== 1
                        ? "s"
                        : ""}
                    </div>
                  </div>

                  <div className={styles.requestDetails}>
                    <div className={styles.requestInfo}>
                      <p className={styles.problemDescription}>
                        {
                          serviceRequests[currentRequestIndex]
                            .problemDescription
                        }
                      </p>

                      <div className={styles.requestMeta}>
                        <div className={styles.metaItem}>
                          <strong>Budget:</strong>{" "}
                          {serviceRequests[currentRequestIndex].currency}{" "}
                          {serviceRequests[currentRequestIndex].willingPrice}
                        </div>
                        <div className={styles.metaItem}>
                          <strong>Deadline:</strong>{" "}
                          {serviceRequests[currentRequestIndex].deadline}
                        </div>
                        <div className={styles.metaItem}>
                          <strong>Location:</strong>{" "}
                          {serviceRequests[currentRequestIndex].city}
                        </div>
                      </div>

                      {serviceRequests[currentRequestIndex].expertiseRequired
                        .length > 0 && (
                        <div className={styles.expertiseRequired}>
                          <strong>Expertise Required:</strong>
                          <div className={styles.expertiseTags}>
                            {serviceRequests[
                              currentRequestIndex
                            ].expertiseRequired.map((skill, index) => (
                              <span key={index} className={styles.expertiseTag}>
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Display Images */}
                      {serviceRequests[currentRequestIndex].serviceImages
                        ?.length > 0 && (
                        <div className={styles.imagesSection}>
                          <strong>Reference Images:</strong>
                          <div className={styles.imagesGrid}>
                            {serviceRequests[
                              currentRequestIndex
                            ].serviceImages.map((imagePath, index) => (
                              <div key={index} className={styles.imageItem}>
                                <img
                                  src={`/images/service-requests/${imagePath}`}
                                  alt={`Reference ${index + 1}`}
                                  className={styles.requestImage}
                                  onError={(e) => {
                                    e.target.src = "/placeholder.svg";
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {serviceRequests[currentRequestIndex].hasAudio && (
                        <div className={styles.audioSection}>
                          <strong>Audio Description:</strong>
                          <AudioPlayer
                            audioData={
                              serviceRequests[currentRequestIndex].audioData
                            }
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Offers Section */}
                  <div className={styles.offersSection}>
                    <h4>Received Offers</h4>
                    {serviceRequests[currentRequestIndex].offers.length ===
                    0 ? (
                      <div className={styles.noOffers}>
                        <p>No offers received yet for this request.</p>
                      </div>
                    ) : (
                      <div className={styles.offersList}>
                        {serviceRequests[currentRequestIndex].offers.map(
                          (offer, index) => (
                            <div
                              key={index}
                              className={`${styles.offerCard} ${
                                offer.accepted ? styles.acceptedOffer : ""
                              }`}
                            >
                              <div className={styles.freelancerInfo}>
                                <img
                                  src={
                                    offer.freelancerInfo.profilePicture ||
                                    "/placeholder.svg"
                                  }
                                  alt={offer.freelancerInfo.username}
                                  className={styles.freelancerAvatar}
                                />
                                <div className={styles.freelancerDetails}>
                                  <h5>@{offer.freelancerInfo.username}</h5>
                                  <div className={styles.freelancerStats}>
                                    <div className={styles.rating}>
                                      {renderStars(
                                        offer.freelancerInfo.averageStars || 0
                                      )}
                                      <span>
                                        (
                                        {offer.freelancerInfo.averageStars || 0}
                                        )
                                      </span>
                                    </div>
                                    <div className={styles.experience}>
                                      {offer.freelancerInfo
                                        .satisfiedCustomers || 0}{" "}
                                      satisfied customers
                                    </div>
                                  </div>
                                  <div className={styles.freelancerExpertise}>
                                    {(offer.freelancerInfo.expertise || [])
                                      .slice(0, 3)
                                      .map((skill, skillIndex) => (
                                        <span
                                          key={skillIndex}
                                          className={styles.skillTag}
                                        >
                                          {skill}
                                        </span>
                                      ))}
                                    {offer.freelancerInfo.expertise?.length >
                                      3 && (
                                      <span className={styles.moreSkills}>
                                        +
                                        {offer.freelancerInfo.expertise.length -
                                          3}{" "}
                                        more
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className={styles.offerDetails}>
                                <div className={styles.offerPrice}>
                                  <strong>
                                    {
                                      serviceRequests[currentRequestIndex]
                                        .currency
                                    }
                                    {offer.offeredPrice}
                                  </strong>
                                </div>
                                <div className={styles.reachTime}>
                                  Can start by:{" "}
                                  {new Date(
                                    offer.reachTime
                                  ).toLocaleDateString()}
                                </div>
                              </div>

                              {!offer.accepted && (
                                <div className={styles.offerActions}>
                                  <button
                                    className={styles.acceptButton}
                                    onClick={() =>
                                      handleAcceptOffer(
                                        serviceRequests[currentRequestIndex]
                                          .requestId,
                                        offer.freelancerInfo.username
                                      )
                                    }
                                  >
                                    Accept
                                  </button>
                                  <button
                                    className={styles.declineButton}
                                    onClick={() =>
                                      handleDeclineOffer(
                                        serviceRequests[currentRequestIndex]
                                          .requestId,
                                        offer.freelancerInfo.username
                                      )
                                    }
                                  >
                                    Decline
                                  </button>
                                </div>
                              )}

                              {offer.accepted && (
                                <div className={styles.acceptedBadge}>
                                  ✓ Accepted
                                </div>
                              )}
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
