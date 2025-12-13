import cron from "node-cron";
import DAG from "../models/Dag.js";
import Execution from "../models/Execution.js";
import redis from "../utils/redisClient.js";
import { topologicalSort, getStartNodes } from "../utils/dagUtils.js";

// Store active cron jobs
const activeCronJobs = new Map();
const activeIntervals = new Map();

/**
 * Trigger a DAG execution
 */
async function triggerDAGExecution(dag) {
  try {
    // Check if DAG is active
    if (!dag.isActive || !dag.schedule?.enabled) {
      return;
    }

    // Check date range
    const now = new Date();
    if (dag.schedule.startDate && now < new Date(dag.schedule.startDate)) {
      return;
    }
    if (dag.schedule.endDate && now > new Date(dag.schedule.endDate)) {
      return;
    }

    console.log(`⏩ Triggering DAG: ${dag.name}`);

    const execution = await Execution.create({
      dagId: dag._id,
      userId: dag.userId, // Use DAG owner's userId for scheduled executions
      status: "queued",
      timeline: { queuedAt: new Date() }
    });

    const order = topologicalSort(dag.graph.nodes, dag.graph.edges);
    if (order.length === 0) {
      console.warn(`⚠️ DAG "${dag.name}" has no executable tasks`);
      await Execution.findByIdAndUpdate(execution._id, { 
        status: "failed", 
        "timeline.completedAt": new Date() 
      });
      return;
    }

    // Push all root nodes (no incoming edges) so parallel branches start
    const startNodeIds = getStartNodes(dag.graph.nodes, dag.graph.edges);
    const nodesToQueue = startNodeIds.length > 0 ? startNodeIds : [order[0]];

    for (const nodeId of nodesToQueue) {
      const node = dag.graph.nodes.find(n => n.id === nodeId);
      if (!node) {
        console.warn(`⚠️ Node ${nodeId} not found for DAG "${dag.name}"`);
        continue;
      }

      await redis.lpush(
        "queue:tasks",
        JSON.stringify({
          executionId: execution._id.toString(),
          dagId: dag._id.toString(),
          task: node,
          userId: dag.userId?.toString()
        })
      );
    }

    console.log(`📤 Enqueued ${nodesToQueue.length} start task(s) for DAG "${dag.name}" (execution: ${execution._id})`);
  } catch (error) {
    console.error(`❌ Error triggering DAG "${dag.name}":`, error);
  }
}

/**
 * Schedule a DAG based on its schedule configuration
 */
function scheduleDAG(dag) {
  const dagId = dag._id.toString();

  // Remove existing schedule if any
  unscheduleDAG(dagId);

  // Skip if not enabled or not active
  if (!dag.schedule?.enabled || !dag.isActive) {
    return;
  }

  const schedule = dag.schedule;

  if (schedule.type === "cron" && schedule.cronExpression) {
    try {
      // Validate cron expression
      if (!cron.validate(schedule.cronExpression)) {
        console.error(`❌ Invalid cron expression for DAG "${dag.name}": ${schedule.cronExpression}`);
        return;
      }

      const job = cron.schedule(schedule.cronExpression, async () => {
        // Re-fetch DAG to get latest version
        const freshDag = await DAG.findById(dag._id);
        if (freshDag) {
          await triggerDAGExecution(freshDag);
        }
      }, {
        scheduled: true,
        timezone: schedule.timezone || "UTC"
      });

      activeCronJobs.set(dagId, job);
      console.log(`✅ Scheduled DAG "${dag.name}" with cron: ${schedule.cronExpression}`);
    } catch (error) {
      console.error(`❌ Error scheduling DAG "${dag.name}":`, error);
    }
  } else if (schedule.type === "interval" && schedule.intervalSeconds) {
    const intervalMs = schedule.intervalSeconds * 1000;
    
    const intervalId = setInterval(async () => {
      const freshDag = await DAG.findById(dag._id);
      if (freshDag && freshDag.isActive && freshDag.schedule?.enabled) {
        await triggerDAGExecution(freshDag);
      } else {
        // DAG disabled, clear interval
        clearInterval(intervalId);
        activeIntervals.delete(dagId);
      }
    }, intervalMs);

    activeIntervals.set(dagId, intervalId);
    console.log(`✅ Scheduled DAG "${dag.name}" with interval: ${schedule.intervalSeconds}s`);
  }
  // "manual" and "once" types don't need scheduling
}

/**
 * Unschedule a DAG
 */
function unscheduleDAG(dagId) {
  const id = dagId.toString();
  
  // Stop cron job if exists
  const cronJob = activeCronJobs.get(id);
  if (cronJob) {
    cronJob.stop();
    activeCronJobs.delete(id);
  }

  // Clear interval if exists
  const intervalId = activeIntervals.get(id);
  if (intervalId) {
    clearInterval(intervalId);
    activeIntervals.delete(id);
  }
}

/**
 * Load and schedule all DAGs
 */
async function loadAndScheduleDAGs() {
  try {
    const dags = await DAG.find({ isActive: true });
    console.log(`📋 Loading ${dags.length} active DAG(s)...`);

    for (const dag of dags) {
      if (dag.schedule?.enabled && dag.schedule?.type !== "manual") {
        scheduleDAG(dag);
      }
    }
  } catch (error) {
    console.error("❌ Error loading DAGs:", error);
  }
}

/**
 * Start the scheduler service
 */
export const startScheduler = () => {
  console.log("🕒 Scheduler service starting...");

  // Initial load
  loadAndScheduleDAGs();

  // Reload schedules every 5 minutes to pick up changes
  setInterval(loadAndScheduleDAGs, 5 * 60 * 1000);

  console.log("✅ Scheduler service running");
};

/**
 * Manually trigger a DAG (for manual/once types)
 */
export const triggerDAG = async (dagId) => {
  try {
    const dag = await DAG.findById(dagId);
    if (!dag) {
      throw new Error("DAG not found");
    }
    await triggerDAGExecution(dag);
  } catch (error) {
    console.error("Error triggering DAG:", error);
    throw error;
  }
};

// Export for testing
export { scheduleDAG, unscheduleDAG };
