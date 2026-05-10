import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';

// Centraliza la conexion base con la api
const baseURL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || '/api';

const api = axios.create({
  baseURL,
});

api.interceptors.request.use((config) => {
  // Agrega bearer token a cada peticion cuando hay sesion abierta
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;