// server.js (or index.js)
import dotenv from "dotenv";
dotenv.config(); // must be before reading process.env

import express from "express";
import http from "http";
import cors from "cors";
import morgan from "morgan";

import connectDB from "./config/db.js";
import dagRoutes from "./routes/dagRoutes.js";
import workerRoutes from "./routes/workerRoutes.js";
import { startScheduler } from "./scheduler/scheduler.js";
import { initSocket } from "./websocket/socketServer.js";
import { startWorkerHealthMonitor } from "./services/workerHealthMonitor.js";

const app = express();

// --- Middlewares ---
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// --- Routes ---
app.use("/api/dags", dagRoutes);
app.use("/api/workers", workerRoutes);

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
