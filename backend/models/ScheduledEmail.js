import mongoose from "mongoose";

const scheduledEmailSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Optional - can be null for DAG-scheduled emails
  executionId: { type: mongoose.Schema.Types.ObjectId, ref: "Execution" }, // Link to execution
  taskNodeId: { type: String }, // Link to specific task node in execution
  userEmail: { type: String, required: true }, // Sender email
  recipient: { type: String, required: true }, // Recipient email
  subject: { type: String, required: true },
  message: { type: String, required: true },
  scheduledDateTime: { type: Date, required: true }, // When to send
  status: { 
    type: String, 
    enum: ["pending", "sent", "failed", "cancelled"], 
    default: "pending" 
  },
  sentAt: { type: Date }, // When email was actually sent
  errorMessage: { type: String }, // Error if sending failed
  from: { type: String }, // Optional from address
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

scheduledEmailSchema.index({ userId: 1, scheduledDateTime: 1 });
scheduledEmailSchema.index({ status: 1, scheduledDateTime: 1 });

export default mongoose.model("ScheduledEmail", scheduledEmailSchema);

