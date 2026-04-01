import axios from 'axios';

/** Evita mostrar "credenciales incorrectas" cuando falló la red o la URL de la API. */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error)) return fallback;
  if (!error.response) {
    return 'No se pudo conectar con el servidor. Si usas otro dispositivo o un túnel, la API debe ir por la misma URL que la web (ruta /api).';
  }
  const data = error.response.data as { message?: string };
  return typeof data?.message === 'string' ? data.message : fallback;
}
