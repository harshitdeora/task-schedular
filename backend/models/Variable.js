import mongoose from "mongoose";
import { encrypt, decrypt } from "../utils/encryption.js";

const variableSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, required: true },
  value: { type: String, required: true }, // Encrypted if isSecret is true
  isSecret: { type: Boolean, default: false },
  description: String,
  tags: [String],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Compound index to ensure unique variable names per user
variableSchema.index({ userId: 1, name: 1 }, { unique: true });

// Encrypt secret values before saving
variableSchema.pre("save", async function (next) {
  if (this.isModified("value") && this.isSecret && !this.value.startsWith("encrypted:")) {
    this.value = "encrypted:" + encrypt(this.value);
  }
  this.updatedAt = new Date();
  next();
});

// Method to get decrypted value
variableSchema.methods.getDecryptedValue = function () {
  if (this.isSecret && this.value.startsWith("encrypted:")) {
    return decrypt(this.value.replace("encrypted:", ""));
  }
  return this.value;
};

export default mongoose.model("Variable", variableSchema);


