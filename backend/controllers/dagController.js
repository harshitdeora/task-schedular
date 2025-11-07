import DAG from "../models/Dag.js";

export const createDAG = async (req, res) => {
  try {
    const dag = await DAG.create(req.body);
    res.status(201).json({ success: true, dag });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const getDAGs = async (req, res) => {
  const dags = await DAG.find();
  res.json(dags);
};

export const getDAGById = async (req, res) => {
  const dag = await DAG.findById(req.params.id);
  dag ? res.json(dag) : res.status(404).json({ message: "Not found" });
};

export const updateDAG = async (req, res) => {
  const dag = await DAG.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(dag);
};

export const deleteDAG = async (req, res) => {
  await DAG.findByIdAndDelete(req.params.id);
  res.json({ message: "DAG deleted" });
};
