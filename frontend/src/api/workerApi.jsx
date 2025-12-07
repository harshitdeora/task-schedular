import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const API = `${API_URL}/api/workers`;

export const getWorkers = () => axios.get(API);
export const getWorkerById = (id) => axios.get(`${API}/${id}`);
export const getWorkerStats = () => axios.get(`${API}/stats`);

