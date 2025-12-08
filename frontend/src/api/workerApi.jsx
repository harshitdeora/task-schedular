import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const API = `${API_URL}/api/workers`;

// Configure axios to send credentials (cookies) with all requests
const axiosConfig = { withCredentials: true };

export const getWorkers = () => axios.get(API, axiosConfig);
export const getWorkerById = (id) => axios.get(`${API}/${id}`, axiosConfig);
export const getWorkerStats = () => axios.get(`${API}/stats`, axiosConfig);

