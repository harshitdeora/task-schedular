import mongoose from "mongoose";
import crypto from "crypto";

const dagTriggerSchema = new mongoose.Schema({
  dagId: { type: mongoose.Schema.Types.ObjectId, ref: "DAG", required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, required: true },
  type: { 
    type: String, 
    enum: ["api", "webhook"], 
    required: true 
  },
  token: { 
    type: String, 
    required: true,
    unique: true,
    default: () => crypto.randomBytes(32).toString("hex")
  },
  enabled: { type: Boolean, default: true },
  method: { 
    type: String, 
    enum: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    default: "POST"
  },
  // For webhook triggers, store webhook path
  webhookPath: String,
  // Headers to validate (optional)
  requiredHeaders: Object,
  // Body validation (optional)
  bodySchema: Object,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

dagTriggerSchema.index({ dagId: 1 });
dagTriggerSchema.index({ token: 1 });
dagTriggerSchema.index({ userId: 1 });

export default mongoose.model("DagTrigger", dagTriggerSchema);


