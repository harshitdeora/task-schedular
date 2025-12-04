// Worker Health Monitoring Service
// Automatically marks workers as offline if they haven't sent a heartbeat

import WorkerModel from "../models/Worker.js";

const HEARTBEAT_TIMEOUT_MS = 15000; // 15 seconds - worker sends heartbeat every 5s, so 15s = 3 missed heartbeats
const CHECK_INTERVAL_MS = 10000; // Check every 10 seconds

export const startWorkerHealthMonitor = () => {
  console.log("🏥 Worker Health Monitor started");

  const checkWorkerHealth = async () => {
    try {
      const now = new Date();
      const timeoutThreshold = new Date(now.getTime() - HEARTBEAT_TIMEOUT_MS);

      // Find workers that haven't sent a heartbeat recently
      const offlineWorkers = await WorkerModel.updateMany(
        {
          lastHeartbeat: { $lt: timeoutThreshold },
          status: { $ne: "offline" }
        },
        {
          $set: { status: "offline" }
        }
      );

      if (offlineWorkers.modifiedCount > 0) {
        console.log(`⚠️ Marked ${offlineWorkers.modifiedCount} worker(s) as offline`);
      }

      // Update uptime for active workers
      const activeWorkers = await WorkerModel.find({ status: { $in: ["active", "idle", "busy"] } });
      for (const worker of activeWorkers) {
        if (worker.startedAt) {
          const uptimeSeconds = Math.floor((now - worker.startedAt) / 1000);
          await WorkerModel.findByIdAndUpdate(worker._id, { uptime: uptimeSeconds });
        }
      }
    } catch (error) {
      console.error("Worker health check error:", error);
    }
  };

  // Run immediately, then on interval
  checkWorkerHealth();
  setInterval(checkWorkerHealth, CHECK_INTERVAL_MS);
};

