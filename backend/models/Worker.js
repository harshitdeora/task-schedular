import mongoose from "mongoose";

const workerSchema = new mongoose.Schema({
  workerId: { type: String, required: true, unique: true },
  status: { type: String, enum: ["active", "idle", "busy", "offline"], default: "active" },
  lastHeartbeat: { type: Date, default: Date.now },
  startedAt: { type: Date, default: Date.now },
  tasksCompleted: { type: Number, default: 0 },
  tasksFailed: { type: Number, default: 0 },
  tasksInProgress: { type: Number, default: 0 },
  cpu: { type: Number, default: 0 },
  memory: { type: Number, default: 0 }, // in MB
  uptime: { type: Number, default: 0 } // in seconds
}, {
  timestamps: true
});

// Index for efficient queries
workerSchema.index({ lastHeartbeat: 1 });
workerSchema.index({ status: 1 });

export default mongoose.model("Worker", workerSchema);
