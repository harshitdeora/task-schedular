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
import DAG from "../models/Dag.js";
import * as taskExecutors from "./taskExecutors.js";

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

// Track current task count
let currentTaskCount = 0;

const heartbeat = async () => {
  try {
    const cpuLoad = os.loadavg ? os.loadavg()[0] : 0;
    const memoryMB = Math.round((os.totalmem() - os.freemem()) / 1024 / 1024);
    
    // Determine status based on activity
    let status = "idle";
    if (currentTaskCount > 0) {
      status = "busy";
    }

    const worker = await WorkerModel.findOneAndUpdate(
      { workerId: WORKER_ID },
      {
        workerId: WORKER_ID,
        status: status,
        lastHeartbeat: new Date(),
        cpu: cpuLoad,
        memory: memoryMB,
        tasksInProgress: currentTaskCount,
        $setOnInsert: { startedAt: new Date() } // Only set on first insert
      },
      { upsert: true, new: true }
    );
    
    // If worker exists but doesn't have startedAt, set it
    if (worker && !worker.startedAt) {
      await WorkerModel.findByIdAndUpdate(worker._id, { startedAt: new Date() });
    }
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

// Helper to update worker task counts
const updateWorkerTaskCount = async (incrementCompleted = 0, incrementFailed = 0) => {
  try {
    const update = {};
    if (incrementCompleted > 0) {
      update.$inc = { tasksCompleted: incrementCompleted };
    }
    if (incrementFailed > 0) {
      if (!update.$inc) update.$inc = {};
      update.$inc.tasksFailed = incrementFailed;
    }
    if (Object.keys(update).length > 0) {
      await WorkerModel.findOneAndUpdate({ workerId: WORKER_ID }, update);
    }
  } catch (err) {
    console.error("Update worker task count error:", err);
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

  const { executionId, dagId, task, attempt = 1, userId } = payload;
  let execDoc = null;
  let dagDoc = null;

  // Increment task count
  currentTaskCount++;

  try { 
    execDoc = await Execution.findById(executionId);
    if (dagId) {
      dagDoc = await DAG.findById(dagId);
    }
  } catch (err) { 
    console.error("Fetch Execution/DAG error:", err); 
  }

  // Emit started
  io.emit("task:update", { executionId, taskId: task.id, status: "started", name: task.name, attempt, timestamp: new Date() });

  // Append running record (best-effort)
  try {
    if (execDoc) {
      const taskStartTime = new Date();
      execDoc.tasks.push({ nodeId: task.id, name: task.name, status: "running", attempts: attempt, startedAt: taskStartTime });
      
      // Ensure execution timeline.startedAt is set when first task starts
      if (!execDoc.timeline) execDoc.timeline = {};
      if (!execDoc.timeline.startedAt) {
        execDoc.timeline.startedAt = taskStartTime;
      }
      
      // Mark execution as running if still queued
      if (execDoc.status === "queued") {
        execDoc.status = "running";
      }
      
      await execDoc.save();
    }
  } catch (err) { console.warn("Append running record error:", err); }

  const finalize = async (status, info = {}) => {
    try {
      // Decrement task count
      currentTaskCount = Math.max(0, currentTaskCount - 1);

      if (execDoc) {
        // Find the task entry (look for the most recent one with matching nodeId)
        const t = execDoc.tasks.slice().reverse().find((x) => x.nodeId === task.id);
        
        // Check if this is a scheduled task (not yet completed)
        // Also check if status itself is "scheduled" (passed directly)
        const isScheduled = status === "scheduled" || (info.scheduled === true && info.taskStatus === "scheduled");
        
        if (t) {
          // If task is scheduled, mark as "scheduled" instead of "success"
          if (isScheduled) {
            t.status = "scheduled";
            // Don't set completedAt for scheduled tasks
          } else {
            t.status = status;
            t.completedAt = new Date();
            if (status === "success") t.output = info.output ?? null;
            if (status === "failed") t.error = info.error ?? String(info);
          }
        } else {
          // Task not found, add new entry
          if (isScheduled) {
            execDoc.tasks.push({
              nodeId: task.id, 
              name: task.name, 
              status: "scheduled", 
              attempts: attempt, 
              startedAt: new Date(), 
              // Don't set completedAt for scheduled tasks
              error: null, 
              output: info.message || null
            });
          } else {
            execDoc.tasks.push({
              nodeId: task.id, 
              name: task.name, 
              status, 
              attempts: attempt, 
              startedAt: new Date(), 
              completedAt: new Date(), 
              error: info.error ?? null, 
              output: info.output ?? null
            });
          }
        }
        
        // Save the task update first
        await execDoc.save();
        
        // If task completed successfully (not scheduled), check for dependent tasks to enqueue
        // Scheduled tasks will trigger dependent tasks when they actually complete (when email is sent)
        if (status === "success" && !isScheduled && dagDoc && dagDoc.graph) {
          await enqueueDependentTasks(task.id, execDoc, dagDoc);
        }
        
        // Refetch execution from DB to get latest state (important for concurrent tasks)
        // Use execDoc directly since we just saved it, but refresh to ensure we have latest from DB
        const freshExecDoc = await Execution.findById(executionId);
        if (freshExecDoc) {
          // Check if execution should be marked as complete
          await checkAndUpdateExecutionStatus(freshExecDoc, dagDoc);
        } else {
          // Fallback: use the execDoc we just saved
          await checkAndUpdateExecutionStatus(execDoc, dagDoc);
        }
      }

      // Update worker task counts
      if (status === "success") {
        await updateWorkerTaskCount(1, 0);
      } else if (status === "failed") {
        await updateWorkerTaskCount(0, 1);
      }

      // Emit task update with correct status (use "scheduled" if task is scheduled, otherwise use the status)
      const emitStatus = isScheduled ? "scheduled" : status;
      io.emit("task:update", { executionId, taskId: task.id, status: emitStatus, name: task.name, attempt, timestamp: new Date(), ...info });
    } catch (err) {
      console.error("Finalize error:", err);
      // Still decrement task count even on error
      currentTaskCount = Math.max(0, currentTaskCount - 1);
    }
  };

  // Helper function to enqueue dependent tasks after a task completes
  const enqueueDependentTasks = async (completedTaskId, execDoc, dagDoc) => {
    try {
      if (!dagDoc || !dagDoc.graph || !dagDoc.graph.edges) {
        return;
      }

      const edges = dagDoc.graph.edges;
      const nodes = dagDoc.graph.nodes || [];
      
      // Get userId from execution document
      const executionUserId = execDoc.userId ? execDoc.userId.toString() : null;
      
      // Find all tasks that depend on the completed task (edges where completed task is source)
      const dependentTaskIds = edges
        .filter(e => e.source === completedTaskId)
        .map(e => e.target);

      if (dependentTaskIds.length === 0) {
        return; // No dependent tasks
      }

      // For each dependent task, check if all its dependencies are satisfied
      for (const dependentTaskId of dependentTaskIds) {
        // Find all dependencies of this task (edges where this task is target)
        const dependencies = edges
          .filter(e => e.target === dependentTaskId)
          .map(e => e.source);

        // Check if all dependencies have completed successfully
        const completedDependencies = execDoc.tasks.filter(
          t => dependencies.includes(t.nodeId) && t.status === "success"
        );

        // If all dependencies are satisfied, enqueue this task
        if (dependencies.length > 0 && completedDependencies.length === dependencies.length) {
          const dependentNode = nodes.find(n => n.id === dependentTaskId);
          if (dependentNode) {
            // Check if this task hasn't already been executed
            const alreadyExecuted = execDoc.tasks.some(t => t.nodeId === dependentTaskId);
            if (!alreadyExecuted) {
              await redis.lpush(
                REDIS_QUEUE,
                JSON.stringify({
                  executionId: execDoc._id.toString(),
                  dagId: dagDoc._id.toString(),
                  task: dependentNode,
                  userId: executionUserId
                })
              );
              console.log(`📤 Enqueued dependent task: ${dependentNode.name || dependentTaskId} (depends on: ${completedTaskId})`);
            }
          }
        }
      }
    } catch (err) {
      console.error("Error enqueueing dependent tasks:", err);
    }
  };

  // Helper function to check if execution is complete
  const checkAndUpdateExecutionStatus = async (execDoc, dagDoc) => {
    try {
      // Only check if execution is still queued or running
      if (execDoc.status !== "running" && execDoc.status !== "queued") {
        return;
      }

      // Get all tasks from DAG
      const dagNodes = dagDoc ? dagDoc.graph?.nodes || [] : [];
      const totalExpectedTasks = dagNodes.length;
      
      if (totalExpectedTasks === 0) {
        console.warn(`⚠️ DAG has no nodes for execution ${execDoc._id}`);
        // If DAG has no nodes, mark as failed (invalid DAG)
        execDoc.status = "failed";
        if (!execDoc.timeline) execDoc.timeline = {};
        execDoc.timeline.completedAt = new Date();
        await execDoc.save();
        return;
      }

      // Get unique task IDs from execution (to avoid counting duplicates)
      const uniqueTaskIds = new Set(execDoc.tasks.map(t => t.nodeId));
      const completedTaskIds = new Set(
        execDoc.tasks
          .filter(t => t.status === "success" || t.status === "failed")
          .map(t => t.nodeId)
      );
      const failedTaskIds = new Set(
        execDoc.tasks
          .filter(t => t.status === "failed")
          .map(t => t.nodeId)
      );
      const runningTaskIds = new Set(
        execDoc.tasks
          .filter(t => t.status === "running" || t.status === "started" || t.status === "retrying")
          .map(t => t.nodeId)
      );
      const scheduledTaskIds = new Set(
        execDoc.tasks
          .filter(t => t.status === "scheduled")
          .map(t => t.nodeId)
      );

      const completedCount = completedTaskIds.size;
      const failedCount = failedTaskIds.size;
      const runningCount = runningTaskIds.size;
      const scheduledCount = scheduledTaskIds.size;

      console.log(`📊 Execution ${execDoc._id} status check: ${completedCount}/${totalExpectedTasks} completed, ${runningCount} running, ${scheduledCount} scheduled, ${failedCount} failed`);
      
      // IMPORTANT: If there are scheduled tasks, execution must NOT complete until they're sent
      if (scheduledCount > 0) {
        console.log(`⏳ Execution ${execDoc._id} has ${scheduledCount} scheduled task(s). Waiting for them to complete before marking execution as done.`);
        return; // Don't mark as complete if there are scheduled tasks
      }

      // CRITICAL: Only mark as success/failed when ALL tasks are completed
      // Must have exactly totalExpectedTasks completed, with no running or scheduled tasks
      if (completedCount === totalExpectedTasks && runningCount === 0 && scheduledCount === 0) {
        const finalStatus = failedCount > 0 ? "failed" : "success";
        execDoc.status = finalStatus;
        if (!execDoc.timeline) execDoc.timeline = {};
        
        // Ensure startedAt is set - use earliest task start time or queuedAt as fallback
        if (!execDoc.timeline.startedAt) {
          if (execDoc.tasks.length > 0) {
            const firstTask = execDoc.tasks
              .filter(t => t.startedAt)
              .sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt))[0];
            if (firstTask && firstTask.startedAt) {
              execDoc.timeline.startedAt = firstTask.startedAt;
            } else {
              // Fallback to queuedAt if no task has startedAt
              execDoc.timeline.startedAt = execDoc.timeline.queuedAt || new Date();
            }
          } else {
            // No tasks, use queuedAt
            execDoc.timeline.startedAt = execDoc.timeline.queuedAt || new Date();
          }
        }
        
        // Set completedAt
        if (!execDoc.timeline.completedAt) {
          execDoc.timeline.completedAt = new Date();
        }
        
        await execDoc.save();
        
        console.log(`✅ Execution ${execDoc._id} completed with status: ${finalStatus} (${completedCount}/${totalExpectedTasks} tasks completed)`);
        
        // Emit execution completion event
        io.emit("execution:update", {
          _id: execDoc._id.toString(),
          status: finalStatus,
          timeline: execDoc.timeline,
          tasks: execDoc.tasks
        });
      } else if (execDoc.status === "queued" && execDoc.tasks.length > 0) {
        // Mark as running when first task starts
        execDoc.status = "running";
        if (!execDoc.timeline) execDoc.timeline = {};
        if (!execDoc.timeline.startedAt) {
          // Use the earliest task start time, or current time
          const firstTask = execDoc.tasks.find(t => t.startedAt);
          if (firstTask && firstTask.startedAt) {
            execDoc.timeline.startedAt = firstTask.startedAt;
          } else {
            execDoc.timeline.startedAt = new Date();
          }
        }
        await execDoc.save();
        
        console.log(`▶️ Execution ${execDoc._id} started (status: running)`);
        
        io.emit("execution:update", {
          _id: execDoc._id.toString(),
          status: "running",
          timeline: execDoc.timeline
        });
      }
    } catch (err) {
      console.error("Error checking execution status:", err);
    }
  };

  try {
    let result;

    // Route to appropriate executor based on task type
    switch (task.type) {
      case "http":
        result = await taskExecutors.executeHttpTask(task);
        break;

      case "email":
        // Pass executionId to email task so it can get user SMTP settings
        result = await taskExecutors.executeEmailTask({ ...task, executionId });
        
        // Check if email was scheduled (not sent immediately)
        if (result && result.scheduled === true) {
          // Mark task as scheduled, not success
          await finalize("scheduled", {
            scheduled: true,
            taskStatus: "scheduled",
            scheduledDateTime: result.scheduledDateTime,
            message: result.message,
            scheduledEmailId: result.scheduledEmailId
          });
          return; // Don't continue to finalize as success
        }
        break;

      case "database":
      case "db":
        result = await taskExecutors.executeDatabaseTask(task);
        break;

      case "script":
        result = await taskExecutors.executeScriptTask(task);
        break;

      case "file":
        result = await taskExecutors.executeFileTask(task);
        break;

      case "webhook":
        result = await taskExecutors.executeWebhookTask(task);
        break;

      case "delay":
      case "wait":
        result = await taskExecutors.executeDelayTask(task);
        break;

      case "notification":
      case "notify":
        result = await taskExecutors.executeNotificationTask(task);
        break;

      case "transform":
      case "data":
        result = await taskExecutors.executeTransformTask(task);
        break;

      default:
        throw new Error(`Unsupported task type: ${task.type}`);
    }

    await finalize("success", { output: result });
    console.log(`✅ ${task.type} task "${task.name}" succeeded`);
    return;
  } catch (err) {
    console.warn(`Task "${task.name}" attempt ${attempt} failed:`, err.message ?? err);

    // Get retry config from DAG level, fallback to task level, then defaults
    let maxRetries = 3;
    let retryDelayMs = 2000;

    if (dagDoc && dagDoc.retryConfig) {
      maxRetries = Number(dagDoc.retryConfig.maxRetries ?? 3);
      retryDelayMs = Number(dagDoc.retryConfig.retryDelay ?? 2000);
    } else if (task.config?.retries !== undefined) {
      maxRetries = Number(task.config.retries);
    }
    
    if (task.config?.retryDelay !== undefined) {
      retryDelayMs = Number(task.config.retryDelay);
    }

    if (attempt < maxRetries) {
      setTimeout(async () => {
        const requeue = { ...payload, attempt: attempt + 1 };
        try {
          await redis.lpush(REDIS_QUEUE, JSON.stringify(requeue));
          io.emit("task:update", { executionId, taskId: task.id, status: "retry_scheduled", name: task.name, attempt: attempt + 1, retryInMs: retryDelayMs, timestamp: new Date() });
          console.log(`🔄 Task "${task.name}" requeued for retry (attempt ${attempt + 1}/${maxRetries})`);
        } catch (pushErr) {
          console.error("Requeue failed:", pushErr);
          await moveToDeadLetter(requeue, "requeue_failed:" + String(pushErr));
          await finalize("failed", { error: `Requeue failed: ${pushErr.message}` });
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
