import express from "express";
import {
  createTrigger,
  getTriggers,
  getTrigger,
  updateTrigger,
  deleteTrigger,
  triggerDagByToken,
  triggerDagByWebhook
} from "../controllers/triggerController.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// Protected routes
router.use(requireAuth);
router.get("/", getTriggers);
router.get("/:id", getTrigger);
router.post("/", createTrigger);
router.put("/:id", updateTrigger);
router.delete("/:id", deleteTrigger);

// Public trigger endpoints (no auth required)
router.post("/token/:token", triggerDagByToken);
router.post("/webhook/:path", triggerDagByWebhook);
router.get("/webhook/:path", triggerDagByWebhook);

export default router;


