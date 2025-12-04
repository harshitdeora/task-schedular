import axios from "axios";

const API = "http://localhost:5000/api/workers";

export const getWorkers = () => axios.get(API);
export const getWorkerById = (id) => axios.get(`${API}/${id}`);
export const getWorkerStats = () => axios.get(`${API}/stats`);

