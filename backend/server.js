// server.js (or index.js)
import dotenv from "dotenv";
dotenv.config(); // must be before reading process.env

import express from "express";
import http from "http";
import cors from "cors";
import morgan from "morgan";
import session from "express-session";
import passport from "passport";

import connectDB from "./config/db.js";
import dagRoutes from "./routes/dagRoutes.js";
import workerRoutes from "./routes/workerRoutes.js";
import executionRoutes from "./routes/executionRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import scheduledEmailRoutes from "./routes/scheduledEmailRoutes.js";
import userSettingsRoutes from "./routes/userSettingsRoutes.js";
import { startScheduler } from "./scheduler/scheduler.js";
import { initSocket } from "./websocket/socketServer.js";
import { startWorkerHealthMonitor } from "./services/workerHealthMonitor.js";
import { startEmailScheduler } from "./services/emailSchedulerService.js";

const app = express();

// --- Middlewares ---
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true
}));
app.use(express.json());
app.use(morgan("dev"));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || "your-secret-key-change-in-production",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax' // Helps with cross-site requests
  },
  name: 'task-scheduler.sid' // Custom session name to avoid conflicts
}));

// Passport initialization (for session management)
app.use(passport.initialize());
app.use(passport.session());

// Passport serialization
passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const User = (await import("./models/User.js")).default;
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// --- Routes ---
app.use("/api/auth", authRoutes);
app.use("/api/dags", dagRoutes);
app.use("/api/workers", workerRoutes);
app.use("/api/executions", executionRoutes);
app.use("/api/scheduled-emails", scheduledEmailRoutes);
app.use("/api/user", userSettingsRoutes);

// --- Create HTTP server and attach websockets ---
const server = http.createServer(app);
initSocket(server);

// --- Start everything in an async IIFE so we can await DB connect ---
(async () => {
  try {
    await connectDB(); // wait for DB connection first

    // start scheduler after DB is up (so it can read/write tasks)
    startScheduler();
    
    // start worker health monitor
    startWorkerHealthMonitor();

    // start email scheduler to process scheduled emails
    startEmailScheduler();

    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`🚀 API + WebSocket listening on port ${PORT}`);
    });

    // graceful shutdown handlers
    process.on("SIGINT", () => {
      console.log("SIGINT received — shutting down...");
      server.close(() => process.exit(0));
    });

    process.on("unhandledRejection", (err) => {
      console.error("Unhandled rejection:", err);
      process.exit(1);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
})();
