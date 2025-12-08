import Execution from "../models/Execution.js";
import DAG from "../models/Dag.js";
import redis from "../utils/redisClient.js";
import { topologicalSort } from "../utils/dagUtils.js";

export const getExecutions = async (req, res) => {
  try {
    // Require authentication
    if (!req.user || !req.user._id) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const { limit = 100, status, dagId } = req.query;
    const query = { userId: req.user._id }; // Only show executions for logged-in user
    
    if (status) query.status = status;
    if (dagId) query.dagId = dagId;

    // Get executions first to capture original dagId values
    const executionsRaw = await Execution.find(query)
      .sort({ "timeline.queuedAt": -1 })
      .limit(parseInt(limit));

    // Store original dagId values before populate
    const originalDagIds = new Map();
    executionsRaw.forEach(exec => {
      if (exec.dagId) {
        originalDagIds.set(exec._id.toString(), exec.dagId.toString());
      }
    });

    // Preload DAG documents to get node counts for accurate status computation
    const dagDocs = await DAG.find({ _id: { $in: Array.from(originalDagIds.values()) } })
      .select("name graph.nodes");
    const dagNodeCounts = new Map(
      dagDocs.map((dag) => [dag._id.toString(), dag.graph?.nodes?.length || 0])
    );

    // Now populate the executions (keep dag name, node count is taken from dagNodeCounts)
    const executions = await Execution.populate(executionsRaw, {
      path: "dagId",
      select: "name",
      model: "DAG"
    });

    // Process executions to handle deleted DAGs
    // If original dagId exists but populate returned null, DAG was deleted
    const processedExecutions = executions.map(exec => {
      const execObj = exec.toObject ? exec.toObject() : { ...exec };
      const originalDagId = originalDagIds.get(exec._id.toString());
      const totalNodes = originalDagId ? (dagNodeCounts.get(originalDagId) || 0) : 0;

      // If we had an original dagId but populate returned null, DAG was deleted
      if (originalDagId && (execObj.dagId === null || (execObj.dagId && typeof execObj.dagId === 'object' && !execObj.dagId.name))) {
        execObj.dagId = { _id: originalDagId, name: null, deleted: true };
      }

      // Compute completion based on tasks vs expected nodes
      const completedNodeIds = new Set(
        (execObj.tasks || [])
          .filter(t => t.status === "success" || t.status === "failed")
          .map(t => t.nodeId)
      );
      const totalNodesUsed = totalNodes || 0;
      
      // Check if execution is truly complete
      // If we have expected nodes, check if all are completed
      // If no expected nodes but we have tasks, check if all tasks are completed
      let isAllNodesCompleted = false;
      if (totalNodesUsed > 0) {
        // We know the expected node count from DAG
        isAllNodesCompleted = completedNodeIds.size >= totalNodesUsed;
      } else if (execObj.tasks && execObj.tasks.length > 0) {
        // Fallback: if no DAG node count, check if all tasks are completed
        const allTaskStatuses = execObj.tasks.map(t => t.status);
        const hasRunningOrScheduled = allTaskStatuses.some(s => 
          s === "running" || s === "started" || s === "scheduled" || s === "retrying"
        );
        isAllNodesCompleted = !hasRunningOrScheduled && allTaskStatuses.every(s => 
          s === "success" || s === "failed"
        );
      }

      // Derived status to ensure "pending" when not all nodes are done
      let computedStatus = execObj.status;
      
      // If status is already failed or cancelled, keep it
      if (execObj.status === "failed" || execObj.status === "cancelled") {
        computedStatus = execObj.status;
      } else if (execObj.status === "success") {
        // If marked as success, verify it's actually complete
        computedStatus = isAllNodesCompleted ? "success" : "pending";
      } else {
        // For queued/running/other statuses, check if actually complete
        computedStatus = isAllNodesCompleted ? "success" : "pending";
      }

      return {
        ...execObj,
        totalNodes: totalNodesUsed,
        completedNodes: completedNodeIds.size,
        computedStatus
      };
    });

    res.json(processedExecutions);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getExecutionById = async (req, res) => {
  try {
    // Require authentication
    if (!req.user || !req.user._id) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const execution = await Execution.findOne({ _id: req.params.id, userId: req.user._id })
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
    // Require authentication
    if (!req.user || !req.user._id) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const { dagId } = req.body;
    
    // Ensure DAG belongs to user
    const dag = await DAG.findOne({ _id: dagId, userId: req.user._id });
    if (!dag) {
      return res.status(404).json({ success: false, message: "DAG not found" });
    }

    const execution = await Execution.create({
      dagId: dag._id,
      userId: req.user._id,
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
    // Require authentication
    if (!req.user || !req.user._id) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const execution = await Execution.findOne({ _id: req.params.id, userId: req.user._id }).populate("dagId");
    
    if (!execution) {
      return res.status(404).json({ success: false, message: "Execution not found" });
    }

    if (execution.status !== "failed") {
      return res.status(400).json({ success: false, message: "Can only retry failed executions" });
    }

    const dag = execution.dagId;
    const newExecution = await Execution.create({
      dagId: dag._id,
      userId: req.user._id,
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

export const deleteExecution = async (req, res) => {
  try {
    // Require authentication
    if (!req.user || !req.user._id) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const execution = await Execution.findOne({ _id: req.params.id, userId: req.user._id });
    
    if (!execution) {
      return res.status(404).json({ success: false, message: "Execution not found" });
    }

    // Don't allow deleting running or queued executions
    if (execution.status === "running" || execution.status === "queued") {
      return res.status(400).json({ success: false, message: "Cannot delete running or queued executions" });
    }

    await Execution.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    res.json({ success: true, message: "Execution deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteAllExecutions = async (req, res) => {
  try {
    // Require authentication
    if (!req.user || !req.user._id) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    // Only delete completed executions (success, failed, cancelled) for this user
    const result = await Execution.deleteMany({
      userId: req.user._id,
      status: { $in: ["success", "failed", "cancelled"] }
    });
    
    res.json({ 
      success: true, 
      message: `Deleted ${result.deletedCount} execution(s)`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

