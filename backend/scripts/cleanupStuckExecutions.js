// Cleanup script to fix stuck executions
import mongoose from "mongoose";
import dotenv from "dotenv";
import Execution from "../models/Execution.js";

dotenv.config();

async function cleanupStuckExecutions() {
  try {
    const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/taskScheduler";
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Find executions stuck in "running" status
    const stuckExecutions = await Execution.find({ status: "running" });
    console.log(`Found ${stuckExecutions.length} stuck executions`);

    let fixed = 0;
    for (const exec of stuckExecutions) {
      const successTasks = exec.tasks.filter(t => t.status === "success").length;
      const failedTasks = exec.tasks.filter(t => t.status === "failed").length;
      const totalTasks = exec.tasks.length;

      // Determine final status
      let finalStatus = "failed";
      if (failedTasks > 0) {
        finalStatus = "failed";
      } else if (successTasks === totalTasks && totalTasks > 0) {
        finalStatus = "success";
      } else if (totalTasks === 0) {
        finalStatus = "failed"; // No tasks = failed execution
      }

      // Update execution
      exec.status = finalStatus;
      if (!exec.timeline) exec.timeline = {};
      exec.timeline.completedAt = exec.timeline.completedAt || new Date();
      await exec.save();

      fixed++;
      console.log(`Fixed execution ${exec._id}: ${totalTasks} tasks, status → ${finalStatus}`);
    }

    console.log(`\n✅ Fixed ${fixed} stuck executions`);
    console.log(`\nYour database is clean! You can now start fresh.`);
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error cleaning up:", error);
    process.exit(1);
  }
}

cleanupStuckExecutions();

