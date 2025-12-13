import express from "express";
import {
  getTemplates,
  getTemplate,
  createTemplate,
  useTemplate,
  createDefaultTemplates
} from "../controllers/templateController.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// Public routes
router.get("/", getTemplates);
router.get("/:id", getTemplate);
router.post("/defaults", createDefaultTemplates); // Public for initial setup

// Protected routes
router.use(requireAuth);
router.post("/", createTemplate);
router.post("/:id/use", useTemplate);

export default router;


