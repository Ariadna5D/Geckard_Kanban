import axios from 'axios';

/**
 * Texto seguro para mostrar al usuario cuando falla una petición HTTP.
 * Incluye el caso “sin red” y mensajes que vienen como string o array.
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error)) return fallback;
  if (!error.response) {
    return 'No se pudo conectar con el servidor. Si usas otro dispositivo o un túnel, la API debe ir por la misma URL que la web (ruta /api).';
  }
  const data = error.response.data as { message?: string | string[] };
  if (Array.isArray(data?.message)) return data.message.join(', ');
  if (typeof data?.message === 'string') return data.message;
  if (typeof error.message === 'string' && error.message.length > 0) {
    return error.message;
  }
  return fallback;
}
