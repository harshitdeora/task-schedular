import express from "express";
import ScheduledEmail from "../models/ScheduledEmail.js";
import User from "../models/User.js";
import { sendScheduledEmail } from "../services/emailScheduler.js";

const router = express.Router();

// Middleware to check authentication
const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }
  next();
};

// Create scheduled email
router.post("/", requireAuth, async (req, res) => {
  try {
    const { recipient, subject, message, scheduledDateTime } = req.body;

    if (!recipient || !subject || !message || !scheduledDateTime) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: recipient, subject, message, scheduledDateTime"
      });
    }

    const scheduledDate = new Date(scheduledDateTime);
    if (isNaN(scheduledDate.getTime()) || scheduledDate < new Date()) {
      return res.status(400).json({
        success: false,
        message: "Invalid scheduled date/time. Must be in the future."
      });
    }

    const scheduledEmail = await ScheduledEmail.create({
      userId: req.user._id,
      userEmail: req.user.email, // Use logged-in user's email as sender
      recipient,
      subject,
      message,
      scheduledDateTime: scheduledDate,
      status: "pending",
      from: req.user.email // Set from address to user's email
    });

    res.status(201).json({
      success: true,
      scheduledEmail: {
        id: scheduledEmail._id,
        recipient: scheduledEmail.recipient,
        subject: scheduledEmail.subject,
        scheduledDateTime: scheduledEmail.scheduledDateTime,
        status: scheduledEmail.status
      }
    });
  } catch (error) {
    console.error("Error creating scheduled email:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create scheduled email",
      error: error.message
    });
  }
});

// Get user's scheduled emails
router.get("/", requireAuth, async (req, res) => {
  try {
    const { status } = req.query;
    const query = { userId: req.user._id };
    
    if (status) {
      query.status = status;
    }

    const scheduledEmails = await ScheduledEmail.find(query)
      .sort({ scheduledDateTime: 1 })
      .select("-__v");

    res.json({
      success: true,
      scheduledEmails: scheduledEmails.map(email => ({
        id: email._id,
        recipient: email.recipient,
        subject: email.subject,
        message: email.message,
        scheduledDateTime: email.scheduledDateTime,
        status: email.status,
        sentAt: email.sentAt,
        errorMessage: email.errorMessage,
        createdAt: email.createdAt
      }))
    });
  } catch (error) {
    console.error("Error fetching scheduled emails:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch scheduled emails",
      error: error.message
    });
  }
});

// Delete scheduled email
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const scheduledEmail = await ScheduledEmail.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!scheduledEmail) {
      return res.status(404).json({
        success: false,
        message: "Scheduled email not found"
      });
    }

    if (scheduledEmail.status === "sent") {
      return res.status(400).json({
        success: false,
        message: "Cannot delete already sent email"
      });
    }

    scheduledEmail.status = "cancelled";
    await scheduledEmail.save();

    res.json({
      success: true,
      message: "Scheduled email cancelled"
    });
  } catch (error) {
    console.error("Error deleting scheduled email:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete scheduled email",
      error: error.message
    });
  }
});

export default router;

