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

  // Substitute variables in task config if userId is available
  let processedTask = { ...task };
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/52c7123f-3f87-428e-aa6f-c92410677fb4',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'worker.js:164',message:'processedTask initialized',data:{hasTask:!!task,hasUserId:!!userId,hasTaskConfig:!!task?.config},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
  // #endregion
  if (userId && task.config) {
    try {
      const { substituteVariables } = await import("../utils/variableSubstitution.js");
      const executionContext = {
        executionId: executionId.toString(),
        dagId: dagId?.toString(),
        timestamp: new Date().toISOString()
      };
      
      // Get previous task outputs for context
      if (execDoc && execDoc.tasks) {
        const completedTasks = execDoc.tasks.filter(t => t.status === "success");
        completedTasks.forEach((t, idx) => {
          executionContext[`task_${t.nodeId}_output`] = t.output;
          executionContext[`task_${idx}_output`] = t.output;
        });
      }

      processedTask.config = await substituteVariables(task.config, userId, executionContext);
    } catch (err) {
      console.warn("Variable substitution failed:", err.message);
      // Continue with original task config
    }
  }

  // Emit started
  io.emit("task:update", { executionId, taskId: task.id, status: "started", name: task.name, attempt, timestamp: new Date() });
  io.emit("node:status", { executionId, nodeId: task.id, status: "running", timestamp: new Date() });

  // Store input data for debugging (get from previous task outputs or execution context)
  let inputData = null;
  if (execDoc && execDoc.tasks && execDoc.tasks.length > 0) {
    const completedTasks = execDoc.tasks
      .filter(t => t.status === "success" || t.status === "failed")
      .sort((a, b) => (b.completedAt || b.startedAt || 0) - (a.completedAt || a.startedAt || 0));
    
    if (completedTasks.length > 0) {
      inputData = completedTasks[0].output || null;
    }
  }

  // Append running record (best-effort)
  try {
    if (execDoc) {
      const taskStartTime = new Date();
      execDoc.tasks.push({ 
        nodeId: task.id, 
        name: task.name, 
        status: "running", 
        attempts: attempt, 
        startedAt: taskStartTime,
        input: inputData // Store input for debugging
      });
      
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

      // Check if this is a scheduled task (not yet completed)
      // Also check if status itself is "scheduled" (passed directly)
      // Define this outside the if block so it's available for emitStatus later
      const isScheduled = status === "scheduled" || (info.scheduled === true && info.taskStatus === "scheduled");

      if (execDoc) {
        // Find the task entry (look for the most recent one with matching nodeId)
        const t = execDoc.tasks.slice().reverse().find((x) => x.nodeId === task.id);
        
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
              output: info.message || null,
              input: inputData
            });
          } else if (status === "paused") {
            execDoc.tasks.push({
              nodeId: task.id, 
              name: task.name, 
              status: "paused", 
              attempts: attempt, 
              startedAt: new Date(), 
              // Don't set completedAt for paused tasks
              error: null, 
              output: info.message || null,
              input: inputData
            });
            // Mark execution as paused
            execDoc.status = "paused";
            execDoc.pausedAt = new Date();
            execDoc.pausedTaskId = task.id;
          } else {
            execDoc.tasks.push({
              nodeId: task.id, 
              name: task.name, 
              status, 
              attempts: attempt, 
              startedAt: new Date(), 
              completedAt: new Date(), 
              error: info.error ?? null, 
              output: info.output ?? null,
              input: inputData
            });
          }
        }
        
        // Save the task update first
        await execDoc.save();
        
        // If task completed successfully (not scheduled), check for dependent tasks to enqueue
        // Scheduled tasks will trigger dependent tasks when they actually complete (when email is sent)
        if (status === "success" && !isScheduled && dagDoc && dagDoc.graph) {
          await enqueueDependentTasks(task.id, execDoc, dagDoc, "success");
        }
        
        // If task failed, check for failure path
        if (status === "failed" && dagDoc && dagDoc.graph) {
          await handleFailurePath(task.id, execDoc, dagDoc);
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
      io.emit("node:status", { executionId, nodeId: task.id, status: emitStatus, timestamp: new Date() });
    } catch (err) {
      console.error("Finalize error:", err);
      // Still decrement task count even on error
      currentTaskCount = Math.max(0, currentTaskCount - 1);
    }
  };

  // Helper function to handle failure paths
  const handleFailurePath = async (failedTaskId, execDoc, dagDoc) => {
    try {
      if (!dagDoc || !dagDoc.graph || !dagDoc.graph.edges) {
        return false;
      }

      const edges = dagDoc.graph.edges;
      const nodes = dagDoc.graph.nodes || [];
      
      // Find failure edges from the failed task
      const failureEdges = edges.filter(
        e => e.source === failedTaskId && 
        (e.type === "failure" || e.sourceHandle === "failure")
      );

      if (failureEdges.length === 0) {
        return false; // No failure path configured
      }

      // Get userId from execution document
      const executionUserId = execDoc.userId ? execDoc.userId.toString() : null;

      // Enqueue tasks on failure path
      for (const failureEdge of failureEdges) {
        const failureTaskId = failureEdge.target;
        const failureNode = nodes.find(n => n.id === failureTaskId);
        
        if (failureNode) {
          // Check if this task hasn't already been executed
          const alreadyExecuted = execDoc.tasks.some(t => t.nodeId === failureTaskId);
          if (!alreadyExecuted) {
            await redis.lpush(
              REDIS_QUEUE,
              JSON.stringify({
                executionId: execDoc._id.toString(),
                dagId: dagDoc._id.toString(),
                task: failureNode,
                userId: executionUserId
              })
            );
            console.log(`📤 Enqueued failure path task: ${failureNode.name || failureTaskId} (from failed task: ${failedTaskId})`);
          }
        }
      }

      return true; // Failure path was handled
    } catch (err) {
      console.error("Error handling failure path:", err);
      return false;
    }
  };

  // Helper function to enqueue dependent tasks after a task completes
  const enqueueDependentTasks = async (completedTaskId, execDoc, dagDoc, taskStatus = "success") => {
    try {
      if (!dagDoc || !dagDoc.graph || !dagDoc.graph.edges) {
        return;
      }

      const edges = dagDoc.graph.edges;
      const nodes = dagDoc.graph.nodes || [];
      
      // Get userId from execution document
      const executionUserId = execDoc.userId ? execDoc.userId.toString() : null;
      
      // Find all tasks that depend on the completed task
      // For success: edges with type="success" or sourceHandle="source" (default)
      // For failure: edges with type="failure" or sourceHandle="failure"
      const edgeType = taskStatus === "success" ? "success" : "failure";
      const dependentTaskIds = edges
        .filter(e => {
          if (e.source !== completedTaskId) return false;
          // Match by type or sourceHandle
          return (e.type === edgeType || 
                  (edgeType === "success" && (!e.type || e.type === "success")) ||
                  (edgeType === "failure" && e.sourceHandle === "failure"));
        })
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

        // Check if all dependencies have completed with the required status
        const completedDependencies = execDoc.tasks.filter(
          t => dependencies.includes(t.nodeId) && 
          ((taskStatus === "success" && t.status === "success") ||
           (taskStatus === "failed" && t.status === "failed"))
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
              console.log(`📤 Enqueued dependent task: ${dependentNode.name || dependentTaskId} (depends on: ${completedTaskId}, status: ${taskStatus})`);
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

  // Use processed task with substituted variables - define BEFORE try block
  const taskToExecute = processedTask || task;

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/52c7123f-3f87-428e-aa6f-c92410677fb4',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'worker.js:495',message:'taskToExecute defined',data:{hasProcessedTask:!!processedTask,hasTask:!!task,taskToExecuteType:taskToExecute?.type},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion

  try {
    let result;

    // Route to appropriate executor based on task type
    switch (taskToExecute.type) {
      case "http":
        result = await taskExecutors.executeHttpTask(taskToExecute);
        break;

      case "email":
        // Pass executionId to email task so it can get user SMTP settings
        result = await taskExecutors.executeEmailTask({ ...taskToExecute, executionId });
        
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
        result = await taskExecutors.executeDatabaseTask(taskToExecute);
        break;

      case "script":
        // Get previous task output to pass as input to script
        let previousTaskOutput = null;
        if (execDoc && execDoc.tasks && execDoc.tasks.length > 0) {
          // Find the most recent completed task (success or failed)
          const completedTasks = execDoc.tasks
            .filter(t => t.status === "success" || t.status === "failed")
            .sort((a, b) => (b.completedAt || b.startedAt || 0) - (a.completedAt || a.startedAt || 0));
          
          if (completedTasks.length > 0) {
            // Get the output from the most recent completed task
            previousTaskOutput = completedTasks[0].output || null;
          }
        }
        
        // Pass previous task output as inputData to script
        const scriptTaskWithInput = {
          ...taskToExecute,
          config: {
            ...taskToExecute.config,
            inputData: previousTaskOutput
          }
        };
        
        result = await taskExecutors.executeScriptTask(scriptTaskWithInput);
        break;

      case "file":
        result = await taskExecutors.executeFileTask(taskToExecute);
        break;

      case "webhook":
        result = await taskExecutors.executeWebhookTask(taskToExecute);
        break;

      case "delay":
      case "wait":
        result = await taskExecutors.executeDelayTask(taskToExecute);
        break;

      case "notification":
      case "notify":
        result = await taskExecutors.executeNotificationTask(taskToExecute);
        break;

      case "transform":
      case "data":
        result = await taskExecutors.executeTransformTask(taskToExecute);
        break;

      case "condition":
      case "if":
        result = await taskExecutors.executeConditionTask(taskToExecute);
        break;

      case "ai_logic":
      case "ai":
        result = await taskExecutors.executeAiLogicTask({ ...taskToExecute, executionId });
        break;

      case "pdf_gen":
      case "pdf":
        result = await taskExecutors.executePdfGenTask(taskToExecute);
        break;

      case "json_filter":
      case "json":
        result = await taskExecutors.executeJsonFilterTask(taskToExecute);
        break;

      case "image_proc":
      case "image":
        result = await taskExecutors.executeImageProcTask(taskToExecute);
        break;

      case "html_to_md":
      case "htmltomd":
        result = await taskExecutors.executeHtmlToMdTask(taskToExecute);
        break;

      case "pause":
      case "wait_for_signal":
      case "approval":
        // Pause task - save state and stop execution
        await finalize("paused", { 
          message: "Execution paused, waiting for resume signal",
          pausedAt: new Date()
        });
        return; // Don't continue execution

      default:
        throw new Error(`Unsupported task type: ${taskToExecute?.type || task?.type || 'unknown'}`);
    }

    await finalize("success", { output: result });
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/52c7123f-3f87-428e-aa6f-c92410677fb4',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'worker.js:586',message:'task succeeded',data:{taskToExecuteDefined:typeof taskToExecute!=='undefined',taskName:taskToExecute?.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    console.log(`✅ ${taskToExecute.type} task "${taskToExecute.name}" succeeded`);
    return;
  } catch (err) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/52c7123f-3f87-428e-aa6f-c92410677fb4',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'worker.js:589',message:'catch block entered',data:{taskToExecuteDefined:typeof taskToExecute!=='undefined',processedTaskDefined:typeof processedTask!=='undefined',taskDefined:typeof task!=='undefined',errorMessage:err?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    const taskName = taskToExecute?.name || task?.name || 'unknown';
    
    // For HTTP tasks, try to parse error response if it's JSON
    let errorMessage = err.message ?? String(err);
    let errorData = null;
    if (taskToExecute?.type === "http" && errorMessage.startsWith("{")) {
      try {
        errorData = JSON.parse(errorMessage);
        errorMessage = errorData.error || errorMessage;
      } catch {
        // Not JSON, use original message
      }
    }
    
    console.warn(`Task "${taskName}" attempt ${attempt} failed:`, errorMessage);

    // Get retry config from task level, fallback to DAG level, then defaults
    let maxRetries = 3;
    let initialDelayMs = 1000;
    let maxDelayMs = 30000;
    let multiplier = 2;

    // Check task-level retryPolicy first
    const taskNode = dagDoc?.graph?.nodes?.find(n => n.id === task.id);
    if (taskNode?.retryPolicy) {
      maxRetries = taskNode.retryPolicy.maxRetries !== null && taskNode.retryPolicy.maxRetries !== undefined
        ? Number(taskNode.retryPolicy.maxRetries)
        : (dagDoc?.retryConfig?.maxRetries ?? 3);
      initialDelayMs = Number(taskNode.retryPolicy.initialDelay ?? 1000);
      maxDelayMs = Number(taskNode.retryPolicy.maxDelay ?? 30000);
      multiplier = Number(taskNode.retryPolicy.multiplier ?? 2);
    } else if (dagDoc && dagDoc.retryConfig) {
      maxRetries = Number(dagDoc.retryConfig.maxRetries ?? 3);
      initialDelayMs = Number(dagDoc.retryConfig.retryDelay ?? 2000);
    }
    
    // Check task config for backward compatibility (supports both retries and retryCount for HTTP tasks)
    if (taskToExecute.config?.retries !== undefined) {
      maxRetries = Number(taskToExecute.config.retries);
    } else if (taskToExecute.config?.retryCount !== undefined) {
      maxRetries = Number(taskToExecute.config.retryCount);
    }
    
    if (taskToExecute.config?.retryDelay !== undefined) {
      initialDelayMs = Number(taskToExecute.config.retryDelay);
    }

    // Calculate exponential backoff delay
    const retryDelayMs = Math.min(
      initialDelayMs * Math.pow(multiplier, attempt - 1),
      maxDelayMs
    );

    if (attempt < maxRetries) {
      setTimeout(async () => {
        const requeue = { ...payload, attempt: attempt + 1 };
        try {
          await redis.lpush(REDIS_QUEUE, JSON.stringify(requeue));
          io.emit("task:update", { executionId, taskId: task.id, status: "retry_scheduled", name: task.name, attempt: attempt + 1, retryInMs: retryDelayMs, timestamp: new Date() });
          io.emit("node:status", { executionId, nodeId: task.id, status: "retrying", timestamp: new Date() });
          console.log(`🔄 Task "${task.name}" requeued for retry (attempt ${attempt + 1}/${maxRetries}, delay: ${retryDelayMs}ms)`);
        } catch (pushErr) {
          console.error("Requeue failed:", pushErr);
          await moveToDeadLetter(requeue, "requeue_failed:" + String(pushErr));
          await finalize("failed", { error: `Requeue failed: ${pushErr.message}` });
        }
      }, retryDelayMs);

      // Include error data for HTTP tasks if available
      const errorInfo = errorData || { error: errorMessage };
      await finalize("retrying", errorInfo);
    } else {
      // Max retries exceeded - check for failure path
      const hasFailurePath = await handleFailurePath(task.id, execDoc, dagDoc);
      
      if (!hasFailurePath) {
        await moveToDeadLetter(payload, "max_retries_exceeded:" + String(errorMessage));
      }
      
      // Include full error data for HTTP tasks (status code, response, etc.)
      const finalErrorInfo = errorData || { error: errorMessage };
      await finalize("failed", finalErrorInfo);
      console.error(`❌ Task "${taskName}" permanently failed after ${attempt} attempts`);
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
