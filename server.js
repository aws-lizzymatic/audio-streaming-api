

const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);

const wss = new WebSocket.Server({
  noServer: true,
  maxPayload: 256 * 1024
});

const receivers = new Set();
let sender = null;

app.get("/", (req, res) => {
  res.json({ status: "Audio relay online" });
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    senderConnected: !!sender,
    receiversConnected: receivers.size
  });
});

server.on("upgrade", (req, socket, head) => {
  const pathname = new URL(
    req.url,
    "http://localhost"
  ).pathname;

  if (pathname !== "/sender" && pathname !== "/receiver") {
    socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
    socket.destroy();
    return;
  }

  if (pathname === "/sender" && sender) {
    socket.write("HTTP/1.1 409 Conflict\r\n\r\n");
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, ws => {
    ws.role = pathname;
    wss.emit("connection", ws, req);
  });
});

wss.on("connection", ws => {
  if (ws.role === "/receiver") {
    receivers.add(ws);
    console.log("Receiver connected");

    // Notify the receiver if the sender is already connected.
    ws.send(JSON.stringify({
      type: "status",
      senderConnected: !!sender
    }));

    ws.on("close", () => {
      receivers.delete(ws);
      console.log("Receiver disconnected");
    });

    ws.on("error", err => {
      console.error("Receiver error:", err.message);
    });

    return;
  }

  sender = ws;
  console.log("Sender connected");

  ws.on("message", (data, isBinary) => {
    // Forward metadata and audio chunks.
    let forwarded = 0;

    for (const receiver of receivers) {
      if (
        receiver.readyState === WebSocket.OPEN &&
        receiver.bufferedAmount < 1024 * 1024
      ) {
        receiver.send(data, { binary: isBinary });
        forwarded++;
      }
    }

    console.log(
      `Sender message: ${data.length} bytes; ` +
      `binary=${isBinary}; forwarded=${forwarded}`
    );
  });

  ws.on("close", () => {
    if (sender === ws) sender = null;
    console.log("Sender disconnected");
  });

  ws.on("error", err => {
    console.error("Sender error:", err.message);
  });
});

server.listen(process.env.PORT || 10000, "0.0.0.0", () => {
  console.log("Audio relay running");
});