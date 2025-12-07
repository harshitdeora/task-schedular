import express from "express";
import {
  getExecutions,
  getExecutionById,
  createExecution,
  updateExecution,
  cancelExecution,
  retryExecution
} from "../controllers/executionController.js";

const router = express.Router();

router.route("/").get(getExecutions).post(createExecution);
router.route("/:id").get(getExecutionById).put(updateExecution);
router.post("/:id/cancel", cancelExecution);
router.post("/:id/retry", retryExecution);

export default router;

