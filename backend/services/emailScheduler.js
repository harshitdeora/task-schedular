import ScheduledEmail from "../models/ScheduledEmail.js";
import User from "../models/User.js";
import nodemailer from "nodemailer";

// Helper function to check and update execution status
async function checkAndUpdateExecutionStatus(execDoc, dagDoc) {
  try {
    // Only check if execution is still running
    if (execDoc.status !== "running" && execDoc.status !== "queued") {
      return;
    }

    const dagNodes = dagDoc ? dagDoc.graph?.nodes || [] : [];
    const totalExpectedTasks = dagNodes.length;
    
    if (totalExpectedTasks === 0) {
      return;
    }

    const completedTaskIds = new Set(
      execDoc.tasks
        .filter(t => t.status === "success" || t.status === "failed")
        .map(t => t.nodeId)
    );
    const failedTaskIds = new Set(
      execDoc.tasks
        .filter(t => t.status === "failed")
        .map(t => t.nodeId)
    );
    const runningTaskIds = new Set(
      execDoc.tasks
        .filter(t => t.status === "running" || t.status === "started" || t.status === "retrying")
        .map(t => t.nodeId)
    );
    const scheduledTaskIds = new Set(
      execDoc.tasks
        .filter(t => t.status === "scheduled")
        .map(t => t.nodeId)
    );

    const completedCount = completedTaskIds.size;
    const failedCount = failedTaskIds.size;
    const runningCount = runningTaskIds.size;
    const scheduledCount = scheduledTaskIds.size;

    // CRITICAL: Only mark as success/failed when ALL tasks are completed
    // Must have exactly totalExpectedTasks completed, with no running or scheduled tasks
    if (completedCount === totalExpectedTasks && runningCount === 0 && scheduledCount === 0) {
      const finalStatus = failedCount > 0 ? "failed" : "success";
      execDoc.status = finalStatus;
      if (!execDoc.timeline) execDoc.timeline = {};
      if (!execDoc.timeline.completedAt) {
        execDoc.timeline.completedAt = new Date();
      }
      if (!execDoc.timeline.startedAt && execDoc.tasks.length > 0) {
        const firstTask = execDoc.tasks.find(t => t.startedAt);
        if (firstTask && firstTask.startedAt) {
          execDoc.timeline.startedAt = firstTask.startedAt;
        } else {
          execDoc.timeline.startedAt = new Date();
        }
      }
      await execDoc.save();
      
      console.log(`✅ Execution ${execDoc._id} completed with status: ${finalStatus} (${completedCount}/${totalExpectedTasks} tasks completed)`);
    }
  } catch (err) {
    console.error("Error checking execution status:", err);
  }
}

/**
 * Send email using SMTP (from user's configured email or default SMTP)
 */
export async function sendScheduledEmail(scheduledEmail) {
  try {
    // Get user (optional - may be null for DAG-scheduled emails)
    let user = null;
    if (scheduledEmail.userId) {
      user = await User.findById(scheduledEmail.userId);
    }

    // Require user's SMTP settings (no default fallback)
    if (!user || !user.smtpSettings) {
      throw new Error("SMTP settings missing for this user. Please configure SMTP in Settings.");
    }

    const { decrypt } = await import("../utils/encryption.js");
    const decryptedPassword = decrypt(user.smtpSettings.password);

    if (!user.smtpSettings.host || !user.smtpSettings.user || !decryptedPassword) {
      throw new Error("Incomplete SMTP settings. Please provide host, username, and app password in Settings.");
    }

    const smtpConfig = {
      host: user.smtpSettings.host,
      port: user.smtpSettings.port || 587,
      secure: user.smtpSettings.secure || false,
      auth: {
        user: user.smtpSettings.user,
        pass: decryptedPassword
      }
    };
    console.log(`📧 Using user's SMTP settings: ${user.smtpSettings.host}`);

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      auth: smtpConfig.auth
    });

    // Send email from user's email address (the email they logged in with)
    // NOTE: The "from" address will show the user's email, but SMTP server credentials
    // must be configured in backend/.env. If user logs in with different email than SMTP_USER,
    // the email will still be sent (from address will be user's email), but SMTP authentication
    // uses the credentials in .env. Some SMTP servers may reject if "from" doesn't match SMTP_USER.
    const fromAddress = scheduledEmail.from || scheduledEmail.userEmail || user.smtpSettings?.user || user.email;
    const fromName = user ? user.name : "Task Scheduler";
    
    const mailOptions = {
      from: `"${fromName}" <${fromAddress}>`, // This will show user's email as sender
      to: scheduledEmail.recipient,
      subject: scheduledEmail.subject,
      text: scheduledEmail.message,
      html: scheduledEmail.message.replace(/\n/g, "<br>")
    };
    
    console.log(`📧 Sending email FROM: ${fromAddress} TO: ${scheduledEmail.recipient}`);
    const info = await transporter.sendMail(mailOptions);
    
    // Update scheduled email status
    scheduledEmail.status = "sent";
    scheduledEmail.sentAt = new Date();
    scheduledEmail.updatedAt = new Date();
    await scheduledEmail.save();

    // Update the corresponding execution task status if linked
    if (scheduledEmail.executionId && scheduledEmail.taskNodeId) {
      try {
        const Execution = (await import("../models/Execution.js")).default;
        const execution = await Execution.findById(scheduledEmail.executionId);
        if (execution) {
          const task = execution.tasks.find(t => t.nodeId === scheduledEmail.taskNodeId);
          if (task && task.status === "scheduled") {
            task.status = "success";
            task.completedAt = new Date();
            task.output = `Email sent successfully. Message ID: ${info.messageId}`;
            await execution.save();
            
            // Re-check execution status to see if all tasks are now complete
            const DAG = (await import("../models/Dag.js")).default;
            const redis = (await import("../utils/redisClient.js")).default;
            
            const dag = await DAG.findById(execution.dagId);
            if (dag) {
              // Check if there are dependent tasks that should be enqueued now
              const edges = dag.graph?.edges || [];
              const nodes = dag.graph?.nodes || [];
              
              // Find tasks that depend on the completed task
              const dependentTaskIds = edges
                .filter(e => e.source === scheduledEmail.taskNodeId)
                .map(e => e.target);
              
              // For each dependent task, check if all dependencies are satisfied
              for (const dependentTaskId of dependentTaskIds) {
                const dependencies = edges
                  .filter(e => e.target === dependentTaskId)
                  .map(e => e.source);
                
                // Check if all dependencies have completed successfully
                const completedDependencies = execution.tasks.filter(
                  t => dependencies.includes(t.nodeId) && t.status === "success"
                );
                
                // If all dependencies are satisfied, enqueue this task
                if (dependencies.length > 0 && completedDependencies.length === dependencies.length) {
                  const dependentNode = nodes.find(n => n.id === dependentTaskId);
                  if (dependentNode) {
                    // Check if this task hasn't already been executed
                    const alreadyExecuted = execution.tasks.some(t => t.nodeId === dependentTaskId);
                    if (!alreadyExecuted) {
                      await redis.lpush(
                        "queue:tasks",
                        JSON.stringify({
                          executionId: execution._id.toString(),
                          dagId: dag._id.toString(),
                          task: dependentNode,
                          userId: execution.userId ? execution.userId.toString() : null
                        })
                      );
                      console.log(`📤 Enqueued dependent task: ${dependentNode.name || dependentTaskId} (depends on: ${scheduledEmail.taskNodeId})`);
                    }
                  }
                }
              }
              
              await checkAndUpdateExecutionStatus(execution, dag);
            }
            
            console.log(`✅ Updated execution task ${scheduledEmail.taskNodeId} to success`);
          }
        }
      } catch (err) {
        console.error("Error updating execution task status:", err);
      }
    }

    console.log(`✅ Scheduled email sent successfully! Message ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Failed to send scheduled email:`, error.message);
    
    // Update scheduled email with error
    scheduledEmail.status = "failed";
    scheduledEmail.errorMessage = error.message;
    scheduledEmail.updatedAt = new Date();
    await scheduledEmail.save();

    // Update the corresponding execution task status if linked
    if (scheduledEmail.executionId && scheduledEmail.taskNodeId) {
      try {
        const Execution = (await import("../models/Execution.js")).default;
        const execution = await Execution.findById(scheduledEmail.executionId);
        if (execution) {
          const task = execution.tasks.find(t => t.nodeId === scheduledEmail.taskNodeId);
          if (task && task.status === "scheduled") {
            task.status = "failed";
            task.completedAt = new Date();
            task.error = error.message;
            await execution.save();
            
            // Re-check execution status
            const DAG = (await import("../models/Dag.js")).default;
            const dag = await DAG.findById(execution.dagId);
            if (dag) {
              await checkAndUpdateExecutionStatus(execution, dag);
            }
            
            console.log(`❌ Updated execution task ${scheduledEmail.taskNodeId} to failed`);
          }
        }
      } catch (err) {
        console.error("Error updating execution task status:", err);
      }
    }

    throw error;
  }
}

/**
 * Check and send pending scheduled emails
 */
export async function processScheduledEmails() {
  try {
    const now = new Date();
    
    // Find pending emails that should be sent now (within last minute)
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    
    const pendingEmails = await ScheduledEmail.find({
      status: "pending",
      scheduledDateTime: { $lte: now, $gte: oneMinuteAgo }
    }).populate("userId");

    console.log(`📬 Found ${pendingEmails.length} scheduled emails to process`);

    for (const email of pendingEmails) {
      try {
        await sendScheduledEmail(email);
      } catch (error) {
        console.error(`Failed to send scheduled email ${email._id}:`, error.message);
        // Continue with next email
      }
    }
  } catch (error) {
    console.error("Error processing scheduled emails:", error);
  }
}

