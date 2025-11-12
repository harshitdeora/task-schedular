import mongoose from "mongoose";

const executionSchema = new mongoose.Schema({
  dagId: { type: mongoose.Schema.Types.ObjectId, ref: "DAG" },
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
