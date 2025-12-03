// backend/worker/worker.js
// Worker process using non-blocking rpop + polling (compatible with Upstash).
// Emits task:update via Socket.IO (port 7000).
// Robust JSON parsing, dead-letter queue, retries, and minimal task handlers.

import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import os from "os";
import axios from "axios";
import http from "http";
import { Server as SocketIOServer } from "socket.io";

import redis from "../utils/redisClient.js"; // your redis client (Upstash or ioredis)
import Execution from "../models/Execution.js";
import WorkerModel from "../models/Worker.js";

const SOCKET_PORT = process.env.WORKER_SOCKET_PORT || 7000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/taskScheduler";
const REDIS_QUEUE = "queue:tasks";
const DEAD_LETTER_QUEUE = "queue:tasks:dead";
const POLL_DELAY_MS = 1000; // 1 second polling when queue is empty
const HEARTBEAT_INTERVAL_MS = 5000;

// ---------------- Socket.IO server ----------------
const httpServer = http.createServer();
const io = new SocketIOServer(httpServer, { cors: { origin: "*" } });

httpServer.listen(SOCKET_PORT, () => {
  console.log(`📡 Worker WebSocket: ${SOCKET_PORT}`);
});

io.on("connection", (socket) => {
  console.log("🟢 UI client connected to worker socket:", socket.id);
  socket.on("disconnect", () => {
    console.log("🔴 UI client disconnected:", socket.id);
  });
});

// ---------------- MongoDB connect ----------------
mongoose.set("strictQuery", false);
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ Worker connected to MongoDB"))
  .catch((err) => {
    console.error("❌ MongoDB connection error in worker:", err);
    process.exit(1);
  });

// ---------------- Worker identity & heartbeat ----------------
const WORKER_ID = `worker-${os.hostname()}-${Math.floor(Math.random() * 10000)}`;
console.log(`⚙️ Worker started: ${WORKER_ID}`);

const heartbeat = async () => {
  try {
    const cpuLoad = os.loadavg ? os.loadavg()[0] : 0;
    const memoryMB = Math.round((os.totalmem() - os.freemem()) / 1024 / 1024);

    await WorkerModel.findOneAndUpdate(
      { workerId: WORKER_ID },
      {
        workerId: WORKER_ID,
        status: "active",
        lastHeartbeat: new Date(),
        cpu: cpuLoad,
        memory: memoryMB
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.error("Heartbeat error:", err);
  }
};
setInterval(heartbeat, HEARTBEAT_INTERVAL_MS);
heartbeat().catch(() => {});

// ---------------- Helpers ----------------
const safeJsonParse = (raw) => {
  if (raw == null) return null;
  try {
    if (Buffer.isBuffer(raw)) raw = raw.toString("utf8");
  } catch (e) {}
  if (typeof raw === "object") return raw;
  if (typeof raw !== "string") {
    try { raw = String(raw); } catch (e) { return null; }
  }
  try { return JSON.parse(raw); } catch (e) { return null; }
};

const moveToDeadLetter = async (raw, reason = "") => {
  try {
    const payload = { raw: typeof raw === "string" ? raw : String(raw), reason, movedAt: new Date() };
    await redis.lpush(DEAD_LETTER_QUEUE, JSON.stringify(payload));
  } catch (err) {
    console.error("Failed to push to dead-letter queue:", err);
  }
};

// ---------------- Task executor ----------------
/**
 * payload: { executionId, dagId, task: { id, type, name, config }, attempt? }
 */
const executeTask = async (payload) => {
  if (!payload || !payload.task || !payload.executionId) {
    console.warn("Invalid task payload:", payload);
    return;
  }

  const { executionId, task, attempt = 1 } = payload;
  let execDoc = null;

  try { execDoc = await Execution.findById(executionId); } catch (err) { console.error("Fetch Execution error:", err); }

  // Emit started
  io.emit("task:update", { executionId, taskId: task.id, status: "started", name: task.name, attempt, timestamp: new Date() });

  // Append running record (best-effort)
  try {
    if (execDoc) {
      execDoc.tasks.push({ nodeId: task.id, name: task.name, status: "running", attempts: attempt, startedAt: new Date() });
      await execDoc.save();
    }
  } catch (err) { console.warn("Append running record error:", err); }

  const finalize = async (status, info = {}) => {
    try {
      if (execDoc) {
        const t = execDoc.tasks.slice().reverse().find((x) => x.nodeId === task.id);
        if (t) {
          t.status = status;
          t.completedAt = new Date();
          if (status === "success") t.output = info.output ?? null;
          if (status === "failed") t.error = info.error ?? String(info);
        } else {
          execDoc.tasks.push({
            nodeId: task.id, name: task.name, status, attempts: attempt, startedAt: new Date(), completedAt: new Date(), error: info.error ?? null, output: info.output ?? null
          });
        }
        await execDoc.save();
      }

      io.emit("task:update", { executionId, taskId: task.id, status, name: task.name, attempt, timestamp: new Date(), ...info });
    } catch (err) {
      console.error("Finalize error:", err);
    }
  };

  try {
    if (task.type === "http") {
      const method = (task.config?.method ?? "get").toLowerCase();
      const url = task.config?.url;
      if (!url) throw new Error("HTTP task missing URL");
      const axiosOptions = { method, url, headers: task.config?.headers || {}, timeout: (task.config?.timeoutSeconds || 30) * 1000 };
      const response = await axios(axiosOptions);
      await finalize("success", { output: { status: response.status, data: response.data } });
      console.log(`✅ HTTP task "${task.name}" succeeded`);
      return;
    }

    if (task.type === "script") {
      const simulated = `Simulated script: ${task.config?.script ?? "<no-script>"}`;
      await finalize("success", { output: simulated });
      console.log(`✅ Script task "${task.name}" simulated success`);
      return;
    }

    if (task.type === "email") {
      const simulated = { to: task.config?.to, subject: task.config?.subject, body: task.config?.body, note: "Email simulated" };
      await finalize("success", { output: simulated });
      console.log(`✅ Email task "${task.name}" simulated`);
      return;
    }

    throw new Error(`Unsupported task type: ${task.type}`);
  } catch (err) {
    console.warn(`Task "${task.name}" attempt ${attempt} failed:`, err.message ?? err);

    const maxRetries = Number(task.config?.retries ?? 3);
    const retryDelayMs = Number(task.config?.retryDelay ?? 2000);

    if (attempt < maxRetries) {
      setTimeout(async () => {
        const requeue = { ...payload, attempt: attempt + 1 };
        try {
          await redis.lpush(REDIS_QUEUE, JSON.stringify(requeue));
          io.emit("task:update", { executionId, taskId: task.id, status: "retry_scheduled", name: task.name, attempt: attempt + 1, retryInMs: retryDelayMs, timestamp: new Date() });
        } catch (pushErr) {
          console.error("Requeue failed:", pushErr);
          await moveToDeadLetter(requeue, "requeue_failed:" + String(pushErr));
        }
      }, retryDelayMs);

      await finalize("retrying", { error: err.message });
    } else {
      await moveToDeadLetter(payload, "max_retries_exceeded:" + String(err.message));
      await finalize("failed", { error: String(err.message) });
      console.error(`❌ Task "${task.name}" permanently failed after ${attempt} attempts`);
    }
  }
};

// ---------------- Main polling loop (non-blocking rpop) ----------------
const listen = async () => {
  console.log(`🔁 Worker listening for tasks on Redis queue "${REDIS_QUEUE}" using rpop + polling...`);
  while (true) {
    try {
      // Use rpop (non-blocking). Upstash and some clients support rpop.
      let raw;
      try {
        raw = await redis.rpop(REDIS_QUEUE);
      } catch (redisErr) {
        console.error("Redis rpop error:", redisErr);
        // Wait a bit before retrying if Redis call failed
        await new Promise((r) => setTimeout(r, POLL_DELAY_MS));
        continue;
      }

      if (!raw) {
        // nothing in queue — sleep a bit
        await new Promise((r) => setTimeout(r, POLL_DELAY_MS));
        continue;
      }

      const parsed = safeJsonParse(raw);
      if (!parsed) {
        console.error("⚠ Invalid JSON popped from Redis:", raw);
        await moveToDeadLetter(raw, "invalid_json");
        continue;
      }

      // Execute parsed task
      await executeTask(parsed);
    } catch (err) {
      console.error("Worker loop error:", err);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
};

// Start listening
listen().catch((err) => {
  console.error("Fatal listener error:", err);
  process.exit(1);
});

// Graceful shutdown
const shutdown = async () => {
  console.log("Shutting down worker...");
  try { await WorkerModel.findOneAndUpdate({ workerId: WORKER_ID }, { status: "draining" }); } catch (e) {}
  try { httpServer.close(); } catch (e) {}
  try { await mongoose.disconnect(); } catch (e) {}
  try { await redis.quit(); } catch (e) {}
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
