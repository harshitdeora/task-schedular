import express from "express";
import {
  getExecutions,
  getExecutionById,
  createExecution,
  updateExecution,
  cancelExecution,
  retryExecution,
  forceCancelExecution,
  deleteExecution,
  deleteAllExecutions
} from "../controllers/executionController.js";

const router = express.Router();

router.route("/").get(getExecutions).post(createExecution).delete(deleteAllExecutions);
router.route("/:id").get(getExecutionById).put(updateExecution).delete(deleteExecution);
router.post("/:id/cancel", cancelExecution);
router.post("/:id/retry", retryExecution);
router.post("/:id/force-cancel", forceCancelExecution);

export default router;

