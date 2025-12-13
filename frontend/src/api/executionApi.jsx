import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const API = `${API_URL}/api/executions`;

// Configure axios to send credentials (cookies) with all requests
const axiosConfig = { withCredentials: true };

export const getExecutions = (params) => axios.get(API, { params, ...axiosConfig });
export const getExecutionById = (id) => axios.get(`${API}/${id}`, axiosConfig);
export const createExecution = (data) => axios.post(API, data, axiosConfig);
export const updateExecution = (id, data) => axios.put(`${API}/${id}`, data, axiosConfig);
export const cancelExecution = (id) => axios.post(`${API}/${id}/cancel`, {}, axiosConfig);
export const retryExecution = (id) => axios.post(`${API}/${id}/retry`, {}, axiosConfig);
export const forceCancelExecution = (id) => axios.post(`${API}/${id}/force-cancel`, {}, axiosConfig);
export const deleteExecution = (id) => axios.delete(`${API}/${id}`, axiosConfig);
export const deleteAllExecutions = () => axios.delete(API, axiosConfig);
