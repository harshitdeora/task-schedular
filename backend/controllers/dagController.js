import DAG from "../models/Dag.js";
import Execution from "../models/Execution.js";
import redis from "../utils/redisClient.js";
import { topologicalSort } from "../utils/dagUtils.js";

// Helper function to detect cycles
function hasCycle(nodes, edges) {
  const adj = {};
  const visited = {};
  const recStack = {};
  
  nodes.forEach(n => {
    adj[n.id] = [];
    visited[n.id] = false;
    recStack[n.id] = false;
  });
  
  edges.forEach(e => {
    if (adj[e.source]) {
      adj[e.source].push(e.target);
    }
  });
  
  function dfs(node) {
    visited[node] = true;
    recStack[node] = true;
    
    for (const neighbor of adj[node] || []) {
      if (!visited[neighbor]) {
        if (dfs(neighbor)) return true;
      } else if (recStack[neighbor]) {
        return true;
      }
    }
    
    recStack[node] = false;
    return false;
  }
  
  for (const nodeId of Object.keys(adj)) {
    if (!visited[nodeId]) {
      if (dfs(nodeId)) return true;
    }
  }
  
  return false;
}

export const createDAG = async (req, res) => {
  try {
    // Validate DAG structure
    if (req.body.graph) {
      const { nodes, edges } = req.body.graph;
      if (hasCycle(nodes, edges)) {
        return res.status(400).json({ success: false, error: "DAG contains cycles" });
      }
    }
    
    const dag = await DAG.create(req.body);
    res.status(201).json({ success: true, dag });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const getDAGs = async (req, res) => {
  try {
    const dags = await DAG.find().sort({ createdAt: -1 });
    res.json(dags);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getDAGById = async (req, res) => {
  try {
    const dag = await DAG.findById(req.params.id);
    if (!dag) {
      return res.status(404).json({ success: false, message: "DAG not found" });
    }
    res.json(dag);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateDAG = async (req, res) => {
  try {
    // Validate DAG structure if graph is being updated
    if (req.body.graph) {
      const { nodes, edges } = req.body.graph;
      if (hasCycle(nodes, edges)) {
        return res.status(400).json({ success: false, error: "DAG contains cycles" });
      }
    }
    
    const dag = await DAG.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    
    if (!dag) {
      return res.status(404).json({ success: false, message: "DAG not found" });
    }
    
    res.json({ success: true, dag });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const deleteDAG = async (req, res) => {
  try {
    const dag = await DAG.findByIdAndDelete(req.params.id);
    if (!dag) {
      return res.status(404).json({ success: false, message: "DAG not found" });
    }
    res.json({ success: true, message: "DAG deleted" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const validateDAG = async (req, res) => {
  try {
    const dag = await DAG.findById(req.params.id);
    if (!dag) {
      return res.status(404).json({ success: false, message: "DAG not found" });
    }
    
    const { nodes, edges } = dag.graph;
    const hasCycles = hasCycle(nodes, edges);
    const order = topologicalSort(nodes, edges);
    
    res.json({
      success: true,
      valid: !hasCycles,
      hasCycles,
      topologicalOrder: order,
      nodeCount: nodes.length,
      edgeCount: edges.length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const duplicateDAG = async (req, res) => {
  try {
    const originalDag = await DAG.findById(req.params.id);
    if (!originalDag) {
      return res.status(404).json({ success: false, message: "DAG not found" });
    }
    
    const duplicatedDag = await DAG.create({
      ...originalDag.toObject(),
      _id: undefined,
      name: `${originalDag.name} (Copy)`,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    res.status(201).json({ success: true, dag: duplicatedDag });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const executeDAG = async (req, res) => {
  try {
    const dag = await DAG.findById(req.params.id);
    if (!dag) {
      return res.status(404).json({ success: false, message: "DAG not found" });
    }
    
    // Create execution
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
