// components/SocketTest.js
"use client";

import { useState, useEffect } from "react";
import { useSocket } from "@/Context/SocketContext";

export default function SocketTest() {
  const { isConnected, onlineUsersCount, emit, on, off } = useSocket();
  const [testMessage, setTestMessage] = useState("");
  const [responses, setResponses] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [userToCheck, setUserToCheck] = useState("");
  const [userStatus, setUserStatus] = useState(null);

  useEffect(() => {
    // Listen for test responses
    const handleTestResponse = (data) => {
      setResponses((prev) => [...prev, data]);
    };

    // Listen for online users list
    const handleOnlineUsersList = (users) => {
      setOnlineUsers(users);
    };

    // Listen for user online status
    const handleUserOnlineStatus = (data) => {
      setUserStatus(data);
    };

    on("test-response", handleTestResponse);
    on("online-users-list", handleOnlineUsersList);
    on("user-online-status", handleUserOnlineStatus);

    // Cleanup
    return () => {
      off("test-response", handleTestResponse);
      off("online-users-list", handleOnlineUsersList);
      off("user-online-status", handleUserOnlineStatus);
    };
  }, [on, off]);

  const sendTestMessage = () => {
    if (testMessage.trim()) {
      emit("test-message", { message: testMessage });
      setTestMessage("");
    }
  };

  const getOnlineUsers = () => {
    emit("get-online-users");
  };

  const checkUserOnline = () => {
    if (userToCheck.trim()) {
      emit("check-user-online", userToCheck);
    }
  };

  return (
    <div
      style={{
        padding: "20px",
        border: "2px solid #ccc",
        borderRadius: "8px",
        margin: "20px",
        maxWidth: "600px",
      }}
    >
      <h2>🧪 Socket.IO Test Panel</h2>

      {/* Connection Status */}
      <div style={{ marginBottom: "20px" }}>
        <p>
          Connection Status:{" "}
          <strong style={{ color: isConnected ? "green" : "red" }}>
            {isConnected ? "✅ Connected" : "❌ Disconnected"}
          </strong>
        </p>
        <p>
          Online Users: <strong>{onlineUsersCount}</strong>
        </p>
      </div>

      {/* Test Message */}
      <div style={{ marginBottom: "20px" }}>
        <h3>Send Test Message</h3>
        <input
          type="text"
          value={testMessage}
          onChange={(e) => setTestMessage(e.target.value)}
          placeholder="Enter test message"
          style={{
            padding: "8px",
            width: "70%",
            marginRight: "10px",
            border: "1px solid #ccc",
            borderRadius: "4px",
          }}
          onKeyPress={(e) => e.key === "Enter" && sendTestMessage()}
        />
        <button
          onClick={sendTestMessage}
          disabled={!isConnected}
          style={{
            padding: "8px 16px",
            backgroundColor: isConnected ? "#007bff" : "#ccc",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: isConnected ? "pointer" : "not-allowed",
          }}
        >
          Send
        </button>
      </div>

      {/* Responses */}
      {responses.length > 0 && (
        <div style={{ marginBottom: "20px" }}>
          <h3>Responses:</h3>
          <div
            style={{
              maxHeight: "150px",
              overflowY: "auto",
              border: "1px solid #ddd",
              padding: "10px",
              borderRadius: "4px",
              backgroundColor: "#f9f9f9",
            }}
          >
            {responses.map((resp, idx) => (
              <div key={idx} style={{ marginBottom: "8px" }}>
                <strong>Message:</strong> {resp.originalMessage}
                <br />
                <small>
                  Time: {new Date(resp.timestamp).toLocaleTimeString()}
                </small>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Get Online Users */}
      <div style={{ marginBottom: "20px" }}>
        <h3>Get Online Users</h3>
        <button
          onClick={getOnlineUsers}
          disabled={!isConnected}
          style={{
            padding: "8px 16px",
            backgroundColor: isConnected ? "#28a745" : "#ccc",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: isConnected ? "pointer" : "not-allowed",
          }}
        >
          Fetch Online Users
        </button>
        {onlineUsers.length > 0 && (
          <div style={{ marginTop: "10px" }}>
            <strong>Online Users:</strong>
            <ul>
              {onlineUsers.map((user, idx) => (
                <li key={idx}>{user}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Check Specific User */}
      <div>
        <h3>Check User Status</h3>
        <input
          type="text"
          value={userToCheck}
          onChange={(e) => setUserToCheck(e.target.value)}
          placeholder="Enter username"
          style={{
            padding: "8px",
            width: "70%",
            marginRight: "10px",
            border: "1px solid #ccc",
            borderRadius: "4px",
          }}
          onKeyPress={(e) => e.key === "Enter" && checkUserOnline()}
        />
        <button
          onClick={checkUserOnline}
          disabled={!isConnected}
          style={{
            padding: "8px 16px",
            backgroundColor: isConnected ? "#17a2b8" : "#ccc",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: isConnected ? "pointer" : "not-allowed",
          }}
        >
          Check
        </button>
        {userStatus && (
          <div style={{ marginTop: "10px" }}>
            <strong>{userStatus.username}</strong> is{" "}
            <span style={{ color: userStatus.isOnline ? "green" : "red" }}>
              {userStatus.isOnline ? "ONLINE" : "OFFLINE"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
