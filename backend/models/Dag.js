import mongoose from "mongoose";

const nodeSchema = new mongoose.Schema({
  id: String,
  type: String,
  name: String,
  config: Object,
  position: Object,
  retryPolicy: {
    maxRetries: { type: Number, default: null }, // null means use DAG-level retryConfig
    initialDelay: { type: Number, default: 1000 }, // Initial delay in ms
    maxDelay: { type: Number, default: 30000 }, // Max delay in ms (for exponential backoff)
    multiplier: { type: Number, default: 2 } // Exponential backoff multiplier
  }
});

const edgeSchema = new mongoose.Schema({
  id: String,
  source: String,
  target: String,
  type: { type: String, default: "success" }, // "success" or "failure"
  sourceHandle: String, // "source" (success) or "failure" (failure path)
  targetHandle: String
});

const dagSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  graph: {
    nodes: [nodeSchema],
    edges: [edgeSchema]
  },
  schedule: {
    enabled: { type: Boolean, default: false },
    type: { 
      type: String, 
      enum: ["cron", "interval", "manual", "once"], 
      default: "manual" 
    },
    cronExpression: String, // e.g., "0 9 * * *" for daily at 9 AM
    intervalSeconds: Number, // for interval type
    timezone: { type: String, default: "UTC" },
    startDate: Date,
    endDate: Date
  },
  retryConfig: {
    maxRetries: { type: Number, default: 3 },
    retryDelay: { type: Number, default: 2000 } // in milliseconds
  },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Compound index to ensure unique DAG names per user
dagSchema.index({ userId: 1, name: 1 }, { unique: true });

export default mongoose.model("DAG", dagSchema);
