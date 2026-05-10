import axios from 'axios';

function looksLikeEnglishValidatorLine(text: string): boolean {
  return /\b(must|should|is not|cannot|can not|forbidden property)\b/i.test(
    text,
  );
}

// Convierte mensajes tecnicos del backend en texto mas claro para la UI
function humanizeServerLine(line: string): string {
  const trimmed = line.trim();
  if (!trimmed) return trimmed;
  if (/^(La |El |Los |Las |No se |Debe |Hay |No hay )/i.test(trimmed)) {
    return trimmed;
  }
  if (!looksLikeEnglishValidatorLine(trimmed)) {
    return trimmed;
  }
  if (
    /links?\b/i.test(trimmed) &&
    /\burl|http|https|protocol|isurl\b/i.test(trimmed)
  ) {
    return 'Revisa los enlaces: cada dirección debe ser válida y empezar por https:// (cópiala tal cual de la barra del navegador)';
  }
  if (/\bforbidden\b/i.test(trimmed) || /property \S+ should not exist/i.test(trimmed)) {
    return 'No se aceptan algunos campos de esta petición. Recarga la página y vuelve a intentarlo.';
  }
  if (/\b(sprint|mongo|id)\b/i.test(trimmed)) {
    return 'Hay un dato de sprint o identificador incorrecto. Revisa el formulario.';
  }
  return 'Los datos enviados no son válidos. Revisa lo que has escrito y prueba otra vez.';
}

function messagesFromResponseBody(body: unknown): string[] {
  if (body === null || body === undefined) return [];
  if (typeof body === 'string') {
    return body.trim() ? [body] : [];
  }
  if (typeof body !== 'object') return [];
  const record = body as Record<string, unknown>;
  const direct = record.message;
  if (typeof direct === 'string' && direct.trim()) {
    return [direct];
  }
  if (Array.isArray(direct)) {
    const lines: string[] = [];
    for (const item of direct) {
      if (typeof item === 'string' && item.trim()) lines.push(item);
    }
    return lines;
  }
  return [];
}

// Evita mostrar textos genericos de axios que no ayudan al usuario
function isGenericAxiosStatusText(text: string): boolean {
  return (
    /^Request failed with status code \d+$/i.test(text) ||
    /^Network Error$/i.test(text)
  );
}

export function apiErrorMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error)) return fallback;
  if (!error.response) {
    // Sin response casi siempre es caida de red o backend inaccesible
    return 'No hay conexión con el servidor. Comprueba la red o que la app use la misma dirección /api que la web.';
  }
  if (error.response.status === 413) {
    return 'La imagen es demasiado grande para el servidor. Reduce su tamaño y vuelve a intentarlo.';
  }
  const lines = messagesFromResponseBody(error.response.data);
  if (lines.length > 0) {
    const readable = lines.map(humanizeServerLine);
    const joined = [...new Set(readable.filter(Boolean))].join(' · ');
    if (joined) return joined;
  }
  const axiosLine = typeof error.message === 'string' ? error.message : '';
  if (axiosLine && !isGenericAxiosStatusText(axiosLine)) {
    return humanizeServerLine(axiosLine);
  }
  return fallback;
}
