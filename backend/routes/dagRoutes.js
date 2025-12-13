import express from "express";
import {
  createDAG,
  getDAGs,
  getDAGById,
  updateDAG,
  deleteDAG,
  validateDAG,
  duplicateDAG,
  executeDAG,
  exportDAG,
  importDAG
} from "../controllers/dagController.js";

const router = express.Router();

router.route("/").get(getDAGs).post(createDAG);
router.post("/import", importDAG);
router.route("/:id").get(getDAGById).put(updateDAG).delete(deleteDAG);
router.get("/:id/export", exportDAG);
router.post("/:id/validate", validateDAG);
router.post("/:id/duplicate", duplicateDAG);
router.post("/:id/execute", executeDAG);

export default router;
