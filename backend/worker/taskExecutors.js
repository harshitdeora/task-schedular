// Comprehensive task executors for different task types
import axios from "axios";
import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import mongoose from "mongoose";
import { substituteVariables } from "../utils/variableSubstitution.js";

const execAsync = promisify(exec);

/**
 * HTTP Task Executor
 * Production-grade HTTP request executor with security, query params, and comprehensive response handling
 * Supports GET, POST, PUT, DELETE, PATCH with custom headers, auth, body, and query parameters
 */
export async function executeHttpTask(task) {
  const startTime = Date.now();
  
  const {
    url,
    method = "GET",
    headers = {},
    queryParams = {},
    body,
    auth,
    timeout = 30000,
    timeoutMs = 30000,
    timeoutSeconds = 30
  } = task.config || {};

  if (!url) {
    throw new Error("HTTP task requires 'url' in config");
  }

  // Validate URL is a string and trim whitespace
  const urlString = String(url).trim();
  if (!urlString) {
    throw new Error("HTTP task requires a non-empty 'url' in config");
  }

  // Security: SSRF Protection - Block internal/private IP ranges
  try {
    // First, validate that URL starts with http:// or https://
    const lowerUrl = urlString.toLowerCase();
    if (!lowerUrl.startsWith("http://") && !lowerUrl.startsWith("https://")) {
      throw new Error(`SSRF Protection: URL must start with http:// or https://. Got: ${urlString.substring(0, 50)}`);
    }

    const urlObj = new URL(urlString);
    const hostname = urlObj.hostname;
    
    // Validate protocol after parsing
    if (!["http:", "https:"].includes(urlObj.protocol)) {
      throw new Error(`SSRF Protection: Only http and https protocols are allowed. Got: ${urlObj.protocol}`);
    }
    
    // Block localhost and private IP ranges
    const blockedPatterns = [
      /^localhost$/i,
      /^127\./,
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^::1$/,
      /^fc00:/,
      /^fe80:/
    ];
    
    if (blockedPatterns.some(pattern => pattern.test(hostname))) {
      throw new Error(`SSRF Protection: Blocked internal/private IP address: ${hostname}`);
    }
  } catch (error) {
    if (error.message.includes("SSRF Protection") || error.message.includes("Invalid URL")) {
      throw error;
    }
    throw new Error(`Invalid URL format: ${error.message}`);
  }

  // Build URL with query parameters
  let finalUrl = urlString;
  if (queryParams && Object.keys(queryParams).length > 0) {
    const urlObj = new URL(urlString);
    Object.entries(queryParams).forEach(([key, value]) => {
      if (key && value !== null && value !== undefined) {
        urlObj.searchParams.append(key, String(value));
      }
    });
    finalUrl = urlObj.toString();
  }

  // Calculate timeout (prefer timeoutMs, then timeout, then timeoutSeconds)
  const timeoutValue = timeoutMs || timeout || (timeoutSeconds * 1000);
  const maxTimeout = 300000; // 5 minutes max
  const finalTimeout = Math.min(Math.max(timeoutValue, 1000), maxTimeout);

  const axiosConfig = {
    method: method.toUpperCase(),
    url: finalUrl,
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    timeout: finalTimeout,
    validateStatus: () => true // Don't throw on non-2xx, we'll handle it
  };

  // Add authentication
  if (auth) {
    if (auth.type === "bearer") {
      axiosConfig.headers.Authorization = `Bearer ${auth.token}`;
    } else if (auth.type === "basic") {
      const credentials = Buffer.from(`${auth.username}:${auth.password}`).toString("base64");
      axiosConfig.headers.Authorization = `Basic ${credentials}`;
    } else if (auth.type === "apikey") {
      axiosConfig.headers[auth.headerName || "X-API-Key"] = auth.apiKey;
    }
  }

  // Add body for POST, PUT, PATCH
  const methodUpper = method.toUpperCase();
  if (["POST", "PUT", "PATCH"].includes(methodUpper)) {
    if (body) {
      // Validate JSON if body is provided
      try {
        if (typeof body === "string") {
          axiosConfig.data = JSON.parse(body);
        } else {
          axiosConfig.data = body;
        }
      } catch (parseError) {
        throw new Error(`Invalid JSON body: ${parseError.message}`);
      }
    }
  } else if (["GET", "DELETE"].includes(methodUpper) && body) {
    // GET and DELETE should not have body, but some APIs allow it
    // We'll allow it but log a warning
    console.warn(`HTTP ${methodUpper} request with body - this is non-standard`);
    try {
      if (typeof body === "string") {
        axiosConfig.data = JSON.parse(body);
      } else {
        axiosConfig.data = body;
      }
    } catch (parseError) {
      throw new Error(`Invalid JSON body: ${parseError.message}`);
    }
  }

  try {
    const response = await axios(axiosConfig);
    const durationMs = Date.now() - startTime;
    
    // Determine success (2xx status codes)
    const success = response.status >= 200 && response.status < 300;
    
    // Mask sensitive headers in response for logging
    const maskedHeaders = { ...response.headers };
    if (maskedHeaders.authorization) {
      maskedHeaders.authorization = "***MASKED***";
    }
    if (maskedHeaders["x-api-key"]) {
      maskedHeaders["x-api-key"] = "***MASKED***";
    }
    
    // Format response body (try to parse as JSON if possible)
    let responseBody = response.data;
    if (typeof response.data === "string") {
      try {
        responseBody = JSON.parse(response.data);
      } catch {
        // Keep as string if not valid JSON
        responseBody = response.data;
      }
    }
    
    const result = {
      statusCode: response.status,
      statusText: response.statusText,
      responseBody: responseBody,
      responseHeaders: maskedHeaders,
      durationMs: durationMs,
      success: success,
      // Include full response for backward compatibility
      status: response.status,
      headers: maskedHeaders,
      data: responseBody
    };
    
    // If non-2xx, throw error but include response data
    if (!success) {
      const error = new Error(`HTTP ${response.status} ${response.statusText}`);
      error.response = result;
      throw error;
    }
    
    return result;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    
    // Handle axios errors
    if (error.response) {
      // Server responded with error status
      const maskedHeaders = { ...error.response.headers };
      if (maskedHeaders.authorization) {
        maskedHeaders.authorization = "***MASKED***";
      }
      
      let responseBody = error.response.data;
      if (typeof error.response.data === "string") {
        try {
          responseBody = JSON.parse(error.response.data);
        } catch {
          responseBody = error.response.data;
        }
      }
      
      const errorResult = {
        statusCode: error.response.status,
        statusText: error.response.statusText,
        responseBody: responseBody,
        responseHeaders: maskedHeaders,
        durationMs: durationMs,
        success: false,
        error: `HTTP ${error.response.status}: ${error.response.statusText}`
      };
      
      throw new Error(JSON.stringify(errorResult));
    } else if (error.request) {
      // Request was made but no response received (network error, timeout)
      const errorResult = {
        statusCode: 0,
        statusText: "No Response",
        responseBody: null,
        responseHeaders: {},
        durationMs: durationMs,
        success: false,
        error: error.code === "ECONNABORTED" ? "Request Timeout" : `Network Error: ${error.message}`
      };
      
      throw new Error(JSON.stringify(errorResult));
    } else {
      // Error in request setup
      const errorResult = {
        statusCode: 0,
        statusText: "Request Error",
        responseBody: null,
        responseHeaders: {},
        durationMs: durationMs,
        success: false,
        error: error.message
      };
      
      throw new Error(JSON.stringify(errorResult));
    }
  }
}

/**
 * Email Task Executor
 * Sends emails using SMTP (requires nodemailer)
 */
export async function executeEmailTask(task) {
  const { to, subject, body, from, smtp, scheduled, scheduledDateTime, attachments } = task.config || {};
  const executionId = task.executionId; // Get executionId from task object

  if (!to || !subject || !body) {
    throw new Error("Email task requires 'to', 'subject', and 'body' in config");
  }

  // Check if email is scheduled for future
  if (scheduled && scheduledDateTime) {
    const scheduledDate = new Date(scheduledDateTime);
    const now = new Date();
    
    // Only schedule if the time is more than 10 seconds in the future
    // If it's within 10 seconds, send immediately
    if (scheduledDate > new Date(now.getTime() + 10000)) {
      // Email is scheduled for future - create scheduled email entry
      try {
        const ScheduledEmail = (await import("../models/ScheduledEmail.js")).default;
        const Execution = (await import("../models/Execution.js")).default;
        const User = (await import("../models/User.js")).default;
        
        // Require user context so emails are always tied to the logged-in user
        if (!task.executionId) {
          throw new Error("Cannot schedule email without executionId/user context. Ensure the task is created by an authenticated user.");
        }

        let userEmail = null;
        let userId = null;

        const execution = await Execution.findById(task.executionId);
        if (execution && execution.userId) {
          const user = await User.findById(execution.userId);
          if (user) {
            userId = user._id;
            userEmail = user.email;
          }
        }

        if (!userId || !userEmail) {
          throw new Error("User SMTP settings required. Please save SMTP settings in Settings before scheduling emails.");
        }

        const scheduledEmail = await ScheduledEmail.create({
          userId: userId, // Set userId if available from execution
          executionId: task.executionId || null, // Link to execution
          taskNodeId: task.id || null, // Link to task node
          userEmail: userEmail,
          recipient: to,
          subject,
          message: body,
          scheduledDateTime: scheduledDate,
          status: "pending",
          from: from || userEmail
        });

        console.log(`📅 Email scheduled for ${scheduledDate.toLocaleString()}. Will be sent automatically.`);
        // Return special status to indicate task is scheduled, not completed
        return {
          scheduled: true,
          scheduledDateTime: scheduledDate,
          scheduledEmailId: scheduledEmail._id.toString(),
          message: `Email scheduled for ${scheduledDate.toLocaleString()}`,
          taskStatus: "scheduled" // Special status to indicate task is waiting
        };
      } catch (error) {
        console.error("Failed to schedule email:", error.message);
        // Continue to send immediately if scheduling fails
      }
    }
  }

  // Send email immediately
  try {
    const nodemailer = (await import("nodemailer")).default;
    const { decrypt } = await import("../utils/encryption.js");
    const Execution = (await import("../models/Execution.js")).default;
    const User = (await import("../models/User.js")).default;

    // Resolve user from execution; this enforces per-user SMTP
    let user = null;
    if (task.executionId) {
      try {
        const execution = await Execution.findById(task.executionId);
        if (execution && execution.userId) {
          user = await User.findById(execution.userId);
          if (!user) {
            console.error(`❌ User not found for userId: ${execution.userId}`);
          }
        } else {
          console.error(`❌ Execution ${task.executionId} missing userId`);
        }
      } catch (err) {
        console.error(`❌ Error fetching execution/user:`, err);
      }
    } else {
      console.error(`❌ Email task missing executionId`);
    }

    if (!user) {
      throw new Error("Email sending requires authenticated user context. Please ensure you're logged in and the execution has a userId.");
    }

    // Use the user's saved SMTP settings only (no global fallback)
    const settings = user.smtpSettings || {};
    if (!settings.password) {
      throw new Error("SMTP password is missing. Please configure your SMTP settings in Settings page.");
    }
    
    const decryptedPassword = decrypt(settings.password);
    if (!decryptedPassword) {
      throw new Error("Failed to decrypt SMTP password. Please update your SMTP settings in Settings page.");
    }
    
    if (!settings.host || !settings.user) {
      throw new Error(`SMTP settings incomplete. Missing: ${!settings.host ? 'host' : ''} ${!settings.user ? 'username' : ''}. Please configure in Settings page.`);
    }

    const smtpConfig = {
      host: settings.host,
      port: settings.port || 587,
      secure: settings.secure || false,
      user: settings.user,
      password: decryptedPassword
    };

    console.log(`📧 SMTP Config (user-scoped): ${smtpConfig.host}:${smtpConfig.port} (user: ${smtpConfig.user})`);

    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port || 587,
      secure: smtpConfig.secure || false,
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.password
      }
    });

    // Prepare attachments if provided
    let emailAttachments = [];
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      for (const attachment of attachments) {
        const filePath = attachment.path || attachment;
        const fileName = attachment.filename || path.basename(filePath);
        
        // Resolve file path (can be absolute or relative to working directory)
        const fullPath = path.isAbsolute(filePath) 
          ? filePath 
          : path.join(process.cwd(), filePath);
        
        try {
          // Check if file exists
          await fs.access(fullPath);
          
          emailAttachments.push({
            filename: fileName,
            path: fullPath
          });
          console.log(`📎 Attaching file: ${fullPath}`);
        } catch (err) {
          console.warn(`⚠️ Attachment file not found: ${fullPath}`);
          // Continue without this attachment
        }
      }
    }

    const mailOptions = {
      from: from || smtpConfig.user,
      to: Array.isArray(to) ? to.join(", ") : to,
      subject,
      text: body,
      html: task.config.html || body,
      attachments: emailAttachments.length > 0 ? emailAttachments : undefined
    };

    console.log(`📧 Attempting to send email to: ${to}`);
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent successfully! Message ID: ${info.messageId}`);
    return {
      messageId: info.messageId,
      response: info.response,
      accepted: info.accepted,
      rejected: info.rejected
    };
  } catch (error) {
    // Log detailed error and throw it so worker can handle retries
    console.error("❌ Email sending failed:", error.message);
    console.error("Error details:", {
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode
    });
    // Throw error so worker can retry or mark as failed
    throw new Error(`Email sending failed: ${error.message}`);
  }
}

/**
 * Database Task Executor
 * Executes database queries (MongoDB, PostgreSQL, MySQL)
 */
export async function executeDatabaseTask(task) {
  const { databaseType, connectionString, query, operation, collection, data } = task.config || {};

  if (!databaseType) {
    throw new Error("Database task requires 'databaseType' in config");
  }

  if (databaseType === "mongodb") {
    if (!connectionString && !collection) {
      throw new Error("MongoDB task requires 'connectionString' or 'collection' in config");
    }

    let conn;
    try {
      if (connectionString) {
        conn = await mongoose.createConnection(connectionString).asPromise();
      } else {
        // Use default connection
        conn = mongoose.connection;
      }

      const db = conn.db || mongoose.connection.db;
      const coll = db.collection(collection || "tasks");

      switch (operation?.toLowerCase()) {
        case "insert":
        case "create":
          const insertResult = await coll.insertMany(Array.isArray(data) ? data : [data]);
          return { insertedCount: insertResult.insertedCount, insertedIds: insertResult.insertedIds };
        
        case "find":
        case "read":
        case "select":
          const findQuery = query ? JSON.parse(query) : {};
          const findResult = await coll.find(findQuery).toArray();
          return { count: findResult.length, data: findResult };
        
        case "update":
          const updateQuery = query ? JSON.parse(query) : {};
          const updateData = data || {};
          const updateResult = await coll.updateMany(updateQuery, { $set: updateData });
          return { matchedCount: updateResult.matchedCount, modifiedCount: updateResult.modifiedCount };
        
        case "delete":
        case "remove":
          const deleteQuery = query ? JSON.parse(query) : {};
          const deleteResult = await coll.deleteMany(deleteQuery);
          return { deletedCount: deleteResult.deletedCount };
        
        default:
          // Execute raw query
          if (query) {
            const result = await coll.find(JSON.parse(query)).toArray();
            return { data: result };
          }
          throw new Error(`Unknown operation: ${operation}`);
      }
    } finally {
      if (conn && connectionString) {
        await conn.close();
      }
    }
  } else if (databaseType === "postgresql" || databaseType === "mysql") {
    // For PostgreSQL/MySQL, we'd need pg or mysql2 packages
    throw new Error(`${databaseType} support requires additional packages. Use MongoDB for now.`);
  } else {
    throw new Error(`Unsupported database type: ${databaseType}`);
  }
}

/**
 * Script Task Executor
 * Executes Node.js, Python, or Bash scripts
 */
export async function executeScriptTask(task) {
  const { script, language = "node", workingDir, env, inputData } = task.config || {};

  if (!script) {
    throw new Error("Script task requires 'script' in config");
  }

  const scriptDir = workingDir || path.join(process.cwd(), "scripts");
  await fs.mkdir(scriptDir, { recursive: true });

  let command;
  let scriptFile;

  switch (language.toLowerCase()) {
    case "node":
    case "javascript":
    case "js":
      scriptFile = path.join(scriptDir, `task-${Date.now()}.js`);
      
      // Inject input data into the script
      // If inputData is provided, wrap the script to define 'input' variable
      let scriptContent = script;
      if (inputData !== undefined && inputData !== null) {
        // Stringify and escape for safe injection into JavaScript
        const inputJson = JSON.stringify(inputData).replace(/`/g, '\\`').replace(/\$/g, '\\$');
        scriptContent = `const input = ${inputJson};\n\n${script}`;
      }
      
      await fs.writeFile(scriptFile, scriptContent, "utf8");
      command = `node "${scriptFile}"`;
      break;

    case "python":
    case "py":
      scriptFile = path.join(scriptDir, `task-${Date.now()}.py`);
      
      // Inject input data into Python script
      let pythonScript = script;
      if (inputData !== undefined) {
        const inputJson = JSON.stringify(inputData);
        pythonScript = `import json\ninput = json.loads('${inputJson.replace(/'/g, "\\'")}')\n\n${script}`;
      }
      
      await fs.writeFile(scriptFile, pythonScript, "utf8");
      command = `python "${scriptFile}"`;
      break;

    case "bash":
    case "sh":
    case "shell":
      scriptFile = path.join(scriptDir, `task-${Date.now()}.sh`);
      
      // Inject input data into bash script via environment variable
      let bashScript = script;
      if (inputData !== undefined) {
        const inputJson = JSON.stringify(inputData);
        bashScript = `INPUT_DATA='${inputJson.replace(/'/g, "'\\''")}'\n# Parse with: input=$(echo "$INPUT_DATA" | jq .)\n\n${script}`;
      }
      
      await fs.writeFile(scriptFile, bashScript, "utf8");
      await fs.chmod(scriptFile, 0o755);
      command = `bash "${scriptFile}"`;
      break;

    default:
      throw new Error(`Unsupported script language: ${language}`);
  }

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: scriptDir,
      env: { ...process.env, ...env },
      timeout: (task.config?.timeoutSeconds || 60) * 1000
    });

    // Clean up script file
    try {
      await fs.unlink(scriptFile);
    } catch (e) {}

    return {
      stdout,
      stderr: stderr || "",
      exitCode: 0
    };
  } catch (error) {
    // Clean up script file
    try {
      await fs.unlink(scriptFile);
    } catch (e) {}

    throw new Error(`Script execution failed: ${error.message}`);
  }
}

/**
 * File Task Executor
 * Reads, writes, or manipulates files
 */
export async function executeFileTask(task) {
  const { operation, filePath, content, encoding = "utf8" } = task.config || {};

  if (!operation || !filePath) {
    throw new Error("File task requires 'operation' and 'filePath' in config");
  }

  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);

  switch (operation.toLowerCase()) {
    case "read":
      const fileContent = await fs.readFile(fullPath, encoding);
      return { content: fileContent, size: fileContent.length };

    case "write":
      if (!content) {
        throw new Error("Write operation requires 'content' in config");
      }
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content, encoding);
      return { message: "File written successfully", path: fullPath };

    case "append":
      if (!content) {
        throw new Error("Append operation requires 'content' in config");
      }
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.appendFile(fullPath, content, encoding);
      return { message: "Content appended successfully", path: fullPath };

    case "delete":
    case "remove":
      await fs.unlink(fullPath);
      return { message: "File deleted successfully", path: fullPath };

    case "exists":
      try {
        await fs.access(fullPath);
        return { exists: true, path: fullPath };
      } catch {
        return { exists: false, path: fullPath };
      }

    case "copy":
      const { destination } = task.config;
      if (!destination) {
        throw new Error("Copy operation requires 'destination' in config");
      }
      const destPath = path.isAbsolute(destination) ? destination : path.join(process.cwd(), destination);
      await fs.mkdir(path.dirname(destPath), { recursive: true });
      await fs.copyFile(fullPath, destPath);
      return { message: "File copied successfully", source: fullPath, destination: destPath };

    default:
      throw new Error(`Unsupported file operation: ${operation}`);
  }
}

/**
 * Webhook Task Executor
 * Sends HTTP requests to webhook URLs
 */
export async function executeWebhookTask(task) {
  const {
    url,
    method = "POST",
    headers = {},
    payload,
    secret,
    signatureHeader = "X-Webhook-Signature"
  } = task.config || {};

  if (!url) {
    throw new Error("Webhook task requires 'url' in config");
  }

  const axiosConfig = {
    method: method.toUpperCase(),
    url,
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    timeout: (task.config?.timeoutSeconds || 30) * 1000
  };

  // Add payload
  if (payload) {
    axiosConfig.data = typeof payload === "string" ? JSON.parse(payload) : payload;
  }

  // Add signature if secret provided
  if (secret && payload) {
    const crypto = await import("crypto");
    const payloadString = typeof payload === "string" ? payload : JSON.stringify(payload);
    const signature = crypto.createHmac("sha256", secret).update(payloadString).digest("hex");
    axiosConfig.headers[signatureHeader] = signature;
  }

  const response = await axios(axiosConfig);
  return {
    status: response.status,
    data: response.data,
    headers: response.headers
  };
}

/**
 * Delay Task Executor
 * Waits for a specified duration
 */
export async function executeDelayTask(task) {
  const { durationSeconds = 1, durationMs } = task.config || {};

  const delayMs = durationMs || (durationSeconds * 1000);

  if (delayMs < 0 || delayMs > 3600000) {
    throw new Error("Delay must be between 0 and 3600000ms (1 hour)");
  }

  await new Promise(resolve => setTimeout(resolve, delayMs));
  return { delayed: delayMs, message: `Delayed for ${delayMs}ms` };
}

/**
 * Notification Task Executor
 * Sends notifications to Slack, Discord, etc.
 */
export async function executeNotificationTask(task) {
  const { platform, webhookUrl, message, title, color } = task.config || {};

  if (!platform || !webhookUrl || !message) {
    throw new Error("Notification task requires 'platform', 'webhookUrl', and 'message' in config");
  }

  let payload;

  switch (platform.toLowerCase()) {
    case "slack":
      payload = {
        text: title || message,
        attachments: [{
          color: color || "good",
          text: message,
          footer: "Task Scheduler",
          ts: Math.floor(Date.now() / 1000)
        }]
      };
      break;

    case "discord":
      payload = {
        embeds: [{
          title: title || "Task Notification",
          description: message,
          color: color ? parseInt(color.replace("#", ""), 16) : 3066993,
          timestamp: new Date().toISOString()
        }]
      };
      break;

    default:
      throw new Error(`Unsupported notification platform: ${platform}`);
  }

  const response = await axios.post(webhookUrl, payload, {
    headers: { "Content-Type": "application/json" },
    timeout: 10000
  });

  return {
    platform,
    status: response.status,
    message: "Notification sent successfully"
  };
}

/**
 * Data Transformation Task Executor
 * Transforms data using JavaScript
 */
export async function executeTransformTask(task) {
  const { inputData, transformFunction } = task.config || {};

  if (!transformFunction) {
    throw new Error("Transform task requires 'transformFunction' in config");
  }

  try {
    // Create a safe execution context
    const input = inputData || {};
    const func = new Function("input", "return " + transformFunction);
    const result = func(input);
    return { transformed: result, inputData: input };
  } catch (error) {
    throw new Error(`Transform function error: ${error.message}`);
  }
}

/**
 * Conditional Logic Task Executor
 * Evaluates conditions and returns boolean result
 */
export async function executeConditionTask(task) {
  const { condition, inputData, operator = "equals" } = task.config || {};

  if (!condition) {
    throw new Error("Condition task requires 'condition' in config");
  }

  try {
    const input = inputData || {};
    let result = false;

    // Support different condition types
    if (typeof condition === "object" && condition.field && condition.value) {
      const fieldValue = condition.field.includes(".") 
        ? condition.field.split(".").reduce((obj, key) => obj?.[key], input)
        : input[condition.field];

      switch (operator.toLowerCase()) {
        case "equals":
        case "==":
          result = fieldValue == condition.value;
          break;
        case "notequals":
        case "!=":
          result = fieldValue != condition.value;
          break;
        case "greaterthan":
        case ">":
          result = Number(fieldValue) > Number(condition.value);
          break;
        case "lessthan":
        case "<":
          result = Number(fieldValue) < Number(condition.value);
          break;
        case "contains":
          result = String(fieldValue).includes(String(condition.value));
          break;
        case "exists":
          result = fieldValue !== undefined && fieldValue !== null;
          break;
        case "regex":
          const regex = new RegExp(condition.value);
          result = regex.test(String(fieldValue));
          break;
        default:
          result = fieldValue == condition.value;
      }
    } else if (typeof condition === "string") {
      // Evaluate JavaScript expression
      const func = new Function("input", `return ${condition}`);
      result = Boolean(func(input));
    }

    return {
      condition: condition,
      result: result,
      inputData: input,
      passed: result
    };
  } catch (error) {
    throw new Error(`Condition evaluation error: ${error.message}`);
  }
}

/**
 * AI Smart-Logic Task Executor
 * Integrates OpenAI or Google Generative AI with dynamic prompt substitution
 */
export async function executeAiLogicTask(task) {
  const { provider = "openai", prompt, model, temperature = 0.7, maxTokens, apiKeyVariable } = task.config || {};

  if (!prompt) {
    throw new Error("AI Logic task requires 'prompt' in config");
  }

  try {
    // Get API key from variables if apiKeyVariable is provided
    let apiKey = null;
    if (apiKeyVariable && task.executionId) {
      const Execution = (await import("../models/Execution.js")).default;
      const Variable = (await import("../models/Variable.js")).default;
      const execution = await Execution.findById(task.executionId);
      
      if (execution && execution.userId) {
        const variable = await Variable.findOne({ 
          userId: execution.userId, 
          name: apiKeyVariable 
        });
        if (variable) {
          apiKey = variable.getDecryptedValue();
        }
      }
    }

    // Fallback to config API key if variable not found
    if (!apiKey && task.config.apiKey) {
      apiKey = task.config.apiKey;
    }

    if (!apiKey) {
      throw new Error(`API key not found. Please set 'apiKeyVariable' or 'apiKey' in config`);
    }

    if (provider === "openai" || provider === "gpt") {
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({ apiKey });

      const response = await openai.chat.completions.create({
        model: model || "gpt-3.5-turbo",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: temperature,
        max_tokens: maxTokens || 1000
      });

      const content = response.choices[0]?.message?.content || "";
      
      // Try to parse as JSON if possible
      let parsedContent = content;
      try {
        parsedContent = JSON.parse(content);
      } catch {
        // Not JSON, return as string
      }      return {
        provider: "openai",
        model: model || "gpt-3.5-turbo",
        response: parsedContent,
        rawResponse: content,
        usage: response.usage
      };
    } else if (provider === "google" || provider === "gemini") {
      try {
        const { GoogleGenerativeAI } = await import("@google/generative-ai");
        const genAI = new GoogleGenerativeAI(apiKey);
        const modelInstance = genAI.getGenerativeModel({ model: model || "gemini-pro" });

        const result = await modelInstance.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Try to parse as JSON if possible
        let parsedText = text;
        try {
          parsedText = JSON.parse(text);
        } catch {
          // Not JSON, return as string
        }

        return {
          provider: "google",
          model: model || "gemini-pro",
          response: parsedText,
          rawResponse: text
        };
      } catch (importError) {
        if (importError.message.includes("Cannot find module") || importError.code === "MODULE_NOT_FOUND") {
          throw new Error("Google Generative AI package not installed. Run: npm install @google/generative-ai");
        }
        throw importError;
      }
    } else {
      throw new Error(`Unsupported AI provider: ${provider}. Supported: openai, google`);
    }
  } catch (error) {
    throw new Error(`AI Logic task failed: ${error.message}`);
  }
}

/**
 * PDF Generator Task Executor
 * Converts HTML/Text to PDF using Puppeteer
 */
export async function executePdfGenTask(task) {
  const { html, text, outputPath, format = "A4", margin = {}, landscape = false } = task.config || {};

  if (!html && !text) {
    throw new Error("PDF Generator task requires 'html' or 'text' in config");
  }

  try {
    const puppeteer = (await import("puppeteer")).default;
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();
      
      // Use HTML if provided, otherwise convert text to HTML
      const content = html || `<html><body><pre style="font-family: Arial, sans-serif; padding: 20px;">${text}</pre></body></html>`;
      
      await page.setContent(content, { waitUntil: 'networkidle0' });

      const pdfOptions = {
        format: format,
        landscape: landscape,
        margin: {
          top: margin.top || "1cm",
          right: margin.right || "1cm",
          bottom: margin.bottom || "1cm",
          left: margin.left || "1cm"
        },
        printBackground: true
      };

      // Generate output path if not provided
      const finalOutputPath = outputPath || path.join(process.cwd(), "tmp", `pdf-${Date.now()}.pdf`);
      await fs.mkdir(path.dirname(finalOutputPath), { recursive: true });

      const pdfBuffer = await page.pdf(pdfOptions);
      await fs.writeFile(finalOutputPath, pdfBuffer);

      return {
        success: true,
        outputPath: finalOutputPath,
        size: pdfBuffer.length,
        format: format,
        message: `PDF generated successfully at ${finalOutputPath}`
      };
    } finally {
      await browser.close();
    }
  } catch (error) {
    throw new Error(`PDF generation failed: ${error.message}`);
  }
}

/**
 * JSON Parser/Filter Task Executor
 * Extracts data from JSON using key paths (e.g., results[0].id)
 */
export async function executeJsonFilterTask(task) {
  const { jsonData, keyPath, defaultValue = null } = task.config || {};

  if (!jsonData && !keyPath) {
    throw new Error("JSON Filter task requires 'jsonData' and 'keyPath' in config");
  }

  try {
    // Parse JSON if it's a string
    let data = jsonData;
    if (typeof jsonData === "string") {
      try {
        data = JSON.parse(jsonData);
      } catch {
        throw new Error("Invalid JSON string in jsonData");
      }
    }

    // Navigate through the key path
    const keys = keyPath.split(/[\.\[\]]/).filter(k => k !== "");
    let result = data;

    for (const key of keys) {
      if (result === null || result === undefined) {
        return { value: defaultValue, keyPath, found: false };
      }

      // Handle array indices
      if (/^\d+$/.test(key)) {
        const index = parseInt(key, 10);
        if (Array.isArray(result) && index >= 0 && index < result.length) {
          result = result[index];
        } else {
          return { value: defaultValue, keyPath, found: false };
        }
      } else {
        // Handle object keys
        if (typeof result === "object" && key in result) {
          result = result[key];
        } else {
          return { value: defaultValue, keyPath, found: false };
        }
      }
    }

    return {
      value: result,
      keyPath,
      found: true,
      type: typeof result
    };
  } catch (error) {
    throw new Error(`JSON Filter task failed: ${error.message}`);
  }
}

/**
 * Image Processor Task Executor
 * Resizes, compresses, and converts images using Sharp
 */
export async function executeImageProcTask(task) {
  const { inputPath, outputPath, width, height, format, quality = 80, fit = "cover" } = task.config || {};

  if (!inputPath) {
    throw new Error("Image Processor task requires 'inputPath' in config");
  }

  try {
    const sharp = (await import("sharp")).default;
    
    // Resolve input path
    const fullInputPath = path.isAbsolute(inputPath) 
      ? inputPath 
      : path.join(process.cwd(), inputPath);

    // Check if file exists
    await fs.access(fullInputPath);

    // Generate output path if not provided
    const fullOutputPath = outputPath 
      ? (path.isAbsolute(outputPath) ? outputPath : path.join(process.cwd(), outputPath))
      : path.join(process.cwd(), "tmp", `image-${Date.now()}.${format || "jpg"}`);

    await fs.mkdir(path.dirname(fullOutputPath), { recursive: true });

    let image = sharp(fullInputPath);

    // Resize if dimensions provided
    if (width || height) {
      image = image.resize(width || null, height || null, {
        fit: fit, // cover, contain, fill, inside, outside
        withoutEnlargement: true
      });
    }

    // Convert format and apply quality
    if (format) {
      const formatOptions = {};
      if (quality && ["jpeg", "jpg", "webp", "avif"].includes(format.toLowerCase())) {
        formatOptions.quality = quality;
      }
      image = image.toFormat(format.toLowerCase(), formatOptions);
    } else {
      // Apply quality to original format if supported
      const metadata = await image.metadata();
      if (["jpeg", "jpg", "webp", "avif"].includes(metadata.format)) {
        image = image.jpeg({ quality: quality });
      }
    }

    await image.toFile(fullOutputPath);
    const stats = await fs.stat(fullOutputPath);

    return {
      success: true,
      inputPath: fullInputPath,
      outputPath: fullOutputPath,
      size: stats.size,
      format: format || (await sharp(fullOutputPath).metadata()).format,
      width: width || null,
      height: height || null,
      message: `Image processed successfully`
    };
  } catch (error) {
    throw new Error(`Image processing failed: ${error.message}`);
  }
}

/**
 * HTML to Markdown Transformer Task Executor
 * Converts HTML to clean markdown text using node-html-markdown
 */
export async function executeHtmlToMdTask(task) {
  const { html, outputPath } = task.config || {};

  if (!html) {
    throw new Error("HTML to Markdown task requires 'html' in config");
  }

  try {
    const { NodeHtmlMarkdown } = (await import("node-html-markdown"));
    const converter = new NodeHtmlMarkdown();

    const markdown = converter.translate(html);

    // Save to file if outputPath provided
    if (outputPath) {
      const fullOutputPath = path.isAbsolute(outputPath) 
        ? outputPath 
        : path.join(process.cwd(), outputPath);
      
      await fs.mkdir(path.dirname(fullOutputPath), { recursive: true });
      await fs.writeFile(fullOutputPath, markdown, "utf8");

      return {
        success: true,
        markdown: markdown,
        outputPath: fullOutputPath,
        length: markdown.length,
        message: `Markdown saved to ${fullOutputPath}`
      };
    }

    return {
      success: true,
      markdown: markdown,
      length: markdown.length,
      message: "HTML converted to markdown successfully"
    };
  } catch (error) {
    throw new Error(`HTML to Markdown conversion failed: ${error.message}`);
  }
}