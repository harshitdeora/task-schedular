import cron from "node-cron";
import DAG from "../models/Dag.js";
import Execution from "../models/Execution.js";
import redis from "../utils/redisClient.js";

import { topologicalSort } from "../utils/dagUtils.js";

export const startScheduler = () => {
  console.log("🕒 Scheduler service running...");

  cron.schedule("* * * * *", async () => {    // every 1 min
    const dags = await DAG.find();
    for (const dag of dags) {
      // TODO: check real schedule expression here
      console.log(`⏩ Triggering DAG: ${dag.name}`);

      const execution = await Execution.create({
        dagId: dag._id,
        status: "running",
        timeline: { queuedAt: new Date(), startedAt: new Date() }
      });

      const order = topologicalSort(dag.graph.nodes, dag.graph.edges);
      if (order.length === 0) continue;

      // Push first node (no dependencies) into Redis
      const firstNodeId = order[0];
      const node = dag.graph.nodes.find(n => n.id === firstNodeId);
      await redis.lpush("queue:tasks", JSON.stringify({
        executionId: execution._id,
        dagId: dag._id,
        task: node
      }));

      console.log(`📤 Enqueued first task for DAG "${dag.name}"`);
    }
  });
};
