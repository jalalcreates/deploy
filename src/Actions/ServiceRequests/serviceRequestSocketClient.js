// Actions/ServiceRequests/serviceRequestSocketClient.js
"use client";

import { getSocket } from "@/Socket_IO/socket";

// ============================================
// BROADCAST SERVICE REQUEST
// ============================================
export function broadcastServiceRequest(serviceRequest, city) {
  return new Promise((resolve, reject) => {
    const socket = getSocket();

    if (!socket || !socket.connected) {
      reject(new Error("Socket not connected"));
      return;
    }

    const timeoutId = setTimeout(() => {
      socket.off("broadcast-success", successHandler);
      socket.off("broadcast-error", errorHandler);
      reject(new Error("Request timeout"));
    }, 10000);

    const successHandler = (response) => {
      clearTimeout(timeoutId);
      socket.off("broadcast-success", successHandler);
      socket.off("broadcast-error", errorHandler);
      resolve(response);
    };

    const errorHandler = (error) => {
      clearTimeout(timeoutId);
      socket.off("broadcast-success", successHandler);
      socket.off("broadcast-error", errorHandler);
      reject(new Error(error.error || "Broadcast failed"));
    };

    socket.on("broadcast-success", successHandler);
    socket.on("broadcast-error", errorHandler);

    socket.emit("broadcast-service-request", {
      serviceRequest,
      city,
    });

    console.log(`📢 Broadcasting service request to ${city}`);
  });
}

// ============================================
// LISTEN FOR NEW SERVICE REQUESTS (FREELANCER)
// ============================================
export function listenForNewServiceRequests(callback) {
  const socket = getSocket();

  if (!socket) {
    console.warn("Socket not available");
    return () => {};
  }

  const handler = (serviceRequest) => {
    console.log("📨 New service request received:", serviceRequest);
    callback(serviceRequest);
  };

  socket.on("new-service-request-realtime", handler);

  return () => {
    socket.off("new-service-request-realtime", handler);
  };
}

// ============================================
// SUBMIT OFFER FOR SERVICE REQUEST
// ============================================
export function submitOfferRealtime(
  requestId,
  requesterUsername,
  offer,
  serviceRequestData = null
) {
  return new Promise((resolve, reject) => {
    const socket = getSocket();

    if (!socket || !socket.connected) {
      reject(new Error("Socket not connected"));
      return;
    }

    const timeoutId = setTimeout(() => {
      socket.off("offer-submission-success", successHandler);
      socket.off("offer-submission-error", errorHandler);
      socket.off("save-offer-to-database", fallbackHandler);
      reject(new Error("Request timeout"));
    }, 10000);

    const successHandler = (response) => {
      if (response.requestId === requestId) {
        clearTimeout(timeoutId);
        socket.off("offer-submission-success", successHandler);
        socket.off("offer-submission-error", errorHandler);
        socket.off("save-offer-to-database", fallbackHandler);
        resolve({ ...response, requiresDbFallback: false });
      }
    };

    const errorHandler = (error) => {
      if (error.requestId === requestId) {
        clearTimeout(timeoutId);
        socket.off("offer-submission-success", successHandler);
        socket.off("offer-submission-error", errorHandler);
        socket.off("save-offer-to-database", fallbackHandler);
        reject(new Error(error.error || "Offer submission failed"));
      }
    };

    const fallbackHandler = (data) => {
      if (data.requestId === requestId) {
        clearTimeout(timeoutId);
        socket.off("offer-submission-success", successHandler);
        socket.off("offer-submission-error", errorHandler);
        socket.off("save-offer-to-database", fallbackHandler);
        resolve({ ...data, requiresDbFallback: true });
      }
    };

    socket.on("offer-submission-success", successHandler);
    socket.on("offer-submission-error", errorHandler);
    socket.on("save-offer-to-database", fallbackHandler);

    socket.emit("submit-offer-realtime", {
      requestId,
      requesterUsername,
      offer,
      serviceRequestData,
    });

    console.log(`💼 Submitting offer for request ${requestId}`);
  });
}

// ============================================
// LISTEN FOR NEW OFFERS (REQUESTER)
// ============================================
export function listenForNewOffers(callback) {
  const socket = getSocket();

  if (!socket) {
    console.warn("Socket not available");
    return () => {};
  }

  const handler = (data) => {
    console.log("💼 New offer received:", data);
    callback(data);
  };

  socket.on("new-offer-received-realtime", handler);

  return () => {
    socket.off("new-offer-received-realtime", handler);
  };
}

// ============================================
// ACCEPT OFFER (CONVERT TO ORDER)
// ============================================
export function acceptOfferRealtime(
  requestId,
  freelancerUsername,
  serviceRequestData,
  acceptedOffer
) {
  return new Promise((resolve, reject) => {
    const socket = getSocket();

    if (!socket || !socket.connected) {
      reject(new Error("Socket not connected"));
      return;
    }

    const timeoutId = setTimeout(() => {
      socket.off("offer-acceptance-success", successHandler);
      socket.off("offer-acceptance-error", errorHandler);
      socket.off("save-accepted-offer-to-database", fallbackHandler);
      reject(new Error("Request timeout"));
    }, 10000);

    const successHandler = (response) => {
      if (response.requestId === requestId) {
        clearTimeout(timeoutId);
        socket.off("offer-acceptance-success", successHandler);
        socket.off("offer-acceptance-error", errorHandler);
        socket.off("save-accepted-offer-to-database", fallbackHandler);
        resolve({ ...response, requiresDbFallback: false });
      }
    };

    const errorHandler = (error) => {
      if (error.requestId === requestId) {
        clearTimeout(timeoutId);
        socket.off("offer-acceptance-success", successHandler);
        socket.off("offer-acceptance-error", errorHandler);
        socket.off("save-accepted-offer-to-database", fallbackHandler);
        reject(new Error(error.error || "Offer acceptance failed"));
      }
    };

    const fallbackHandler = (data) => {
      if (data.requestId === requestId) {
        clearTimeout(timeoutId);
        socket.off("offer-acceptance-success", successHandler);
        socket.off("offer-acceptance-error", errorHandler);
        socket.off("save-accepted-offer-to-database", fallbackHandler);
        resolve({ ...data, requiresDbFallback: true });
      }
    };

    socket.on("offer-acceptance-success", successHandler);
    socket.on("offer-acceptance-error", errorHandler);
    socket.on("save-accepted-offer-to-database", fallbackHandler);

    socket.emit("accept-offer-realtime", {
      requestId,
      freelancerUsername,
      serviceRequestData,
      acceptedOffer,
    });

    console.log(
      `✅ Accepting offer from ${freelancerUsername} for request ${requestId}`
    );
  });
}

// ============================================
// LISTEN FOR OFFER ACCEPTED (FREELANCER)
// ============================================
export function listenForOfferAccepted(callback) {
  const socket = getSocket();

  if (!socket) {
    console.warn("Socket not available");
    return () => {};
  }

  const handler = (data) => {
    console.log("✅ Your offer was accepted:", data);
    callback(data);
  };

  socket.on("offer-accepted-realtime", handler);

  return () => {
    socket.off("offer-accepted-realtime", handler);
  };
}

// ============================================
// DECLINE OFFER
// ============================================
export function declineOfferRealtime(requestId, freelancerUsername) {
  return new Promise((resolve, reject) => {
    const socket = getSocket();

    if (!socket || !socket.connected) {
      reject(new Error("Socket not connected"));
      return;
    }

    const timeoutId = setTimeout(() => {
      socket.off("offer-decline-success", successHandler);
      socket.off("offer-decline-error", errorHandler);
      socket.off("save-declined-offer-to-database", fallbackHandler);
      reject(new Error("Request timeout"));
    }, 5000);

    const successHandler = (response) => {
      if (response.requestId === requestId) {
        clearTimeout(timeoutId);
        socket.off("offer-decline-success", successHandler);
        socket.off("offer-decline-error", errorHandler);
        socket.off("save-declined-offer-to-database", fallbackHandler);
        resolve({ ...response, requiresDbFallback: false });
      }
    };

    const errorHandler = (error) => {
      if (error.requestId === requestId) {
        clearTimeout(timeoutId);
        socket.off("offer-decline-success", successHandler);
        socket.off("offer-decline-error", errorHandler);
        socket.off("save-declined-offer-to-database", fallbackHandler);
        reject(new Error(error.error || "Offer decline failed"));
      }
    };

    const fallbackHandler = (data) => {
      if (data.requestId === requestId) {
        clearTimeout(timeoutId);
        socket.off("offer-decline-success", successHandler);
        socket.off("offer-decline-error", errorHandler);
        socket.off("save-declined-offer-to-database", fallbackHandler);
        resolve({ ...data, requiresDbFallback: true });
      }
    };

    socket.on("offer-decline-success", successHandler);
    socket.on("offer-decline-error", errorHandler);
    socket.on("save-declined-offer-to-database", fallbackHandler);

    socket.emit("decline-offer-realtime", {
      requestId,
      freelancerUsername,
    });

    console.log(
      `❌ Declining offer from ${freelancerUsername} for request ${requestId}`
    );
  });
}

// ============================================
// LISTEN FOR OFFER DECLINED (FREELANCER)
// ============================================
export function listenForOfferDeclined(callback) {
  const socket = getSocket();

  if (!socket) {
    console.warn("Socket not available");
    return () => {};
  }

  const handler = (data) => {
    console.log("❌ Your offer was declined:", data);
    callback(data);
  };

  socket.on("offer-declined-realtime", handler);

  return () => {
    socket.off("offer-declined-realtime", handler);
  };
}

// ============================================
// LISTEN FOR SERVICE REQUEST FULFILLED (FREELANCER)
// ============================================
export function listenForServiceRequestFulfilled(callback) {
  const socket = getSocket();

  if (!socket) {
    console.warn("Socket not available");
    return () => {};
  }

  const handler = (data) => {
    console.log("📋 Service request fulfilled by another freelancer:", data);
    callback(data);
  };

  socket.on("service-request-fulfilled", handler);

  return () => {
    socket.off("service-request-fulfilled", handler);
  };
}

// ============================================
// DELETE SERVICE REQUEST
// ============================================
export function deleteServiceRequestRealtime(requestId) {
  return new Promise((resolve, reject) => {
    const socket = getSocket();

    if (!socket || !socket.connected) {
      reject(new Error("Socket not connected"));
      return;
    }

    const timeoutId = setTimeout(() => {
      socket.off("delete-request-success", successHandler);
      socket.off("delete-request-error", errorHandler);
      reject(new Error("Request timeout"));
    }, 5000);

    const successHandler = (response) => {
      if (response.requestId === requestId) {
        clearTimeout(timeoutId);
        socket.off("delete-request-success", successHandler);
        socket.off("delete-request-error", errorHandler);
        resolve(response);
      }
    };

    const errorHandler = (error) => {
      clearTimeout(timeoutId);
      socket.off("delete-request-success", successHandler);
      socket.off("delete-request-error", errorHandler);
      reject(new Error(error.error || "Delete failed"));
    };

    socket.on("delete-request-success", successHandler);
    socket.on("delete-request-error", errorHandler);

    socket.emit("delete-service-request-realtime", {
      requestId,
    });

    console.log(`🗑️ Deleting service request ${requestId}`);
  });
}
