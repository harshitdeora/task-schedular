import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const API = `${API_URL}/api/executions`;

export const getExecutions = (params) => axios.get(API, { params });
export const getExecutionById = (id) => axios.get(`${API}/${id}`);
export const createExecution = (data) => axios.post(API, data);
export const updateExecution = (id, data) => axios.put(`${API}/${id}`, data);
export const cancelExecution = (id) => axios.post(`${API}/${id}/cancel`);
export const retryExecution = (id) => axios.post(`${API}/${id}/retry`);
