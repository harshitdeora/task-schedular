import express from "express";
import {
  createDAG,
  getDAGs,
  getDAGById,
  updateDAG,
  deleteDAG
} from "../controllers/dagController.js";

const router = express.Router();

router.route("/").get(getDAGs).post(createDAG);
router.route("/:id").get(getDAGById).put(updateDAG).delete(deleteDAG);

export default router;
