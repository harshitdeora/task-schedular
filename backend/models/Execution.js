import mongoose from "mongoose";

const executionSchema = new mongoose.Schema({
  dagId: { type: mongoose.Schema.Types.ObjectId, ref: "DAG" },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Track which user triggered this execution
  status: { type: String, enum: ["queued", "running", "success", "failed", "cancelled"], default: "queued" },
  tasks: [
    {
      nodeId: String,
      name: String,
      status: String,
      startedAt: Date,
      completedAt: Date,
      attempts: { type: Number, default: 0 },
      output: mongoose.Schema.Types.Mixed,
      logs: String,
      error: String
    }
  ],
  timeline: {
    queuedAt: Date,
    startedAt: Date,
    completedAt: Date
  }
});

export default mongoose.model("Execution", executionSchema);
