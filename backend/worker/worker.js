import redis from "../utils/redisClient.js";

import Execution from "../models/Execution.js";
import mongoose from "mongoose";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();
mongoose.connect(process.env.MONGO_URI);

console.log("⚙️ Worker started...");

const executeTask = async (taskData) => {
  const { executionId, task } = taskData;
  const exec = await Execution.findById(executionId);
  if (!exec) return;

  const node = {
    nodeId: task.id,
    name: task.name,
    status: "running",
    startedAt: new Date()
  };
  exec.tasks.push(node);
  await exec.save();

  try {
    let output = null;
    if (task.type === "http") {
      const res = await axios.get(task.config.url);
      output = res.data;
    } else if (task.type === "script") {
      output = `Simulated script: ${task.config.script}`;
    }

    node.status = "success";
    node.completedAt = new Date();
    node.logs = JSON.stringify(output).slice(0, 200);
    await exec.save();

    console.log(`✅ Task ${task.name} done`);
  } catch (err) {
    node.status = "failed";
    node.error = err.message;
    await exec.save();
    console.log(`❌ Task ${task.name} failed:`, err.message);
  }
};

// Infinite loop listening to queue
(async function listen() {
  while (true) {
  const tasks = await redis.lrange("queue:tasks", -1, -1); // get last task
  if (tasks.length > 0) {
    const taskData = JSON.parse(tasks[0]);
    await executeTask(taskData);
    await redis.rpop("queue:tasks"); // remove it after execution
  }
  await new Promise(res => setTimeout(res, 2000)); // wait 2 seconds before next poll
}

})();
