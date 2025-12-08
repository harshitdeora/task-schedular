import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const API = `${API_URL}/api/dags`;

// Configure axios to send credentials (cookies) with all requests
const axiosConfig = { withCredentials: true };

export const getDags = () => axios.get(API, axiosConfig);
export const getDagById = (id) => axios.get(`${API}/${id}`, axiosConfig);
export const createDag = (data) => axios.post(API, data, axiosConfig);
export const updateDag = (id, data) => axios.put(`${API}/${id}`, data, axiosConfig);
export const deleteDag = (id) => axios.delete(`${API}/${id}`, axiosConfig);
export const validateDag = (id) => axios.post(`${API}/${id}/validate`, {}, axiosConfig);
export const duplicateDag = (id) => axios.post(`${API}/${id}/duplicate`, {}, axiosConfig);
export const executeDag = (id) => axios.post(`${API}/${id}/execute`, {}, axiosConfig);
