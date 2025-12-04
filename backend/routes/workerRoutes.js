import express from "express";
import {
  getWorkers,
  getWorkerById,
  getWorkerStats
} from "../controllers/workerController.js";

const router = express.Router();

router.get("/", getWorkers);
router.get("/stats", getWorkerStats);
router.get("/:id", getWorkerById);

export default router;

