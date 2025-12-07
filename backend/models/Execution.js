import mongoose from "mongoose";

const executionSchema = new mongoose.Schema({
  dagId: { type: mongoose.Schema.Types.ObjectId, ref: "DAG" },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Track which user triggered this execution
  status: { type: String, enum: ["queued", "running", "success", "failed"], default: "queued" },
  tasks: [
    {
      nodeId: String,
      name: String,
      status: String,
      startedAt: Date,
      completedAt: Date,
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
