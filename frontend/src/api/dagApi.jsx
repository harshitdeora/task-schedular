import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const API = `${API_URL}/api/dags`;

export const getDags = () => axios.get(API);
export const getDagById = (id) => axios.get(`${API}/${id}`);
export const createDag = (data) => axios.post(API, data);
export const updateDag = (id, data) => axios.put(`${API}/${id}`, data);
export const deleteDag = (id) => axios.delete(`${API}/${id}`);
export const validateDag = (id) => axios.post(`${API}/${id}/validate`);
export const duplicateDag = (id) => axios.post(`${API}/${id}/duplicate`);
export const executeDag = (id) => axios.post(`${API}/${id}/execute`);
