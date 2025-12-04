import WorkerModel from "../models/Worker.js";

export const getWorkers = async (req, res) => {
  try {
    const workers = await WorkerModel.find().sort({ lastHeartbeat: -1 });
    
    // Calculate uptime for each worker
    const now = new Date();
    const workersWithUptime = workers.map(worker => {
      const workerObj = worker.toObject();
      if (worker.startedAt) {
        workerObj.uptime = Math.floor((now - worker.startedAt) / 1000);
      } else {
        workerObj.uptime = worker.uptime || 0;
      }
      return workerObj;
    });

    res.json({ success: true, workers: workersWithUptime });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getWorkerById = async (req, res) => {
  try {
    const worker = await WorkerModel.findOne({ workerId: req.params.id });
    if (!worker) {
      return res.status(404).json({ success: false, message: "Worker not found" });
    }

    const now = new Date();
    const workerObj = worker.toObject();
    if (worker.startedAt) {
      workerObj.uptime = Math.floor((now - worker.startedAt) / 1000);
    }

    res.json({ success: true, worker: workerObj });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getWorkerStats = async (req, res) => {
  try {
    const totalWorkers = await WorkerModel.countDocuments();
    const activeWorkers = await WorkerModel.countDocuments({ status: { $in: ["active", "idle", "busy"] } });
    const offlineWorkers = await WorkerModel.countDocuments({ status: "offline" });
    
    const workers = await WorkerModel.find();
    const totalTasksCompleted = workers.reduce((sum, w) => sum + (w.tasksCompleted || 0), 0);
    const totalTasksFailed = workers.reduce((sum, w) => sum + (w.tasksFailed || 0), 0);
    const totalTasksInProgress = workers.reduce((sum, w) => sum + (w.tasksInProgress || 0), 0);

    const avgCpu = workers.length > 0 
      ? workers.reduce((sum, w) => sum + (w.cpu || 0), 0) / workers.length 
      : 0;
    const avgMemory = workers.length > 0
      ? workers.reduce((sum, w) => sum + (w.memory || 0), 0) / workers.length
      : 0;

    res.json({
      success: true,
      stats: {
        totalWorkers,
        activeWorkers,
        offlineWorkers,
        totalTasksCompleted,
        totalTasksFailed,
        totalTasksInProgress,
        avgCpu: Math.round(avgCpu * 100) / 100,
        avgMemory: Math.round(avgMemory)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

