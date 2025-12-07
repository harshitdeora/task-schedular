import ScheduledEmail from "../models/ScheduledEmail.js";
import User from "../models/User.js";
import nodemailer from "nodemailer";

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

    // Use user's SMTP settings if available, otherwise fall back to default
    let smtpConfig = null;
    
    if (user && user.smtpSettings && user.smtpSettings.host && user.smtpSettings.password) {
      // User has configured their own SMTP settings
      const { decrypt } = await import("../utils/encryption.js");
      const decryptedPassword = decrypt(user.smtpSettings.password);
      
      if (decryptedPassword) {
        smtpConfig = {
          host: user.smtpSettings.host,
          port: user.smtpSettings.port || 587,
          secure: user.smtpSettings.secure || false,
          auth: {
            user: user.smtpSettings.user,
            pass: decryptedPassword
          }
        };
        console.log(`📧 Using user's SMTP settings: ${user.smtpSettings.host}`);
      }
    }
    
    // Fall back to default SMTP settings if user hasn't configured
    if (!smtpConfig) {
      smtpConfig = {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === "true" || false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD
        }
      };
      console.log(`📧 Using default SMTP settings: ${smtpConfig.host}`);
    }

    if (!smtpConfig.host || !smtpConfig.auth.user || !smtpConfig.auth.pass) {
      throw new Error("SMTP configuration required. Please configure SMTP settings in your profile or in backend/.env file.");
    }

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
    const fromAddress = scheduledEmail.from || scheduledEmail.userEmail || (user ? user.email : process.env.SMTP_USER);
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

    console.log(`✅ Scheduled email sent successfully! Message ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Failed to send scheduled email:`, error.message);
    
    // Update scheduled email with error
    scheduledEmail.status = "failed";
    scheduledEmail.errorMessage = error.message;
    scheduledEmail.updatedAt = new Date();
    await scheduledEmail.save();

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

