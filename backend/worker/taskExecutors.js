// Comprehensive task executors for different task types
import axios from "axios";
import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import mongoose from "mongoose";

const execAsync = promisify(exec);

/**
 * HTTP Task Executor
 * Supports GET, POST, PUT, DELETE, PATCH with custom headers, auth, and body
 */
export async function executeHttpTask(task) {
  const {
    url,
    method = "GET",
    headers = {},
    body,
    auth,
    timeoutSeconds = 30
  } = task.config || {};

  if (!url) {
    throw new Error("HTTP task requires 'url' in config");
  }

  const axiosConfig = {
    method: method.toUpperCase(),
    url,
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    timeout: timeoutSeconds * 1000
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
  if (["POST", "PUT", "PATCH"].includes(method.toUpperCase()) && body) {
    axiosConfig.data = typeof body === "string" ? JSON.parse(body) : body;
  }

  const response = await axios(axiosConfig);
  return {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
    data: response.data
  };
}

/**
 * Email Task Executor
 * Sends emails using SMTP (requires nodemailer)
 */
export async function executeEmailTask(task) {
  const { to, subject, body, from, smtp, scheduled, scheduledDateTime } = task.config || {};
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

    const mailOptions = {
      from: from || smtpConfig.user,
      to: Array.isArray(to) ? to.join(", ") : to,
      subject,
      text: body,
      html: task.config.html || body
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
  const { script, language = "node", workingDir, env } = task.config || {};

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
      await fs.writeFile(scriptFile, script, "utf8");
      command = `node "${scriptFile}"`;
      break;

    case "python":
    case "py":
      scriptFile = path.join(scriptDir, `task-${Date.now()}.py`);
      await fs.writeFile(scriptFile, script, "utf8");
      command = `python "${scriptFile}"`;
      break;

    case "bash":
    case "sh":
    case "shell":
      scriptFile = path.join(scriptDir, `task-${Date.now()}.sh`);
      await fs.writeFile(scriptFile, script, "utf8");
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

