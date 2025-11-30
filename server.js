// server.js
import { createServer } from "node:http";
import { Server } from "socket.io";
import { setSocketIOInstance } from "./src/Socket_IO/socketInstance.js";
import { jwtVerify } from "jose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Get directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env.local (same as Next.js)
dotenv.config({ path: join(__dirname, ".env.local") });

const hostname = "localhost";
const port = 4000;
const JWT_SECRET = process.env.JWT_SECRET;

// Validate JWT_SECRET exists
if (!JWT_SECRET) {
  console.error(
    "❌ FATAL ERROR: JWT_SECRET is not defined in environment variables"
  );
  console.error(
    "Please ensure .env.local file exists with JWT_SECRET=your-secret-key"
  );
  console.error("Current directory:", __dirname);
  process.exit(1);
}

console.log("✅ JWT_SECRET loaded successfully");

// Convert secret to Uint8Array for jose
const encoder = new TextEncoder();
const key = encoder.encode(JWT_SECRET);

// Store online users: Map<username, {socketId, userData}>
const onlineUsers = new Map();

// Create HTTP server
const httpServer = createServer((req, res) => {
  res.writeHead(200);
  res.end("🟢 Socket.IO server is running.");
});

// Attach Socket.IO with CORS configuration
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000", // Your Next.js frontend
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Authentication middleware for Socket.IO using jose
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error("Authentication error: No token provided"));
    }

    // Verify JWT token using jose (same as Next.js)
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });

    if (!payload || !payload.username) {
      return next(new Error("Authentication error: Invalid token payload"));
    }

    // Attach user data to socket
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

io.on("connection", (socket) => {
  const { username } = socket.userData;

  console.log(`✅ User connected: ${username} (${socket.id})`);

  // Add user to online users map
  onlineUsers.set(username, {
    socketId: socket.id,
    userData: socket.userData,
    connectedAt: new Date(),
  });

  // Notify user of successful connection
  socket.emit("authenticated", {
    success: true,
    username,
    message: "Successfully connected to real-time server",
  });

  // Broadcast online users count (optional)
  io.emit("online-users-count", onlineUsers.size);
  console.log(`📊 Online users: ${onlineUsers.size}`);

  // Test event - echo message
  socket.on("test-message", (data) => {
    console.log(`📩 Test message from ${username}:`, data);
    socket.emit("test-response", {
      success: true,
      originalMessage: data,
      timestamp: new Date().toISOString(),
      from: "server",
    });
  });

  // Check if user is online
  socket.on("check-user-online", (targetUsername) => {
    const isOnline = onlineUsers.has(targetUsername);
    console.log(`🔍 Checking if ${targetUsername} is online: ${isOnline}`);
    socket.emit("user-online-status", {
      username: targetUsername,
      isOnline,
    });
  });

  // Get all online users (for admin/debugging)
  socket.on("get-online-users", () => {
    const users = Array.from(onlineUsers.keys());
    console.log(`📋 Sending online users list:`, users);
    socket.emit("online-users-list", users);
  });

  // Handle disconnect
  socket.on("disconnect", (reason) => {
    console.log(
      `❌ User disconnected: ${username} (${socket.id}) - Reason: ${reason}`
    );

    // Remove user from online users
    onlineUsers.delete(username);

    // Broadcast updated online users count
    io.emit("online-users-count", onlineUsers.size);
    console.log(`📊 Online users: ${onlineUsers.size}`);
  });

  // Handle errors
  socket.on("error", (error) => {
    console.error(`⚠️ Socket error for ${username}:`, error);
  });
});

// Helper function to check if user is online (export for use in other modules)
export function isUserOnline(username) {
  return onlineUsers.has(username);
}

// Helper function to get user's socket ID
export function getUserSocketId(username) {
  return onlineUsers.get(username)?.socketId;
}

// Helper function to send message to specific user
export function sendToUser(username, event, data) {
  const userInfo = onlineUsers.get(username);
  if (userInfo) {
    io.to(userInfo.socketId).emit(event, data);
    return true;
  }
  return false;
}

// Helper function to broadcast to all online users
export function broadcastToAll(event, data) {
  io.emit(event, data);
}

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, closing Socket.IO server...");
  io.close(() => {
    console.log("Socket.IO server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("\nSIGINT received, closing Socket.IO server...");
  io.close(() => {
    console.log("Socket.IO server closed");
    process.exit(0);
  });
});

// Start the server
httpServer
  .once("error", (err) => {
    console.error("❌ Socket server failed:", err);
    process.exit(1);
  })
  .listen(port, hostname, () => {
    console.log(`🚀 Socket.IO server ready at http://${hostname}:${port}`);
    console.log(`📡 Waiting for authenticated connections...`);
    console.log(`🔑 Using JWT secret from: .env.local`);
  });
