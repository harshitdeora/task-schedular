import Variable from "../models/Variable.js";
import { sendResponse } from "../utils/response.js";

export const getVariables = async (req, res) => {
  try {
    const variables = await Variable.find({ userId: req.user._id }).select("-value");
    return sendResponse(res, 200, { variables });
  } catch (error) {
    return sendResponse(res, 500, { error: error.message });
  }
};

export const getVariable = async (req, res) => {
  try {
    const variable = await Variable.findOne({ 
      _id: req.params.id, 
      userId: req.user._id 
    });
    
    if (!variable) {
      return sendResponse(res, 404, { error: "Variable not found" });
    }

    // Return decrypted value for secrets
    const variableData = variable.toObject();
    if (variable.isSecret) {
      variableData.value = variable.getDecryptedValue();
    }

    return sendResponse(res, 200, { variable: variableData });
  } catch (error) {
    return sendResponse(res, 500, { error: error.message });
  }
};

export const createVariable = async (req, res) => {
  try {
    const { name, value, isSecret, description, tags } = req.body;

    if (!name || value === undefined) {
      return sendResponse(res, 400, { error: "Name and value are required" });
    }

    const variable = await Variable.create({
      userId: req.user._id,
      name,
      value,
      isSecret: isSecret || false,
      description,
      tags: tags || []
    });

    const variableData = variable.toObject();
    if (variable.isSecret) {
      variableData.value = "***"; // Don't expose secret values
    }

    return sendResponse(res, 201, { variable: variableData });
  } catch (error) {
    if (error.code === 11000) {
      return sendResponse(res, 400, { error: "Variable with this name already exists" });
    }
    return sendResponse(res, 500, { error: error.message });
  }
};

export const updateVariable = async (req, res) => {
  try {
    const { name, value, isSecret, description, tags } = req.body;

    const variable = await Variable.findOne({ 
      _id: req.params.id, 
      userId: req.user._id 
    });

    if (!variable) {
      return sendResponse(res, 404, { error: "Variable not found" });
    }

    if (name) variable.name = name;
    if (value !== undefined) variable.value = value;
    if (isSecret !== undefined) variable.isSecret = isSecret;
    if (description !== undefined) variable.description = description;
    if (tags !== undefined) variable.tags = tags;

    await variable.save();

    const variableData = variable.toObject();
    if (variable.isSecret) {
      variableData.value = "***";
    }

    return sendResponse(res, 200, { variable: variableData });
  } catch (error) {
    if (error.code === 11000) {
      return sendResponse(res, 400, { error: "Variable with this name already exists" });
    }
    return sendResponse(res, 500, { error: error.message });
  }
};

export const deleteVariable = async (req, res) => {
  try {
    const variable = await Variable.findOneAndDelete({ 
      _id: req.params.id, 
      userId: req.user._id 
    });

    if (!variable) {
      return sendResponse(res, 404, { error: "Variable not found" });
    }

    return sendResponse(res, 200, { message: "Variable deleted successfully" });
  } catch (error) {
    return sendResponse(res, 500, { error: error.message });
  }
};


