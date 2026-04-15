import http from "node:http";
import { WebSocketServer } from "ws";

const PORT = Number(process.env.PORT || 8080);

/**
 * In-memory rooms. This is enough for testing.
 * If the server restarts, rooms are lost.
 */
const rooms = new Map(); // code -> room

function publicRoom(room) {
  return {
    code: room.code,
    stake: room.stake,
    host: room.host,
    guest: room.guest,
    questions: room.questions,
    status: room.status,
    countdownStart: room.countdownStart,
    currentQ: room.currentQ,
    hostScore: room.hostScore,
    guestScore: room.guestScore,
  };
}

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 4; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function createRoomCode() {
  for (let i = 0; i < 50; i++) {
    const code = genCode();
    if (!rooms.has(code)) return code;
  }
  throw new Error("Failed to generate unique room code");
}

function safeSend(ws, obj) {
  if (ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify(obj));
}

function broadcast(code, obj) {
  const room = rooms.get(code);
  if (!room) return;
  for (const ws of room.clients) safeSend(ws, obj);
}

function now() {
  return Date.now();
}

const server = http.createServer((req, res) => {
  // Health check for Render/Fly/etc.
  if (req.url === "/healthz") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, time: now() }));
    return;
  }
  res.writeHead(200, { "content-type": "text/plain" });
  res.end("HAMON WebSocket server\n");
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  ws._meta = { code: null, role: null, name: null };

  safeSend(ws, { type: "hello", time: now() });

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      safeSend(ws, { type: "error", message: "Invalid JSON" });
      return;
    }

    if (!msg || typeof msg.type !== "string") {
      safeSend(ws, { type: "error", message: "Invalid message" });
      return;
    }

    if (msg.type === "create") {
      const name = String(msg.name || "Player 1").slice(0, 16);
      const stake = Number(msg.stake || 25);
      const questions = Array.isArray(msg.questions) ? msg.questions : [];

      const code = createRoomCode();
      const room = {
        code,
        stake,
        questions,
        host: name,
        guest: null,
        status: "waiting", // waiting | countdown | question | results
        countdownStart: null,
        currentQ: 0,
        hostScore: 0,
        guestScore: 0,
        hostAnswers: {},
        guestAnswers: {},
        clients: new Set(),
        updatedAt: now(),
      };
      rooms.set(code, room);

      ws._meta = { code, role: "host", name };
      room.clients.add(ws);

      safeSend(ws, {
        type: "created",
        code,
        room: publicRoom(room),
      });

      return;
    }

    if (msg.type === "join") {
      const code = String(msg.code || "").toUpperCase().trim();
      const name = String(msg.name || "Player 2").slice(0, 16);

      const room = rooms.get(code);
      if (!room) {
        safeSend(ws, { type: "join_error", message: "Room not found" });
        return;
      }
      if (room.guest) {
        safeSend(ws, { type: "join_error", message: "Room full" });
        return;
      }
      if (room.status !== "waiting") {
        safeSend(ws, { type: "join_error", message: "Game already started" });
        return;
      }

      room.guest = name;
      room.updatedAt = now();

      ws._meta = { code, role: "guest", name };
      room.clients.add(ws);

      safeSend(ws, {
        type: "joined",
        code,
        room: publicRoom(room),
      });

      broadcast(code, { type: "guest_joined", guest: name, room: publicRoom(room) });
      return;
    }

    // Everything below requires the socket to be in a room
    const code = ws._meta.code;
    const role = ws._meta.role;
    if (!code || !role) {
      safeSend(ws, { type: "error", message: "Not in a room" });
      return;
    }

    const room = rooms.get(code);
    if (!room) {
      safeSend(ws, { type: "error", message: "Room does not exist" });
      return;
    }

    if (msg.type === "start_countdown") {
      if (role !== "host") return;
      if (!room.guest) return;

      room.status = "countdown";
      room.countdownStart = now();
      room.updatedAt = now();

      broadcast(code, { type: "countdown", countdownStart: room.countdownStart, room: publicRoom(room) });
      return;
    }

    if (msg.type === "answer") {
      const q = Number(msg.q);
      const index = Number(msg.index);

      const answerKey = role === "host" ? "hostAnswers" : "guestAnswers";
      const scoreKey = role === "host" ? "hostScore" : "guestScore";

      room[answerKey][String(q)] = index;
      room[scoreKey] = Number(msg.score || room[scoreKey] || 0);
      room.updatedAt = now();

      const oppRole = role === "host" ? "guest" : "host";
      broadcast(code, {
        type: "opp_answer",
        q,
        by: role,
        index,
        hostScore: room.hostScore,
        guestScore: room.guestScore,
      });

      const bothAnswered =
        room.hostAnswers[String(q)] !== undefined &&
        room.guestAnswers[String(q)] !== undefined;

      if (bothAnswered) {
        broadcast(code, {
          type: "both_answered",
          q,
          hostScore: room.hostScore,
          guestScore: room.guestScore,
        });
      }
      return;
    }

    if (msg.type === "leave") {
      // Client-initiated leave: delete the room if host leaves, otherwise detach guest.
      if (role === "host") {
        broadcast(code, { type: "room_closed" });
        rooms.delete(code);
      } else {
        room.guest = null;
        room.guestAnswers = {};
        room.guestScore = 0;
        room.updatedAt = now();
        broadcast(code, { type: "guest_left" });
      }
      return;
    }
  });

  ws.on("close", () => {
    const { code, role } = ws._meta || {};
    if (!code || !role) return;
    const room = rooms.get(code);
    if (!room) return;
    room.clients.delete(ws);

    // If nobody is connected anymore, clean up the room.
    if (room.clients.size === 0) rooms.delete(code);
  });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`HAMON WebSocket server listening on :${PORT}`);
});

