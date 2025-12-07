import express from "express";
import {
  createDAG,
  getDAGs,
  getDAGById,
  updateDAG,
  deleteDAG,
  validateDAG,
  duplicateDAG,
  executeDAG
} from "../controllers/dagController.js";

const router = express.Router();

router.route("/").get(getDAGs).post(createDAG);
router.route("/:id").get(getDAGById).put(updateDAG).delete(deleteDAG);
router.post("/:id/validate", validateDAG);
router.post("/:id/duplicate", duplicateDAG);
router.post("/:id/execute", executeDAG);

export default router;
