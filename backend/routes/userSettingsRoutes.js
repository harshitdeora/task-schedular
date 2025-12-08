import express from "express";
import User from "../models/User.js";
import { encrypt, decrypt } from "../utils/encryption.js";

const router = express.Router();

// Middleware to check authentication
const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }
  next();
};

// Get user's SMTP settings (password is encrypted, don't send it)
router.get("/smtp", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("smtpSettings email");
    
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Return settings without password for security
    const settings = user.smtpSettings || {};
    res.json({
      success: true,
      smtpSettings: {
        host: settings.host || "",
        port: settings.port || 587,
        secure: settings.secure || false,
        user: settings.user || user.email,
        hasPassword: !!settings.password // Just indicate if password is set
      }
    });
  } catch (error) {
    console.error("Error fetching SMTP settings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch SMTP settings",
      error: error.message
    });
  }
});

// Update user's SMTP settings
router.put("/smtp", requireAuth, async (req, res) => {
  try {
    const { host, port, secure, user: smtpUser, password } = req.body;

    if (!host || !smtpUser) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: host and user"
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // If password is provided, encrypt it. Otherwise, keep existing password if settings exist
    let encryptedPassword = null;
    if (password && password.trim() !== "") {
      // New password provided
      encryptedPassword = encrypt(password);
    } else if (user.smtpSettings && user.smtpSettings.password) {
      // No new password, but existing settings have password - keep it
      encryptedPassword = user.smtpSettings.password;
    } else {
      // No password and no existing password - require it
      return res.status(400).json({
        success: false,
        message: "Password is required for new SMTP settings"
      });
    }

    user.smtpSettings = {
      host,
      port: parseInt(port) || 587,
      secure: secure === true || secure === "true",
      user: smtpUser,
      password: encryptedPassword
    };
    user.updatedAt = new Date();
    await user.save();

    res.json({
      success: true,
      message: "SMTP settings saved successfully",
      smtpSettings: {
        host: user.smtpSettings.host,
        port: user.smtpSettings.port,
        secure: user.smtpSettings.secure,
        user: user.smtpSettings.user,
        hasPassword: true
      }
    });
  } catch (error) {
    console.error("Error updating SMTP settings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update SMTP settings",
      error: error.message
    });
  }
});

// Delete user's SMTP settings (use default)
router.delete("/smtp", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    user.smtpSettings = undefined;
    user.updatedAt = new Date();
    await user.save();

    res.json({
      success: true,
      message: "SMTP settings removed. Email sending will be disabled until you add SMTP again."
    });
  } catch (error) {
    console.error("Error deleting SMTP settings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete SMTP settings",
      error: error.message
    });
  }
});

export default router;

