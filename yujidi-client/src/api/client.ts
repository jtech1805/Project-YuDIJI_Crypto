// src/api/client.ts
import axios from 'axios';

const isProd = import.meta.env.PROD;
const API_URL = isProd
  ? 'https://project-yudiji-crypto.onrender.com/api'
  : 'http://localhost:3006/api';

export const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});