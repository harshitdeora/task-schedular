import Variable from "../models/Variable.js";

/**
 * Substitute variables in a string or object
 * Supports {{variableName}} syntax
 */
export async function substituteVariables(text, userId, executionContext = {}) {
  if (!text) return text;

  // If it's an object, recursively process all string values
  if (typeof text === "object" && text !== null && !Array.isArray(text)) {
    const result = {};
    for (const [key, value] of Object.entries(text)) {
      result[key] = await substituteVariables(value, userId, executionContext);
    }
    return result;
  }

  // If it's an array, process each element
  if (Array.isArray(text)) {
    return Promise.all(text.map(item => substituteVariables(item, userId, executionContext)));
  }

  // If it's not a string, return as-is
  if (typeof text !== "string") {
    return text;
  }

  // Find all variable references {{variableName}}
  const variableRegex = /\{\{([^}]+)\}\}/g;
  const matches = [...text.matchAll(variableRegex)];

  if (matches.length === 0) {
    return text;
  }

  // Get all unique variable names
  const variableNames = [...new Set(matches.map(m => m[1].trim()))];

  // Fetch variables from database
  const variables = await Variable.find({
    userId,
    name: { $in: variableNames }
  });

  const variableMap = {};
  variables.forEach(v => {
    variableMap[v.name] = v.getDecryptedValue();
  });

  // Also include execution context variables (prefixed with execution.)
  const contextMap = {};
  Object.keys(executionContext).forEach(key => {
    contextMap[`execution.${key}`] = executionContext[key];
  });

  // Replace variables
  let result = text;
  matches.forEach(match => {
    const varName = match[1].trim();
    let value = null;

    // Check execution context first
    if (contextMap[varName] !== undefined) {
      value = contextMap[varName];
    } else if (variableMap[varName] !== undefined) {
      value = variableMap[varName];
    } else {
      // Variable not found, leave as-is or use empty string
      value = match[0]; // Keep original {{variableName}}
    }

    if (value !== null && value !== match[0]) {
      result = result.replace(match[0], String(value));
    }
  });

  return result;
}

/**
 * Get variable value by name
 */
export async function getVariableValue(name, userId) {
  const variable = await Variable.findOne({ name, userId });
  return variable ? variable.getDecryptedValue() : null;
}


