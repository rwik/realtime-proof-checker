import { useEffect, useState, useRef } from "react";
import io from "socket.io-client";
import Editor from "@monaco-editor/react";

// === SOCKET CONNECTION ===
// Change to deployed URL when you deploy
const socket = io("http://localhost:5000");
// const socket = io("https://your-deployed-url.com");

const App = () => {
  const [joined, setJoined] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const [language, setLanguage] = useState("markdown");
  const [code, setCode] = useState(
    "# Manuscript Title\n\n**Authors:** ...\n\n## Abstract\n\nWrite or paste your abstract here...\n\n## Introduction\n"
  );
  const [copySuccess, setCopySuccess] = useState("");
  const [users, setUsers] = useState([]);
  const [typing, setTyping] = useState("");

  // Chat states
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const chatEndRef = useRef(null);

  useEffect(() => {
    socket.on("userJoined", (users) => setUsers(users));
    socket.on("codeUpdate", (newCode) => setCode(newCode));
    socket.on("userTyping", (user) => {
      setTyping(`${user.slice(0, 8)}... is typing`);
      setTimeout(() => setTyping(""), 3000);
    });
    socket.on("languageUpdate", (newLanguage) => setLanguage(newLanguage));

    socket.on("receiveMessage", (msgData) => {
      const timestamp = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      setMessages((prev) => [...prev, { ...msgData, timestamp }]);
    });

    socket.on("roomFull", (errorMsg) => {
      alert(errorMsg);
      setJoined(false);
      setRoomId("");
      setUserName("");
      setMessages([]);
    });

    return () => {
      socket.off("userJoined");
      socket.off("codeUpdate");
      socket.off("userTyping");
      socket.off("languageUpdate");
      socket.off("receiveMessage");
      socket.off("roomFull");
    };
  }, []);

  useEffect(() => {
    const handleBeforeUnload = () => socket.emit("leaveRoom");
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const joinRoom = () => {
    if (roomId.trim() && userName.trim()) {
      socket.emit("join", { roomId: roomId.trim(), userName: userName.trim() });
      setJoined(true);
    }
  };

  const leaveRoom = () => {
    socket.emit("leaveRoom");
    setJoined(false);
    setRoomId("");
    setUserName("");
    setCode("# Manuscript Title\n\n...");
    setLanguage("markdown");
    setMessages([]);
    setMessageInput("");
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopySuccess("Copied!");
    setTimeout(() => setCopySuccess(""), 2000);
  };

  const handleCodeChange = (newCode) => {
    setCode(newCode);
    socket.emit("codeChange", { roomId, code: newCode });
    socket.emit("typing", { roomId, userName });
  };

  const handleLanguageChange = (e) => {
    const newLang = e.target.value;
    setLanguage(newLang);
    socket.emit("languageChange", { roomId, language: newLang });
  };

  const sendMessage = () => {
    if (messageInput.trim()) {
      socket.emit("sendMessage", {
        roomId,
        userName,
        message: messageInput.trim(),
      });
      setMessageInput("");
    }
  };

  if (!joined) {
    return (
      <div
        style={{
          padding: "60px 20px",
          maxWidth: "600px",
          margin: "0 auto",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <h1 style={{ textAlign: "center", color: "#1a3c5e" }}>
          Manuscript Review Room
        </h1>
        <input
          type="text"
          placeholder="Room ID (share this with collaborators)"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          style={{ width: "100%", padding: "14px", margin: "16px 0", fontSize: "16px" }}
        />
        <input
          type="text"
          placeholder="Your Name / Reviewer Initials"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          style={{ width: "100%", padding: "14px", margin: "16px 0", fontSize: "16px" }}
        />
        <button
          onClick={joinRoom}
          style={{
            width: "100%",
            padding: "14px",
            fontSize: "17px",
            background: "#1a3c5e",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          Enter Review Session
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        fontFamily: "Georgia, serif",
        background: "#f8f9fa",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 24px",
          background: "#fff",
          borderBottom: "1px solid #ddd",
          display: "flex",
          alignItems: "center",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ margin: 0, color: "#1a3c5e" }}>
          Manuscript Review: {roomId}
        </h2>
        <button onClick={copyRoomId} style={{ padding: "8px 16px" }}>
          Copy Room ID
        </button>
        {copySuccess && <span style={{ color: "#28a745" }}>{copySuccess}</span>}

        <select
          value={language}
          onChange={handleLanguageChange}
          style={{ padding: "8px 12px" }}
        >
          <option value="markdown">Markdown (recommended)</option>
          <option value="plaintext">Plain Text</option>
          <option value="latex">LaTeX</option>
        </select>

        <div style={{ marginLeft: "auto", fontSize: "0.95em", color: "#555" }}>
          Participants: {users.length}/3 — {users.join(", ")}
          {typing && (
            <span style={{ color: "#666", fontStyle: "italic" }}>
              {" "}
              ({typing})
            </span>
          )}
        </div>

        <button
          onClick={leaveRoom}
          style={{
            background: "#dc3545",
            color: "white",
            border: "none",
            padding: "8px 16px",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Leave
        </button>
      </div>

      {/* Main content: side-by-side */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Editor (left) */}
        <div style={{ flex: 7, borderRight: "1px solid #ccc" }}>
          <div spellCheck="true" style={{ height: "100%", width: "100%" }}>
            <Editor
              height="100%"
              language={language}
              value={code}
              onChange={handleCodeChange}
              theme="vs" // light theme – better for long text editing
              options={{
                fontSize: 16,
                lineHeight: 28,
                minimap: { enabled: false },
                wordWrap: "on",
                padding: { top: 24, bottom: 24 },
                scrollBeyondLastLine: false,
                smoothScrolling: true,
                accessibilitySupport: "on",
              }}
            />
          </div>
        </div>

        {/* Chat / Remarks (right) */}
        <div
          style={{
            flex: 3,
            display: "flex",
            flexDirection: "column",
            background: "#fff",
            borderLeft: "1px solid #ccc",
          }}
        >
          <div
            style={{
              padding: "16px",
              borderBottom: "1px solid #ddd",
              fontWeight: "bold",
              color: "#1a3c5e",
            }}
          >
            Reviewer Remarks
            {typing && (
              <span
                style={{
                  color: "#777",
                  fontStyle: "italic",
                  fontSize: "0.9em",
                }}
              >
                {" "}
                — {typing}
              </span>
            )}
          </div>

          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  padding: "10px 14px",
                  background: "#f1f3f5",
                  borderRadius: "6px",
                  lineHeight: 1.5,
                }}
              >
                <div
                  style={{
                    fontSize: "0.85em",
                    color: "#666",
                    marginBottom: "4px",
                  }}
                >
                  {msg.timestamp} – <strong>{msg.userName}</strong>
                </div>
                {msg.message}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div
            style={{
              padding: "12px 16px",
              borderTop: "1px solid #ddd",
              display: "flex",
              gap: "10px",
            }}
          >
            <input
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Add comment / suggestion..."
              style={{
                flex: 1,
                padding: "12px",
                border: "1px solid #ccc",
                borderRadius: "4px",
                fontSize: "15px",
              }}
            />
            <button
              onClick={sendMessage}
              style={{
                padding: "12px 24px",
                background: "#1a3c5e",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;