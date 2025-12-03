import axios from "axios";
const API = "http://localhost:5000/api/executions";

export const getExecutions = () => axios.get(API);
