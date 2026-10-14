const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);

const wss = new WebSocket.Server({ noServer: true });
const receivers = new Set();

app.get("/", (_, res) => {
  res.json({ status: "Audio relay online" });
});

server.on("upgrade", (req, socket, head) => {
  const path = new URL(req.url, "http://localhost").pathname;

  if (path !== "/sender" && path !== "/receiver") {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, ws => {
    ws.role = path;
    wss.emit("connection", ws);
  });
});

wss.on("connection", ws => {
  if (ws.role === "/receiver") {
    receivers.add(ws);
    ws.on("close", () => receivers.delete(ws));
    return;
  }

  ws.on("message", (audio, isBinary) => {
    if (!isBinary) return;

    for (const receiver of receivers) {
      if (receiver.readyState === WebSocket.OPEN) {
        receiver.send(audio, { binary: true });
      }
    }
  });
});

server.listen(process.env.PORT || 10000, "0.0.0.0", () => {
  console.log("Audio relay running");
});