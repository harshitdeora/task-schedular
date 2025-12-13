import crypto from "crypto";
import DagTrigger from "../models/DagTrigger.js";
import DAG from "../models/Dag.js";
import { sendResponse } from "../utils/response.js";
import { triggerDAG } from "../scheduler/scheduler.js";

export const createTrigger = async (req, res) => {
  try {
    const { dagId, name, type, method, webhookPath } = req.body;

    if (!dagId || !name || !type) {
      return sendResponse(res, 400, { error: "dagId, name, and type are required" });
    }

    // Verify DAG belongs to user
    const dag = await DAG.findOne({ _id: dagId, userId: req.user._id });
    if (!dag) {
      return sendResponse(res, 404, { error: "DAG not found" });
    }

    const trigger = await DagTrigger.create({
      dagId,
      userId: req.user._id,
      name,
      type,
      method: method || "POST",
      webhookPath: webhookPath || `/api/triggers/${crypto.randomBytes(16).toString("hex")}`
    });

    return sendResponse(res, 201, { trigger });
  } catch (error) {
    return sendResponse(res, 500, { error: error.message });
  }
};

export const getTriggers = async (req, res) => {
  try {
    const triggers = await DagTrigger.find({ userId: req.user._id })
      .populate("dagId", "name description");
    return sendResponse(res, 200, { triggers });
  } catch (error) {
    return sendResponse(res, 500, { error: error.message });
  }
};

export const getTrigger = async (req, res) => {
  try {
    const trigger = await DagTrigger.findOne({ 
      _id: req.params.id, 
      userId: req.user._id 
    }).populate("dagId");

    if (!trigger) {
      return sendResponse(res, 404, { error: "Trigger not found" });
    }

    return sendResponse(res, 200, { trigger });
  } catch (error) {
    return sendResponse(res, 500, { error: error.message });
  }
};

export const updateTrigger = async (req, res) => {
  try {
    const trigger = await DagTrigger.findOne({ 
      _id: req.params.id, 
      userId: req.user._id 
    });

    if (!trigger) {
      return sendResponse(res, 404, { error: "Trigger not found" });
    }

    const { name, enabled, method, webhookPath } = req.body;
    if (name) trigger.name = name;
    if (enabled !== undefined) trigger.enabled = enabled;
    if (method) trigger.method = method;
    if (webhookPath) trigger.webhookPath = webhookPath;

    await trigger.save();

    return sendResponse(res, 200, { trigger });
  } catch (error) {
    return sendResponse(res, 500, { error: error.message });
  }
};

export const deleteTrigger = async (req, res) => {
  try {
    const trigger = await DagTrigger.findOneAndDelete({ 
      _id: req.params.id, 
      userId: req.user._id 
    });

    if (!trigger) {
      return sendResponse(res, 404, { error: "Trigger not found" });
    }

    return sendResponse(res, 200, { message: "Trigger deleted successfully" });
  } catch (error) {
    return sendResponse(res, 500, { error: error.message });
  }
};

// Public endpoint to trigger DAG via token
export const triggerDagByToken = async (req, res) => {
  try {
    const { token } = req.params;
    const trigger = await DagTrigger.findOne({ token, enabled: true })
      .populate("dagId");

    if (!trigger) {
      return sendResponse(res, 404, { error: "Invalid or disabled trigger" });
    }

    if (!trigger.dagId) {
      return sendResponse(res, 404, { error: "DAG not found" });
    }

    // Check if method matches
    if (req.method !== trigger.method && trigger.method !== "POST") {
      return sendResponse(res, 405, { error: `Method ${req.method} not allowed. Use ${trigger.method}` });
    }

    // Trigger the DAG
    await triggerDAG(trigger.dagId._id);

    return sendResponse(res, 200, { 
      message: "DAG triggered successfully",
      dagId: trigger.dagId._id,
      dagName: trigger.dagId.name
    });
  } catch (error) {
    return sendResponse(res, 500, { error: error.message });
  }
};

// Public endpoint to trigger DAG via webhook path
export const triggerDagByWebhook = async (req, res) => {
  try {
    const { path } = req.params;
    const trigger = await DagTrigger.findOne({ 
      webhookPath: `/api/triggers/webhook/${path}`, 
      enabled: true,
      type: "webhook"
    }).populate("dagId");

    if (!trigger) {
      return sendResponse(res, 404, { error: "Webhook not found" });
    }

    if (!trigger.dagId) {
      return sendResponse(res, 404, { error: "DAG not found" });
    }

    // Trigger the DAG
    await triggerDAG(trigger.dagId._id);

    return sendResponse(res, 200, { 
      message: "DAG triggered successfully",
      dagId: trigger.dagId._id,
      dagName: trigger.dagId.name
    });
  } catch (error) {
    return sendResponse(res, 500, { error: error.message });
  }
};

