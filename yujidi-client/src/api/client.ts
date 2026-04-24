// src/api/client.ts
import axios from 'axios';

// const isProd = import.meta.env.PROD;
// const API_URL = isProd
//   ? 'https://project-yudiji-crypto.onrender.com/api'
//   : 'http://localhost:3006/api';

// export const apiClient = axios.create({
//   baseURL: API_URL,
//   withCredentials: true,
// });

// Pull the URLs from the environment. 
// We add the || 'http...' as a fallback just in case the .env file is missing.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3006/api';

export const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});