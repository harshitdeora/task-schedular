import express from "express";
import {
  getVariables,
  getVariable,
  createVariable,
  updateVariable,
  deleteVariable
} from "../controllers/variableController.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(requireAuth);
router.get("/", getVariables);
router.get("/:id", getVariable);
router.post("/", createVariable);
router.put("/:id", updateVariable);
router.delete("/:id", deleteVariable);

export default router;

