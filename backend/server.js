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
import variableRoutes from "./routes/variableRoutes.js";
import triggerRoutes from "./routes/triggerRoutes.js";
import templateRoutes from "./routes/templateRoutes.js";
import { startScheduler } from "./scheduler/scheduler.js";
import { initSocket } from "./websocket/socketServer.js";
import { startWorkerHealthMonitor } from "./services/workerHealthMonitor.js";
import { startEmailScheduler } from "./services/emailSchedulerService.js";
import { startExecutionAutoFailMonitor } from "./services/executionAutoFail.js";

const app = express();

// --- Middlewares ---
// CORS with credentials; in dev we allow any origin (reflect request) unless explicitly disabled
const allowAllOrigins = process.env.ALLOW_ALL_ORIGINS === "true" || process.env.NODE_ENV !== "production";
const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000"
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (allowAllOrigins) {
      // Reflect the requesting origin to allow credentials
      return callback(null, origin || "*");
    }
    if (!origin) return callback(null, true); // same-origin or mobile/webviews
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
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
    sameSite: 'lax' // Works with localhost + multiple ports
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
app.use("/api/variables", variableRoutes);
app.use("/api/triggers", triggerRoutes);
app.use("/api/templates", templateRoutes);

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

    // start monitor to auto-fail stuck executions
    startExecutionAutoFailMonitor();

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
