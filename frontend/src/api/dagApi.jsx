import axios from "axios";

const API = "http://localhost:5000/api/dags";

export const getDags = () => axios.get(API);
export const createDag = (data) => axios.post(API, data);
