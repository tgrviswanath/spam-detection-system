import axios from "axios";

const api = axios.create({ baseURL: process.env.REACT_APP_API_URL });

export const predictSpam = (text) => api.post("/api/v1/predict", { text });
export const predictBatch = (texts) => api.post("/api/v1/predict/batch", { texts });
