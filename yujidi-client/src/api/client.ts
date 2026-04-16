import axios from 'axios';
const isProd = import.meta.env.PROD;
const API_URL = isProd
  ? 'https://api.your-future-aws-url.com/api' // We will update this exact string later!
  : 'http://localhost:3006/api';

export const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});