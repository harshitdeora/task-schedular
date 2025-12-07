import cron from "node-cron";
import { processScheduledEmails } from "./emailScheduler.js";

/**
 * Start the email scheduler service
 * Checks for pending scheduled emails every minute
 */
export function startEmailScheduler() {
  console.log("📧 Email scheduler service started");

  // Run every minute to check for scheduled emails
  cron.schedule("* * * * *", async () => {
    await processScheduledEmails();
  });

  // Also run immediately on startup
  processScheduledEmails().catch(err => {
    console.error("Error in initial email scheduler run:", err);
  });
}

