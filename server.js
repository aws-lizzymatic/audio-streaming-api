const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "Microphone API is running",
    websocket: "/audio"
  });
});

const wss = new WebSocket.Server({
  server,
  path: "/audio"
});

wss.on("connection", (socket) => {
  socket.send(JSON.stringify({
    type: "connected",
    message: "WebSocket connected"
  }));

  socket.on("message", (data, isBinary) => {
    console.log(
      isBinary ? `Received ${data.length} audio bytes` : data.toString()
    );
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on port ${PORT}`);
});