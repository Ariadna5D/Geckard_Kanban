import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';

/** Misma origen que el SPA (nginx /api → backend). Override: VITE_API_BASE_URL en build. */
const baseURL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || '/api';

const api = axios.create({
  baseURL,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;