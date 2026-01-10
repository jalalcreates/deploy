// server.js - COMPLETE REAL-TIME IMPLEMENTATION
import { createServer } from "node:http";
import { Server } from "socket.io";
import { jwtVerify } from "jose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { sanitizeForEmit } from "./serverUtils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, ".env.local") });

const hostname = "localhost";
const port = 4000;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error("❌ FATAL ERROR: JWT_SECRET not defined");
  process.exit(1);
}

console.log("✅ JWT_SECRET loaded successfully");

const encoder = new TextEncoder();
const key = encoder.encode(JWT_SECRET);

// ===== IN-MEMORY STORAGE =====
const onlineUsers = new Map(); // username -> { socketId, userData, connectedAt }
const activeOrders = new Map(); // orderId -> orderData

const httpServer = createServer((req, res) => {
  res.writeHead(200);
  res.end("🟢 Socket.IO server is running.");
});

const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// ===== AUTHENTICATION MIDDLEWARE =====
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentication error: No token provided"));
    }

    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    if (!payload || !payload.username) {
      return next(new Error("Authentication error: Invalid token payload"));
    }

    // Extract city and isFreelancer from handshake auth
    const city = socket.handshake.auth.city;
    const isFreelancer = socket.handshake.auth.isFreelancer || false;

    socket.userData = {
      username: payload.username,
      userId: payload.userId || payload.username,
      isFreelancer: isFreelancer,
      city: city || null,
    };

    console.log("✅ User authenticated:", payload.username, "| City:", city, "| Freelancer:", isFreelancer);
    next();
  } catch (error) {
    console.error("❌ Socket authentication error:", error.message);
    next(new Error("Authentication error: " + error.message));
  }
});

// ===== HELPER FUNCTIONS =====
function getUserSocketId(username) {
  const user = onlineUsers.get(username);
  return user ? user.socketId : null;
}

function isUserOnline(username) {
  return onlineUsers.has(username);
}

// ===== CONNECTION HANDLER =====
io.on("connection", (socket) => {
  const { username } = socket.userData;

  console.log(`✅ User connected: ${username} (${socket.id})`);

  // Add to online users
  onlineUsers.set(username, {
    socketId: socket.id,
    userData: socket.userData,
    connectedAt: new Date(),
  });

  socket.emit("authenticated", {
    success: true,
    username,
    message: "Successfully connected to real-time server",
  });

  io.emit("online-users-count", onlineUsers.size);
  console.log(`📊 Online users: ${onlineUsers.size}`);

  // ========================================
  // EVENT: CHECK USER ONLINE
  // ========================================
  socket.on("check-user-online", (targetUsername) => {
    const isOnline = isUserOnline(targetUsername);
    console.log(
      `🔍 ${username} checking if ${targetUsername} is online: ${isOnline}`
    );
    socket.emit("user-online-status", {
      username: targetUsername,
      isOnline,
    });
  });

  // ========================================
  // EVENT: SEND ORDER (CLIENT -> FREELANCER)
  // ========================================
  socket.on("send-order-realtime", (data) => {
    const { freelancerUsername, orderData } = data;
    console.log(`📦 ${username} sending order to ${freelancerUsername}`);

    const freelancerSocketId = getUserSocketId(freelancerUsername);

    if (!freelancerSocketId) {
      // Freelancer OFFLINE - save to database
      console.log(`📴 ${freelancerUsername} is OFFLINE`);
      socket.emit("order-status", {
        orderId: orderData.orderId,
        success: false,
        isOnline: false,
        message: "Freelancer is offline. Saving to database.",
      });
      return;
    }

    // Freelancer ONLINE - store in memory and send via socket
    activeOrders.set(orderData.orderId, {
      ...orderData,
      clientUsername: username,
      freelancerUsername,
      customerInfo: {
        username: username,
        profilePicture: orderData.clientProfilePicture || null,
      },
      freelancerInfo: {
        username: freelancerUsername,
        profilePicture: orderData.freelancerProfilePicture || null,
      },
      status: "pending",
      createdAt: new Date(),
      negotiation: {
        isNegotiating: false,
        currentOfferTo: "",
        offeredPrice: 0,
      },
    });

    // Send to freelancer
    io.to(freelancerSocketId).emit("new-order-realtime", {
      ...orderData,
      clientUsername: username,
      clientProfilePicture: orderData.clientProfilePicture || null,
      freelancerProfilePicture: orderData.freelancerProfilePicture || null,
    });

    // Confirm to client
    socket.emit("order-status", {
      orderId: orderData.orderId,
      success: true,
      isOnline: true,
      message: "Order sent in real-time",
    });

    console.log(
      `✅ Order ${orderData.orderId} sent to ${freelancerUsername} in real-time`
    );
  });

  // ========================================
  // EVENT: FREELANCER RESPONDS (ACCEPT/REJECT/COUNTER)
  // ========================================
  socket.on("order-response-realtime", (data) => {
    const { orderId, response, newPrice, message, orderData } = data;
    console.log(`📬 ${username} responded to order ${orderId}: ${response}`);

    let order = activeOrders.get(orderId);

    // If order not in activeOrders, try to reconstruct from orderData
    if (!order && orderData) {
      console.log(
        `🔄 Order ${orderId} not in memory, reconstructing from provided data...`
      );

      // Determine client username from orderData
      const clientUsername =
        orderData.user ||
        orderData.customerInfo?.username ||
        orderData.clientUsername;
      const freelancerUsername = orderData.freelancerInfo?.username || username;

      if (!clientUsername) {
        console.error(
          `❌ Cannot reconstruct order ${orderId}: missing client username`
        );
        socket.emit("response-error", {
          orderId,
          error: "Order not found and cannot be reconstructed",
        });
        return;
      }

      // Check if client is online
      const clientSocketId = getUserSocketId(clientUsername);
      if (!clientSocketId) {
        console.log(
          `📴 Client ${clientUsername} is OFFLINE, cannot resume real-time`
        );
        socket.emit("save-to-database", {
          orderId,
          orderData,
          response,
          newPrice,
          reason: "client-offline",
        });
        return;
      }

      // Both users online - reconstruct order in activeOrders
      order = {
        orderId,
        clientUsername,
        freelancerUsername,
        customerInfo: {
          username: clientUsername,
          profilePicture: orderData.customerInfo?.profilePicture || null,
        },
        freelancerInfo: {
          username: freelancerUsername,
          profilePicture: orderData.freelancerInfo?.profilePicture || null,
        },
        budget: orderData.priceToBePaid || orderData.budget,
        currency: orderData.currency || "USD",
        problemStatement:
          orderData.problemDescription || orderData.problemStatement,
        expertiseRequired: orderData.expertiseRequired || [],
        city: orderData.city,
        deadline: orderData.deadline,
        address: orderData.address,
        phoneNumber: orderData.phoneNumber,
        status: orderData.status || "pending",
        expectedReachTime: orderData.expectedReachTime,
        negotiation: orderData.negotiation || {
          isNegotiating: false,
          currentOfferTo: "",
          offeredPrice: 0,
        },
      };

      activeOrders.set(orderId, order);
      console.log(
        `✅ Order ${orderId} reconstructed and added to activeOrders`
      );
    }

    if (!order) {
      console.error(`❌ Order ${orderId} not found and no orderData provided`);
      socket.emit("response-error", { orderId, error: "Order not found" });
      return;
    }

    const clientSocketId = getUserSocketId(order.clientUsername);
    console.log({ clientSocketId });
    if (!clientSocketId) {
      // Client OFFLINE - save to database
      console.log(`📴 Client ${order.clientUsername} is OFFLINE`);
      socket.emit("save-to-database", {
        orderId,
        orderData: order,
        response,
        newPrice,
        reason: "client-offline",
      });
      activeOrders.delete(orderId);
      return;
    }

    // Handle different response types
    if (response === "accept") {
      // ACCEPT - Update order and notify client
      order.status = "accepted";
      order.priceToBePaid = order.budget;
      order.acceptedAt = new Date();
      order.acceptedBy = username;
      activeOrders.set(orderId, order);

      io.to(clientSocketId).emit("order-accepted-realtime", {
        orderId,
        acceptedBy: username,
        acceptedPrice: order.budget,
        message: "Freelancer accepted your order!",
        order: order, // Send full order data
      });

      socket.emit("response-sent", {
        orderId,
        success: true,
        message: "Order accepted successfully",
      });

      console.log(`✅ Order ${orderId} ACCEPTED by ${username}`);
    } else if (response === "reject") {
      // REJECT - Delete order and notify client
      io.to(clientSocketId).emit("order-rejected-realtime", {
        orderId,
        rejectedBy: username,
        message: message || "Freelancer rejected your order",
      });

      socket.emit("response-sent", {
        orderId,
        success: true,
        message: "Order rejected",
      });

      activeOrders.delete(orderId);
      console.log(`❌ Order ${orderId} REJECTED by ${username}`);
    } else if (response === "counter") {
      // COUNTER OFFER - Update negotiation state
      order.negotiation = {
        isNegotiating: true,
        currentOfferTo: "client", // Use "client" not username
        offeredPrice: newPrice,
        lastOfferBy: username,
      };
      // Store expectedReachTime from the counter offer data
      if (data.expectedReachTime) {
        order.expectedReachTime = data.expectedReachTime;
      }
      activeOrders.set(orderId, order);
      io.to(clientSocketId).emit("counter-offer-realtime", {
        orderId,
        type: "counter-offer",
        newPrice,
        message: message || `Freelancer offered $${newPrice}`,
        offeredBy: username,
        expectedReachTime: order.expectedReachTime,
      });

      socket.emit("response-sent", {
        orderId,
        success: true,
        message: "Counter offer sent",
      });

      console.log(`${clientSocketId}`);
      console.log(`💰 Counter offer sent for order ${orderId}: $${newPrice}`);
    }
  });

  // ========================================
  // EVENT: CLIENT RESPONDS TO COUNTER OFFER
  // ========================================
  socket.on("counter-response-realtime", (data) => {
    const { orderId, response, newPrice, message, orderData } = data;
    console.log(
      `💰 ${username} responding to counter for ${orderId}: ${response}`
    );

    let order = activeOrders.get(orderId);

    // If order not in activeOrders, try to reconstruct from orderData
    if (!order && orderData) {
      console.log(
        `🔄 Order ${orderId} not in memory, reconstructing from provided data...`
      );

      // Determine freelancer username from orderData
      const freelancerUsername =
        orderData.freelancerInfo?.username || orderData.user;
      const clientUsername = orderData.customerInfo?.username || username;

      if (!freelancerUsername) {
        console.error(
          `❌ Cannot reconstruct order ${orderId}: missing freelancer username`
        );
        socket.emit("response-error", {
          orderId,
          error: "Order not found and cannot be reconstructed",
        });
        return;
      }

      // Check if freelancer is online
      const freelancerSocketId = getUserSocketId(freelancerUsername);
      if (!freelancerSocketId) {
        console.log(
          `📴 Freelancer ${freelancerUsername} is OFFLINE, cannot resume real-time`
        );
        socket.emit("save-to-database", {
          orderId,
          orderData,
          response,
          newPrice,
          reason: "freelancer-offline",
        });
        return;
      }

      // Both users online - reconstruct order in activeOrders
      order = {
        orderId,
        clientUsername,
        freelancerUsername,
        customerInfo: {
          username: clientUsername,
          profilePicture: orderData.customerInfo?.profilePicture || null,
        },
        freelancerInfo: {
          username: freelancerUsername,
          profilePicture: orderData.freelancerInfo?.profilePicture || null,
        },
        budget: orderData.priceToBePaid || orderData.budget,
        currency: orderData.currency || "USD",
        problemStatement:
          orderData.problemDescription || orderData.problemStatement,
        expertiseRequired: orderData.expertiseRequired || [],
        city: orderData.city,
        deadline: orderData.deadline,
        address: orderData.address,
        phoneNumber: orderData.phoneNumber,
        status: orderData.status || "pending",
        expectedReachTime: orderData.expectedReachTime,
        negotiation: orderData.negotiation || {
          isNegotiating: false,
          currentOfferTo: "",
          offeredPrice: 0,
        },
      };

      activeOrders.set(orderId, order);
      console.log(
        `✅ Order ${orderId} reconstructed and added to activeOrders`
      );
    }

    if (!order) {
      console.error(`❌ Order ${orderId} not found and no orderData provided`);
      socket.emit("response-error", { orderId, error: "Order not found" });
      return;
    }

    const freelancerSocketId = getUserSocketId(order.freelancerUsername);

    if (!freelancerSocketId) {
      // Freelancer OFFLINE - save to database
      console.log(`📴 Freelancer ${order.freelancerUsername} is OFFLINE`);
      socket.emit("save-to-database", {
        orderId,
        orderData: order,
        response,
        newPrice,
        reason: "freelancer-offline",
      });
      activeOrders.delete(orderId);
      return;
    }

    if (response === "accept") {
      // ACCEPT COUNTER OFFER
      order.status = "accepted";
      order.priceToBePaid = order.negotiation.offeredPrice;
      order.negotiation.isNegotiating = false;
      order.acceptedAt = new Date();
      order.acceptedBy = username;
      activeOrders.set(orderId, order);

      io.to(freelancerSocketId).emit("order-accepted-realtime", {
        orderId,
        acceptedBy: username,
        acceptedPrice: order.priceToBePaid,
        message: "Client accepted your counter offer!",
        order: order,
      });

      socket.emit("response-sent", {
        orderId,
        success: true,
        message: "Counter offer accepted",
      });

      console.log(`✅ Counter offer ACCEPTED for order ${orderId}`);
    } else if (response === "reject") {
      // REJECT COUNTER OFFER
      io.to(freelancerSocketId).emit("order-rejected-realtime", {
        orderId,
        rejectedBy: username,
        message: "Client rejected your counter offer",
      });

      socket.emit("response-sent", {
        orderId,
        success: true,
        message: "Counter offer rejected",
      });

      activeOrders.delete(orderId);
      console.log(`❌ Counter offer REJECTED for order ${orderId}`);
    } else if (response === "counter") {
      // ANOTHER COUNTER OFFER
      order.negotiation = {
        isNegotiating: true,
        currentOfferTo: "freelancer", // Use "freelancer" not username
        offeredPrice: newPrice,
        lastOfferBy: username,
      };
      activeOrders.set(orderId, order);

      io.to(freelancerSocketId).emit("counter-offer-realtime", {
        orderId,
        type: "counter-offer",
        newPrice,
        message: message || `Client offered $${newPrice}`,
        offeredBy: username,
        expectedReachTime: order.expectedReachTime,
      });

      socket.emit("response-sent", {
        orderId,
        success: true,
        message: "Counter offer sent",
      });

      console.log(`💰 Client counter offer for order ${orderId}: $${newPrice}`);
    }
  });

  // ========================================
  // EVENT: SHARE LOCATION (CLIENT)
  // ========================================
  socket.on("share-location-realtime", (data) => {
    const { orderId, latitude, longitude } = data;
    console.log(`📍 ${username} sharing location for order ${orderId}`);

    const order = activeOrders.get(orderId);
    if (!order) {
      socket.emit("location-error", { orderId, error: "Order not found" });
      return;
    }

    // Update order with location
    order.location = { latitude, longitude, sharedAt: new Date() };
    activeOrders.set(orderId, order);

    const freelancerSocketId = getUserSocketId(order.freelancerUsername);

    if (!freelancerSocketId) {
      // Freelancer OFFLINE
      socket.emit("save-location-to-database", {
        orderId,
        location: { latitude, longitude },
        reason: "freelancer-offline",
      });
      return;
    }

    // Notify freelancer - trigger reminder modal
    io.to(freelancerSocketId).emit("location-shared-realtime", {
      orderId,
      latitude,
      longitude,
      clientUsername: username,
      showReminderModal: true, // Trigger freelancer reminder modal
    });

    socket.emit("location-shared-success", {
      orderId,
      success: true,
    });

    console.log(`✅ Location shared for order ${orderId}`);
  });

  // ========================================
  // EVENT: FREELANCER REACHED
  // ========================================
  socket.on("freelancer-reached-realtime", (data) => {
    const { orderId, orderData } = data;
    console.log(`🚗 ${username} marked reached for order ${orderId}`);

    let order = activeOrders.get(orderId);

    // If order not in activeOrders, try to reconstruct from orderData
    if (!order && orderData) {
      console.log(
        `🔄 Order ${orderId} not in memory, reconstructing from provided data...`
      );

      const clientUsername = orderData.customerInfo?.username || orderData.user;
      const freelancerUsername = username;

      if (!clientUsername) {
        console.error(
          `❌ Cannot reconstruct order ${orderId}: missing client username`
        );
        socket.emit("location-error", {
          orderId,
          error: "Order not found and cannot be reconstructed",
        });
        return;
      }

      // Check if client is online
      const clientSocketId = getUserSocketId(clientUsername);
      if (!clientSocketId) {
        console.log(
          `📴 Client ${clientUsername} is OFFLINE, cannot resume real-time`
        );
        socket.emit("save-reached-to-database", {
          orderId,
          reason: "client-offline",
        });
        return;
      }

      // Both users online - reconstruct order in activeOrders
      order = {
        orderId,
        clientUsername,
        freelancerUsername,
        customerInfo: {
          username: clientUsername,
          profilePicture: orderData.customerInfo?.profilePicture || null,
        },
        freelancerInfo: {
          username: freelancerUsername,
          profilePicture: orderData.freelancerInfo?.profilePicture || null,
        },
        budget: orderData.priceToBePaid || orderData.budget,
        currency: orderData.currency || "USD",
        problemStatement:
          orderData.problemDescription || orderData.problemStatement,
        expertiseRequired: orderData.expertiseRequired || [],
        city: orderData.city,
        deadline: orderData.deadline,
        address: orderData.address,
        phoneNumber: orderData.phoneNumber,
        status: orderData.status || "accepted",
        expectedReachTime: orderData.expectedReachTime,
        location: orderData.location,
        negotiation: orderData.negotiation,
      };

      activeOrders.set(orderId, order);
      console.log(
        `✅ Order ${orderId} reconstructed and added to activeOrders`
      );
    }

    if (!order) {
      socket.emit("location-error", { orderId, error: "Order not found" });
      return;
    }

    order.isReached = {
      value: true,
      time: new Date(),
      confirmed: false,
    };
    order.status = "accepted";
    activeOrders.set(orderId, order);

    const clientSocketId = getUserSocketId(order.clientUsername);

    if (!clientSocketId) {
      socket.emit("save-reached-to-database", { orderId });
      return;
    }

    // Notify client
    io.to(clientSocketId).emit("freelancer-reached-realtime", {
      orderId,
      freelancerUsername: username,
      reachedAt: new Date(),
    });

    socket.emit("reached-notification-sent", {
      orderId,
      success: true,
    });

    console.log(
      `✅ Client notified of freelancer arrival for order ${orderId}`
    );
  });

  // ========================================
  // EVENT: CONFIRM ARRIVAL (CLIENT)
  // ========================================
  socket.on("confirm-arrival-realtime", (data) => {
    const { orderId, confirmed, orderData } = data;
    console.log(
      `✅ ${username} ${
        confirmed ? "confirmed" : "denied"
      } arrival for ${orderId}`
    );

    let order = activeOrders.get(orderId);

    // If order not in activeOrders, try to reconstruct from orderData
    if (!order && orderData) {
      console.log(
        `🔄 Order ${orderId} not in memory, reconstructing from provided data...`
      );

      const freelancerUsername =
        orderData.freelancerInfo?.username || orderData.user;
      const clientUsername = username;

      if (!freelancerUsername) {
        console.error(
          `❌ Cannot reconstruct order ${orderId}: missing freelancer username`
        );
        socket.emit("location-error", {
          orderId,
          error: "Order not found and cannot be reconstructed",
        });
        return;
      }

      // Check if freelancer is online
      const freelancerSocketId = getUserSocketId(freelancerUsername);
      if (!freelancerSocketId) {
        console.log(
          `📴 Freelancer ${freelancerUsername} is OFFLINE, cannot resume real-time`
        );
        socket.emit("save-arrival-confirmation-to-database", {
          orderId,
          confirmed,
          reason: "freelancer-offline",
        });
        return;
      }

      // Both users online - reconstruct order in activeOrders
      order = {
        orderId,
        clientUsername,
        freelancerUsername,
        customerInfo: {
          username: clientUsername,
          profilePicture: orderData.customerInfo?.profilePicture || null,
        },
        freelancerInfo: {
          username: freelancerUsername,
          profilePicture: orderData.freelancerInfo?.profilePicture || null,
        },
        budget: orderData.priceToBePaid || orderData.budget,
        currency: orderData.currency || "USD",
        problemStatement:
          orderData.problemDescription || orderData.problemStatement,
        expertiseRequired: orderData.expertiseRequired || [],
        city: orderData.city,
        deadline: orderData.deadline,
        address: orderData.address,
        phoneNumber: orderData.phoneNumber,
        status: orderData.status || "accepted",
        expectedReachTime: orderData.expectedReachTime,
        location: orderData.location,
        isReached: orderData.isReached,
        negotiation: orderData.negotiation,
      };

      activeOrders.set(orderId, order);
      console.log(
        `✅ Order ${orderId} reconstructed and added to activeOrders`
      );
    }

    if (!order) {
      socket.emit("location-error", { orderId, error: "Order not found" });
      return;
    }

    order.isReached.confirmed = confirmed;
    order.isReached.confirmedAt = new Date();
    order.status = confirmed ? "in-progress" : "accepted";
    activeOrders.set(orderId, order);

    const freelancerSocketId = getUserSocketId(order.freelancerUsername);

    if (!freelancerSocketId) {
      socket.emit("save-arrival-confirmation-to-database", {
        orderId,
        confirmed,
      });
      return;
    }

    // Notify freelancer
    io.to(freelancerSocketId).emit("arrival-confirmed-realtime", {
      orderId,
      confirmed,
      confirmedBy: username,
    });

    socket.emit("confirmation-sent", {
      orderId,
      success: true,
    });

    console.log(
      `✅ Freelancer notified of arrival ${
        confirmed ? "confirmation" : "denial"
      }`
    );
  });

  // ========================================
  // EVENT: MARK ORDER COMPLETE (FREELANCER)
  // ========================================
  socket.on("mark-complete-realtime", (data) => {
    const { orderId, proofPictures, description, orderData } = data;
    console.log(`✅ ${username} marked order ${orderId} complete`);

    let order = activeOrders.get(orderId);

    // If order not in activeOrders, try to reconstruct from orderData
    if (!order && orderData) {
      console.log(
        `🔄 Order ${orderId} not in memory, reconstructing from provided data...`
      );

      const clientUsername = orderData.customerInfo?.username || orderData.user;
      const freelancerUsername = username;

      if (!clientUsername) {
        console.error(
          `❌ Cannot reconstruct order ${orderId}: missing client username`
        );
        socket.emit("completion-error", {
          orderId,
          error: "Order not found and cannot be reconstructed",
        });
        return;
      }

      // Check if client is online
      const clientSocketId = getUserSocketId(clientUsername);
      if (!clientSocketId) {
        console.log(
          `📴 Client ${clientUsername} is OFFLINE, cannot resume real-time`
        );
        socket.emit("save-completion-to-database", {
          orderId,
          proofPictures,
          description,
          reason: "client-offline",
        });
        return;
      }

      // Both users online - reconstruct order in activeOrders
      order = {
        orderId,
        clientUsername,
        freelancerUsername,
        customerInfo: {
          username: clientUsername,
          profilePicture: orderData.customerInfo?.profilePicture || null,
        },
        freelancerInfo: {
          username: freelancerUsername,
          profilePicture: orderData.freelancerInfo?.profilePicture || null,
        },
        budget: orderData.priceToBePaid || orderData.budget,
        currency: orderData.currency || "USD",
        problemStatement:
          orderData.problemDescription || orderData.problemStatement,
        expertiseRequired: orderData.expertiseRequired || [],
        city: orderData.city,
        deadline: orderData.deadline,
        address: orderData.address,
        phoneNumber: orderData.phoneNumber,
        status: orderData.status || "in-progress",
        expectedReachTime: orderData.expectedReachTime,
        location: orderData.location,
        isReached: orderData.isReached,
        negotiation: orderData.negotiation,
      };

      activeOrders.set(orderId, order);
      console.log(
        `✅ Order ${orderId} reconstructed and added to activeOrders`
      );
    }

    if (!order) {
      socket.emit("completion-error", { orderId, error: "Order not found" });
      return;
    }

    order.status = "completed";
    order.proofPictures = proofPictures;
    order.finishDate = new Date();
    activeOrders.set(orderId, order);

    const clientSocketId = getUserSocketId(order.clientUsername);

    if (!clientSocketId) {
      socket.emit("save-completion-to-database", {
        orderId,
        proofPictures,
        description,
      });
      return;
    }

    // Notify client
    io.to(clientSocketId).emit("order-completed-realtime", {
      orderId,
      freelancerUsername: username,
      proofPictures,
      description,
      completedAt: new Date(),
    });

    socket.emit("completion-notification-sent", {
      orderId,
      success: true,
    });

    console.log(`✅ Client notified of order completion for ${orderId}`);
  });

  // ========================================
  // EVENT: SUBMIT REVIEW (CLIENT)
  // ========================================
  socket.on("submit-review-realtime", (data) => {
    const { orderId, review, rating, satisfied, wouldRecommend } = data;
    console.log(`⭐ ${username} submitted review for order ${orderId}`);

    const order = activeOrders.get(orderId);
    if (!order) {
      socket.emit("review-error", { orderId, error: "Order not found" });
      return;
    }

    order.review = {
      text: review,
      rating,
      satisfied,
      wouldRecommend,
      submittedAt: new Date(),
    };
    order.status = "reviewed";
    activeOrders.set(orderId, order);

    const freelancerSocketId = getUserSocketId(order.freelancerUsername);

    // Order complete - remove from active orders
    activeOrders.delete(orderId);

    if (!freelancerSocketId) {
      socket.emit("save-review-to-database", {
        orderId,
        review,
        rating,
        satisfied,
        wouldRecommend,
      });
      return;
    }

    // Notify freelancer
    io.to(freelancerSocketId).emit("review-received-realtime", {
      orderId,
      clientUsername: username,
      review,
      rating,
      satisfied,
      wouldRecommend,
    });

    socket.emit("review-submitted-success", {
      orderId,
      success: true,
    });

    console.log(`✅ Freelancer notified of review for order ${orderId}`);
  });

  // ========================================
  // EVENT: BROADCAST SERVICE REQUEST
  // ========================================
  socket.on("broadcast-service-request", (data) => {
    try {
      const { serviceRequest, city } = data;
      console.log(`📢 ${username} broadcasting service request to ${city}`);

      // Validate required fields
      if (!serviceRequest || !city) {
        socket.emit("broadcast-error", {
          error: "Missing service request data or city",
        });
        return;
      }

      // Sanitize service request data before broadcasting
      const sanitizedRequest = sanitizeForEmit(serviceRequest);

      // Get all online freelancers in the same city (excluding the requester)
      const recipientSocketIds = [];
      const recipients = [];

      onlineUsers.forEach((user, uname) => {
        // Only broadcast to users in the same city, but NOT to the requester themselves
        if (user.userData.city === city && uname !== username) {
          recipientSocketIds.push(user.socketId);
          recipients.push(uname);
        }
      });

      console.log(
        `🎯 Broadcasting to ${recipientSocketIds.length} users in ${city}:`,
        recipients.length > 0 ? recipients.join(", ") : "none"
      );

      // Broadcast to all recipients with sanitized data
      recipientSocketIds.forEach((socketId) => {
        io.to(socketId).emit("new-service-request-realtime", {
          ...sanitizedRequest,
          city,
          broadcastedAt: new Date().toISOString(),
        });
      });

      socket.emit("broadcast-success", {
        success: true,
        recipientCount: recipientSocketIds.length,
      });

      console.log(`✅ Service request broadcasted successfully to ${recipientSocketIds.length} users`);
    } catch (error) {
      console.error(`❌ Error broadcasting service request:`, error);
      socket.emit("broadcast-error", {
        error: "Failed to broadcast service request",
      });
    }
  });

  // ========================================
  // EVENT: SUBMIT OFFER FOR SERVICE REQUEST
  // ========================================
  socket.on("submit-offer-realtime", (data) => {
    try {
      const {
        requestId,
        requesterUsername,
        offer,
        serviceRequestData,
      } = data;
      console.log(`💼 ${username} submitting offer for request ${requestId}`);

      // Validate required fields
      if (!requestId || !requesterUsername || !offer) {
        socket.emit("offer-submission-error", {
          requestId,
          error: "Missing required offer data",
        });
        return;
      }

      // Validate offer structure
      if (
        !offer.freelancerInfo ||
        !offer.freelancerInfo.username ||
        !offer.reachTime
      ) {
        socket.emit("offer-submission-error", {
          requestId,
          error: "Invalid offer structure",
        });
        return;
      }

      // Sanitize offer data
      const sanitizedOffer = sanitizeForEmit(offer);

      // Check if requester is online
      const requesterSocketId = getUserSocketId(requesterUsername);

      if (!requesterSocketId) {
        // Requester OFFLINE - save to database
        console.log(`📴 Requester ${requesterUsername} is OFFLINE`);
        socket.emit("save-offer-to-database", {
          requestId,
          offer: sanitizedOffer,
          reason: "requester-offline",
        });
        return;
      }

      // Requester ONLINE - send real-time notification
      io.to(requesterSocketId).emit("new-offer-received-realtime", {
        requestId,
        offer: sanitizedOffer,
        freelancerUsername: username,
        receivedAt: new Date().toISOString(),
      });

      socket.emit("offer-submission-success", {
        requestId,
        success: true,
        message: "Offer submitted successfully",
      });

      console.log(
        `✅ Offer submitted for request ${requestId} and requester notified`
      );
    } catch (error) {
      console.error(`❌ Error submitting offer for request ${requestId}:`, error);
      socket.emit("offer-submission-error", {
        requestId: data.requestId,
        error: "Failed to submit offer",
      });
    }
  });

  // ========================================
  // EVENT: ACCEPT OFFER (CONVERT TO ORDER)
  // ========================================
  socket.on("accept-offer-realtime", (data) => {
    try {
      const {
        requestId,
        freelancerUsername,
        serviceRequestData,
        acceptedOffer,
      } = data;
      console.log(
        `✅ ${username} accepting offer from ${freelancerUsername} for request ${requestId}`
      );

      // Validate required fields
      if (!requestId || !freelancerUsername || !serviceRequestData || !acceptedOffer) {
        socket.emit("offer-acceptance-error", {
          requestId: requestId || "unknown",
          error: "Missing required data for offer acceptance",
        });
        return;
      }

      // Check if freelancer is online
      const freelancerSocketId = getUserSocketId(freelancerUsername);

      if (!freelancerSocketId) {
        // Freelancer OFFLINE - save order to database
        console.log(`📴 Freelancer ${freelancerUsername} is OFFLINE`);
        socket.emit("save-accepted-offer-to-database", {
          requestId,
          freelancerUsername,
          serviceRequestData: sanitizeForEmit(serviceRequestData),
          acceptedOffer: sanitizeForEmit(acceptedOffer),
          reason: "freelancer-offline",
        });
        return;
      }

      // Freelancer ONLINE - create order in activeOrders
      const orderId = serviceRequestData.requestId || requestId;

      const orderData = {
        orderId,
        clientUsername: username,
        freelancerUsername,
        customerInfo: {
          username: username,
          profilePicture: serviceRequestData.customerInfo?.profilePicture || null,
        },
        freelancerInfo: {
          username: freelancerUsername,
          profilePicture: acceptedOffer.freelancerInfo?.profilePicture || null,
        },
        budget: acceptedOffer.offeredPrice || serviceRequestData.willingPrice,
        priceToBePaid: acceptedOffer.offeredPrice || serviceRequestData.willingPrice,
        currency: serviceRequestData.currency || "USD",
        problemStatement: serviceRequestData.problemDescription,
        expertiseRequired: serviceRequestData.expertiseRequired || [],
        city: serviceRequestData.city,
        deadline: serviceRequestData.deadline,
        address: serviceRequestData.address,
        phoneNumber: serviceRequestData.phoneNumber,
        problemAudioId: serviceRequestData.problemAudioId,
        images: serviceRequestData.serviceImages || [],
        status: "pending",
        expectedReachTime: acceptedOffer.reachTime,
        createdAt: new Date(),
        negotiation: {
          isNegotiating: false,
          currentOfferTo: "",
          offeredPrice: 0,
        },
        fromServiceRequest: true,
      };

      // Store in activeOrders
      activeOrders.set(orderId, orderData);

      // Sanitize orderData before emitting
      const sanitizedOrderData = sanitizeForEmit(orderData);

      // Notify freelancer
      io.to(freelancerSocketId).emit("offer-accepted-realtime", {
        requestId,
        orderId,
        order: sanitizedOrderData,
        acceptedBy: username,
        message: "Your offer has been accepted!",
        acceptedAt: new Date().toISOString(),
      });

      // Notify all other offerors that request is fulfilled
      if (serviceRequestData.offers && serviceRequestData.offers.length > 1) {
        serviceRequestData.offers.forEach((offer) => {
          if (offer.freelancerInfo?.username !== freelancerUsername) {
            const otherFreelancerSocketId = getUserSocketId(
              offer.freelancerInfo.username
            );
            if (otherFreelancerSocketId) {
              io.to(otherFreelancerSocketId).emit("service-request-fulfilled", {
                requestId,
                fulfilledBy: freelancerUsername,
                message: "This service request has been fulfilled by another freelancer",
              });
            }
          }
        });
      }

      // Confirm to client
      socket.emit("offer-acceptance-success", {
        requestId,
        orderId,
        success: true,
        order: sanitizedOrderData,
        message: "Offer accepted and order created",
      });

      console.log(
        `✅ Offer accepted, order ${orderId} created and stored in activeOrders`
      );
    } catch (error) {
      console.error(`❌ Error accepting offer for request ${data.requestId}:`, error);
      socket.emit("offer-acceptance-error", {
        requestId: data.requestId || "unknown",
        error: "Failed to accept offer",
      });
    }
  });

  // ========================================
  // EVENT: DECLINE OFFER
  // ========================================
  socket.on("decline-offer-realtime", (data) => {
    try {
      const { requestId, freelancerUsername } = data;
      console.log(
        `❌ ${username} declining offer from ${freelancerUsername} for request ${requestId}`
      );

      // Validate required fields
      if (!requestId || !freelancerUsername) {
        socket.emit("offer-decline-error", {
          requestId: requestId || "unknown",
          error: "Missing required data for offer decline",
        });
        return;
      }

      // Check if freelancer is online
      const freelancerSocketId = getUserSocketId(freelancerUsername);

      if (!freelancerSocketId) {
        // Freelancer OFFLINE - save to database
        console.log(`📴 Freelancer ${freelancerUsername} is OFFLINE`);
        socket.emit("save-declined-offer-to-database", {
          requestId,
          freelancerUsername,
          reason: "freelancer-offline",
        });
        return;
      }

      // Notify freelancer
      io.to(freelancerSocketId).emit("offer-declined-realtime", {
        requestId,
        declinedBy: username,
        message: "Your offer was declined",
        declinedAt: new Date().toISOString(),
      });

      socket.emit("offer-decline-success", {
        requestId,
        freelancerUsername,
        success: true,
        message: "Offer declined",
      });

      console.log(`✅ Offer declined for request ${requestId}`);
    } catch (error) {
      console.error(`❌ Error declining offer for request ${data.requestId}:`, error);
      socket.emit("offer-decline-error", {
        requestId: data.requestId || "unknown",
        error: "Failed to decline offer",
      });
    }
  });

  // ========================================
  // EVENT: DELETE SERVICE REQUEST
  // ========================================
  socket.on("delete-service-request-realtime", (data) => {
    const { requestId } = data;
    console.log(`🗑️ ${username} deleting service request ${requestId}`);

    if (!requestId) {
      socket.emit("delete-request-error", {
        error: "Missing request ID",
      });
      return;
    }

    socket.emit("delete-request-success", {
      requestId,
      success: true,
      message: "Service request deleted",
    });

    console.log(`✅ Service request ${requestId} deletion acknowledged`);
  });

  // ========================================
  // DISCONNECTION HANDLER
  // ========================================
  socket.on("disconnect", (reason) => {
    console.log(`🔌 ${username} disconnected: ${reason}`);

    // Check for active orders
    const userOrders = Array.from(activeOrders.values()).filter(
      (order) =>
        order.clientUsername === username ||
        order.freelancerUsername === username
    );

    if (userOrders.length > 0) {
      console.log(`⚠️ ${username} has ${userOrders.length} active orders`);

      // Notify other party to save to database
      userOrders.forEach((order) => {
        const otherUsername =
          username === order.clientUsername
            ? order.freelancerUsername
            : order.clientUsername;

        const otherSocketId = getUserSocketId(otherUsername);

        if (otherSocketId) {
          io.to(otherSocketId).emit("save-order-to-database", {
            orderId: order.orderId,
            orderData: order,
            reason: "other-user-disconnected",
            disconnectedUser: username,
          });
        }

        // Remove order from memory
        activeOrders.delete(order.orderId);
      });
    }

    onlineUsers.delete(username);
    io.emit("online-users-count", onlineUsers.size);
    console.log(`📊 Online users: ${onlineUsers.size}`);
  });

  // ========================================
  // ERROR HANDLER
  // ========================================
  socket.on("error", (error) => {
    console.error(`⚠️ Socket error for ${username}:`, error);
  });
});

// ===== GRACEFUL SHUTDOWN =====
process.on("SIGTERM", () => {
  console.log("SIGTERM received, closing...");
  io.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("\nSIGINT received, closing...");
  io.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

// ===== START SERVER =====
httpServer
  .once("error", (err) => {
    console.error("❌ Server failed:", err);
    process.exit(1);
  })
  .listen(port, hostname, () => {
    console.log(`🚀 Socket.IO server at http://${hostname}:${port}`);
    console.log(`📡 Waiting for connections...`);
  });
