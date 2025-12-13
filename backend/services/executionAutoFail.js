import Execution from "../models/Execution.js";
import ScheduledEmail from "../models/ScheduledEmail.js";

// Mark executions stuck in queued/running beyond threshold as failed
export async function markStuckExecutions({
  maxAgeMinutes = 60,
  scheduledGraceMinutes = 10,
  now = new Date()
} = {}) {
  // Find executions that are still queued/running and older than the *minimum* base cutoff
  // We still compute per-execution effective cutoff below.
  const baseCutoff = new Date(now.getTime() - maxAgeMinutes * 60 * 1000);
  const candidates = await Execution.find({
    status: { $in: ["queued", "running"] },
    "timeline.queuedAt": { $lte: baseCutoff }
  }).limit(200); // safety cap to avoid large scans

  if (!candidates.length) return 0;

  let processed = 0;

  for (const exec of candidates) {
    try {
      // Compute a per-execution effective cutoff.
      // Default: queuedAt + maxAgeMinutes.
      const queuedAt = exec.timeline?.queuedAt ? new Date(exec.timeline.queuedAt) : null;
      let effectiveCutoff = queuedAt
        ? new Date(queuedAt.getTime() + maxAgeMinutes * 60 * 1000)
        : baseCutoff;

      // If there are pending scheduled emails, extend cutoff to (latest scheduled + grace).
      const scheduledEmails = await ScheduledEmail.find({
        executionId: exec._id,
        status: "pending"
      }).sort({ scheduledDateTime: -1 }).limit(1);

      if (scheduledEmails.length) {
        const latest = scheduledEmails[0].scheduledDateTime;
        if (latest) {
          const latestDate = new Date(latest);
          const graceCutoff = new Date(latestDate.getTime() + scheduledGraceMinutes * 60 * 1000);
          // Dynamically extend based on DAG start -> latest scheduled + grace
          if (queuedAt) {
            const dynamicMaxAgeMinutes =
              Math.max(
                maxAgeMinutes,
                ((graceCutoff.getTime() - queuedAt.getTime()) / 1000 / 60)
              );
            effectiveCutoff = new Date(queuedAt.getTime() + dynamicMaxAgeMinutes * 60 * 1000);
          } else {
            effectiveCutoff = graceCutoff;
          }
        }
      }

      // If we haven't passed the effective cutoff yet, keep waiting.
      if (now < effectiveCutoff) {
        continue;
      }

      // Mark non-terminal tasks as failed
      if (exec.tasks && exec.tasks.length > 0) {
        exec.tasks = exec.tasks.map((t) => {
          if (t.status === "success" || t.status === "failed") return t;
          return {
            ...t,
            status: "failed",
            completedAt: new Date(),
            error: t.error || "Auto-failed due to timeout"
          };
        });
      }

      exec.status = "failed";
      if (!exec.timeline) exec.timeline = {};
      exec.timeline.completedAt = new Date();
      await exec.save();
      processed += 1;
      console.log(`⏱️ Auto-failed stuck execution ${exec._id}`);
    } catch (err) {
      console.error(`Failed to auto-fail execution ${exec._id}:`, err.message);
    }
  }

  return processed;
}

let intervalId = null;

export function startExecutionAutoFailMonitor({
  intervalMinutes = 10,
  maxAgeMinutes = 60,
  scheduledGraceMinutes = 10
} = {}) {
  if (intervalId) return; // already running

  const run = async () => {
    try {
      await markStuckExecutions({ maxAgeMinutes, scheduledGraceMinutes });
    } catch (err) {
      console.error("Auto-fail monitor error:", err);
    }
  };

  // initial kick
  run();
  intervalId = setInterval(run, intervalMinutes * 60 * 1000);
  console.log(`⏱️ Auto-fail monitor started (interval ${intervalMinutes}m, timeout ${maxAgeMinutes}m, scheduled grace ${scheduledGraceMinutes}m)`);
}

export function stopExecutionAutoFailMonitor() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

