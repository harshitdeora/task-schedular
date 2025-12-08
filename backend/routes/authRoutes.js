import express from "express";
import User from "../models/User.js";

const router = express.Router();

// Register new user
router.post("/register", async (req, res) => {
  try {
    const { username, email, password, name } = req.body;

    if (!username || !email || !password || !name) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this email or username already exists"
      });
    }

    // Create new user
    const user = await User.create({
      username,
      email,
      password,
      name
    });

    // Auto-login after registration
    req.login(user, (err) => {
      if (err) {
        return res.status(500).json({ success: false, message: "Registration failed" });
      }
      res.json({
        success: true,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          name: user.name
        }
      });
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: "Registration failed",
      error: error.message
    });
  }
});

// Login (email-based)
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    // Find user by email only
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found. Please register first.",
        needsRegistration: true
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid password"
      });
    }

    // Logout any existing user first to clear previous session
    req.logout(() => {
      // After logout, login the new user
      // This will create a fresh session for the new user
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ success: false, message: "Login failed" });
        }
        res.json({
          success: true,
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            name: user.name
          }
        });
      });
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Login failed",
      error: error.message
    });
  }
});

// Get current user
router.get("/me", (req, res) => {
  if (req.user) {
    res.json({
      success: true,
      user: {
        id: req.user._id,
        username: req.user.username,
        email: req.user.email,
        name: req.user.name
      }
    });
  } else {
    res.status(401).json({ success: false, message: "Not authenticated" });
  }
});

// Logout
router.post("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ success: false, message: "Logout failed" });
    }
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ success: false, message: "Logout failed" });
      }
      res.json({ success: true, message: "Logged out successfully" });
    });
  });
});

export default router;

