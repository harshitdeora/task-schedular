import mongoose from "mongoose";
import dotenv from "dotenv";
import DAG from "./models/Dag.js";

dotenv.config();
await mongoose.connect(process.env.MONGO_URI);

const dags = await DAG.find();
console.log("📄 DAGs in database:", dags);

process.exit();
