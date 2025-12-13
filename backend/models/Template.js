import mongoose from "mongoose";

const templateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, default: "general" },
  tags: [String],
  graph: {
    nodes: [{
      id: String,
      type: String,
      name: String,
      config: Object,
      position: Object
    }],
    edges: [{
      id: String,
      source: String,
      target: String,
      type: String
    }]
  },
  // Default schedule configuration
  defaultSchedule: {
    enabled: { type: Boolean, default: false },
    type: { type: String, enum: ["cron", "interval", "manual"], default: "manual" },
    cronExpression: String,
    intervalSeconds: Number
  },
  // Template variables that users need to configure
  variables: [{
    name: String,
    description: String,
    required: { type: Boolean, default: false },
    defaultValue: String
  }],
  isPublic: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  usageCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

templateSchema.index({ category: 1 });
templateSchema.index({ tags: 1 });
templateSchema.index({ isPublic: 1 });

export default mongoose.model("Template", templateSchema);


