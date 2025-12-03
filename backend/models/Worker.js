import mongoose from "mongoose";

const workerSchema = new mongoose.Schema({
  workerId: String,
  status: { type: String, enum: ["active", "idle", "busy"], default: "active" },
  lastHeartbeat: Date,
  tasksCompleted: Number,
  tasksFailed: Number,
  cpu: Number,
  memory: Number
});

export default mongoose.model("Worker", workerSchema);
