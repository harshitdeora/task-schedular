import Execution from "../models/Execution.js";
import DAG from "../models/Dag.js";
import redis from "../utils/redisClient.js";
import { topologicalSort } from "../utils/dagUtils.js";

export const getExecutions = async (req, res) => {
  try {
    const { limit = 100, status, dagId } = req.query;
    const query = {};
    
    if (status) query.status = status;
    if (dagId) query.dagId = dagId;

    const executions = await Execution.find(query)
      .populate("dagId", "name")
      .sort({ "timeline.queuedAt": -1 })
      .limit(parseInt(limit));

    res.json(executions);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getExecutionById = async (req, res) => {
  try {
    const execution = await Execution.findById(req.params.id)
      .populate("dagId");
    
    if (!execution) {
      return res.status(404).json({ success: false, message: "Execution not found" });
    }
    
    res.json(execution);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createExecution = async (req, res) => {
  try {
    const { dagId } = req.body;
    
    const dag = await DAG.findById(dagId);
    if (!dag) {
      return res.status(404).json({ success: false, message: "DAG not found" });
    }

    const execution = await Execution.create({
      dagId: dag._id,
      status: "queued",
      timeline: { queuedAt: new Date() }
    });

    // Enqueue first tasks
    const order = topologicalSort(dag.graph.nodes, dag.graph.edges);
    if (order.length > 0) {
      const firstNodeId = order[0];
      const node = dag.graph.nodes.find(n => n.id === firstNodeId);
      
      await redis.lpush(
        "queue:tasks",
        JSON.stringify({
          executionId: execution._id.toString(),
          dagId: dag._id.toString(),
          task: node
        })
      );
    }

    res.status(201).json({ success: true, execution });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const updateExecution = async (req, res) => {
  try {
    const execution = await Execution.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate("dagId");
    
    if (!execution) {
      return res.status(404).json({ success: false, message: "Execution not found" });
    }
    
    res.json({ success: true, execution });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const cancelExecution = async (req, res) => {
  try {
    const execution = await Execution.findById(req.params.id);
    
    if (!execution) {
      return res.status(404).json({ success: false, message: "Execution not found" });
    }

    if (execution.status === "success" || execution.status === "failed") {
      return res.status(400).json({ success: false, message: "Cannot cancel completed execution" });
    }

    execution.status = "cancelled";
    execution.timeline.completedAt = new Date();
    await execution.save();

    res.json({ success: true, execution });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const retryExecution = async (req, res) => {
  try {
    const execution = await Execution.findById(req.params.id).populate("dagId");
    
    if (!execution) {
      return res.status(404).json({ success: false, message: "Execution not found" });
    }

    if (execution.status !== "failed") {
      return res.status(400).json({ success: false, message: "Can only retry failed executions" });
    }

    const dag = execution.dagId;
    const newExecution = await Execution.create({
      dagId: dag._id,
      status: "queued",
      timeline: { queuedAt: new Date() }
    });

    // Enqueue first tasks
    const order = topologicalSort(dag.graph.nodes, dag.graph.edges);
    if (order.length > 0) {
      const firstNodeId = order[0];
      const node = dag.graph.nodes.find(n => n.id === firstNodeId);
      
      await redis.lpush(
        "queue:tasks",
        JSON.stringify({
          executionId: newExecution._id.toString(),
          dagId: dag._id.toString(),
          task: node
        })
      );
    }

    res.status(201).json({ success: true, execution: newExecution });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

