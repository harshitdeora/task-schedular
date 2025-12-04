import mongoose from "mongoose";

const nodeSchema = new mongoose.Schema({
  id: String,
  type: String,
  name: String,
  config: Object,
  position: Object
});

const edgeSchema = new mongoose.Schema({
  id: String,
  source: String,
  target: String,
  type: String
});

const dagSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: String,
  graph: {
    nodes: [nodeSchema],
    edges: [edgeSchema]
  },
  retryConfig: {
    maxRetries: { type: Number, default: 3 },
    retryDelay: { type: Number, default: 2000 } // in milliseconds
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model("DAG", dagSchema);
