// server.js - COMPLETE IMPLEMENTATION
import { createServer } from "node:http";
import { Server } from "socket.io";
import { setSocketIOInstance } from "./src/Socket_IO/socketInstance.js";
import { jwtVerify } from "jose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

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

// ===== ONLINE USERS STORAGE =====
const onlineUsers = new Map();

// ===== ACTIVE ORDERS STORAGE (IN MEMORY) =====
const activeOrders = new Map();

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

    socket.userData = {
      username: payload.username,
      userId: payload.userId || payload.username,
    };

    console.log("✅ User authenticated:", payload.username);
    next();
  } catch (error) {
    console.error("❌ Socket authentication error:", error.message);
    next(new Error("Authentication error: " + error.message));
  }
});

setSocketIOInstance(io);

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

  // ===== CHECK USER ONLINE =====
  socket.on("check-user-online", (targetUsername) => {
    const isOnline = onlineUsers.has(targetUsername);
    console.log(
      `🔍 ${username} checking if ${targetUsername} is online: ${isOnline}`
    );
    socket.emit("user-online-status", {
      username: targetUsername,
      isOnline,
    });
  });

  // ===== SEND ORDER REALTIME =====
  socket.on("send-order-realtime", (data) => {
    console.log(`📦 ${username} sending order to ${data.freelancerUsername}`);

    const { freelancerUsername, orderData } = data;
    const freelancerInfo = onlineUsers.get(freelancerUsername);

    if (!freelancerInfo) {
      // Freelancer offline
      console.log(`📴 ${freelancerUsername} is offline`);
      socket.emit("order-status", {
        orderId: orderData.orderId,
        success: false,
        isOnline: false,
        message: "Freelancer is offline",
      });
      return;
    }

    // Freelancer online - store in memory
    activeOrders.set(orderData.orderId, {
      ...orderData,
      clientUsername: username,
      freelancerUsername,
      status: "pending",
      createdAt: new Date(),
    });

    // Send to freelancer
    io.to(freelancerInfo.socketId).emit("new-order-realtime", {
      ...orderData,
      clientUsername: username,
      clientProfilePicture: socket.userData.profilePicture || "",
    });

    // Confirm to client
    socket.emit("order-status", {
      orderId: orderData.orderId,
      success: true,
      isOnline: true,
      message: "Order sent in real-time",
    });

    console.log(`✅ Order ${orderData.orderId} sent to ${freelancerUsername}`);
  });

  // ===== FREELANCER RESPONDS TO ORDER =====
  socket.on("order-response-realtime", (data) => {
    console.log(
      `📬 ${username} responding to order ${data.orderId}: ${data.response}`
    );

    const { orderId, response, newPrice, message } = data;
    const order = activeOrders.get(orderId);

    if (!order) {
      socket.emit("response-error", {
        orderId,
        error: "Order not found",
      });
      return;
    }

    const clientInfo = onlineUsers.get(order.clientUsername);

    if (!clientInfo) {
      // Client offline - save to database
      console.log(
        `📴 Client ${order.clientUsername} offline - need to save to DB`
      );
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

    // ===== HANDLE RESPONSE TYPES =====

    if (response === "accept") {
      // Freelancer accepts
      order.status = "accepted";
      order.acceptedAt = new Date();
      activeOrders.set(orderId, order);

      // Notify client
      io.to(clientInfo.socketId).emit("order-accepted-realtime", {
        orderId,
        freelancerUsername: username,
        finalPrice: order.budget,
        currency: order.currency,
        message: message || "Freelancer accepted your order",
      });

      // Confirm to freelancer
      socket.emit("response-sent", {
        success: true,
        orderId,
        action: "accepted",
      });

      console.log(`✅ Order ${orderId} accepted`);
    } else if (response === "reject") {
      // Freelancer rejects
      io.to(clientInfo.socketId).emit("order-rejected-realtime", {
        orderId,
        freelancerUsername: username,
        message: message || "Freelancer declined your order",
      });

      socket.emit("response-sent", {
        success: true,
        orderId,
        action: "rejected",
      });

      activeOrders.delete(orderId);
      console.log(`❌ Order ${orderId} rejected`);
    } else if (response === "counter") {
      // Freelancer counters
      if (!newPrice || newPrice <= 0) {
        socket.emit("response-error", {
          orderId,
          error: "Invalid counter price",
        });
        return;
      }

      order.status = "offer-received";
      order.negotiation = {
        isNegotiating: true,
        currentOfferTo: "client",
        offeredPrice: newPrice,
      };
      activeOrders.set(orderId, order);

      // Notify client
      io.to(clientInfo.socketId).emit("order-counter-offer-realtime", {
        orderId,
        freelancerUsername: username,
        newPrice,
        currency: order.currency,
        message: message || `Freelancer offered ${newPrice} ${order.currency}`,
      });

      socket.emit("response-sent", {
        success: true,
        orderId,
        action: "countered",
      });

      console.log(`💰 Order ${orderId} countered: ${newPrice}`);
    }
  });

  // ===== CLIENT RESPONDS TO COUNTER OFFER =====
  socket.on("counter-response-realtime", (data) => {
    console.log(`💬 ${username} responding to counter: ${data.response}`);

    const { orderId, response, newPrice, message } = data;
    const order = activeOrders.get(orderId);

    if (!order) {
      socket.emit("response-error", {
        orderId,
        error: "Order not found",
      });
      return;
    }

    const freelancerInfo = onlineUsers.get(order.freelancerUsername);

    if (!freelancerInfo) {
      // Freelancer offline - save to database
      console.log(`📴 Freelancer offline during negotiation`);
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
      // Client accepts counter
      order.status = "accepted";
      order.budget = order.negotiation.offeredPrice;
      order.acceptedAt = new Date();
      activeOrders.set(orderId, order);

      // Notify freelancer
      io.to(freelancerInfo.socketId).emit("counter-accepted-realtime", {
        orderId,
        clientUsername: username,
        finalPrice: order.budget,
        message: "Client accepted your offer",
      });

      // Tell client to show location modal & save to DB
      socket.emit("order-accepted-realtime", {
        orderId,
        freelancerUsername: order.freelancerUsername,
        finalPrice: order.budget,
        currency: order.currency,
        message: "You accepted the offer",
      });

      socket.emit("response-sent", {
        success: true,
        orderId,
        action: "accepted",
      });

      console.log(`✅ Counter accepted for order ${orderId}`);
    } else if (response === "reject") {
      // Client rejects counter
      io.to(freelancerInfo.socketId).emit("counter-rejected-realtime", {
        orderId,
        clientUsername: username,
        message: "Client declined your offer",
      });

      socket.emit("response-sent", {
        success: true,
        orderId,
        action: "rejected",
      });

      activeOrders.delete(orderId);
      console.log(`❌ Counter rejected for order ${orderId}`);
    } else if (response === "counter-back") {
      // Client counters back
      if (!newPrice || newPrice <= 0) {
        socket.emit("response-error", {
          orderId,
          error: "Invalid counter price",
        });
        return;
      }

      order.status = "offer-given";
      order.negotiation = {
        isNegotiating: true,
        currentOfferTo: "freelancer",
        offeredPrice: newPrice,
      };
      activeOrders.set(orderId, order);

      // Notify freelancer
      io.to(freelancerInfo.socketId).emit("client-counter-offer-realtime", {
        orderId,
        clientUsername: username,
        newPrice,
        currency: order.currency,
        message: message || `Client offered ${newPrice} ${order.currency}`,
      });

      socket.emit("response-sent", {
        success: true,
        orderId,
        action: "countered",
      });

      console.log(`💰 Client counter for order ${orderId}: ${newPrice}`);
    }
  });

  // ===== GET ONLINE USERS =====
  socket.on("get-online-users", () => {
    const users = Array.from(onlineUsers.keys());
    console.log(`📋 Sending online users list:`, users);
    socket.emit("online-users-list", users);
  });

  // ===== DISCONNECT =====
  socket.on("disconnect", (reason) => {
    console.log(`❌ ${username} disconnected - Reason: ${reason}`);

    // Check for active orders
    const userActiveOrders = Array.from(activeOrders.values()).filter(
      (order) =>
        order.clientUsername === username ||
        order.freelancerUsername === username
    );

    if (userActiveOrders.length > 0) {
      console.log(
        `⚠️ ${username} has ${userActiveOrders.length} active orders`
      );

      userActiveOrders.forEach((order) => {
        const otherUsername =
          order.clientUsername === username
            ? order.freelancerUsername
            : order.clientUsername;

        const otherUserInfo = onlineUsers.get(otherUsername);

        if (otherUserInfo) {
          io.to(otherUserInfo.socketId).emit("save-order-to-database", {
            orderId: order.orderId,
            orderData: order,
            reason: "other-user-disconnected",
            disconnectedUser: username,
          });
        }

        activeOrders.delete(order.orderId);
      });
    }

    onlineUsers.delete(username);
    io.emit("online-users-count", onlineUsers.size);
    console.log(`📊 Online users: ${onlineUsers.size}`);
  });

  // ===== ERROR =====
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
