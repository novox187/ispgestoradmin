// Centraliza la configuración del frontend
// Lee PUBLIC_API_BASE desde variables públicas de SvelteKit y provee fallback local
import { env as publicEnv } from '$env/dynamic/public';

const apiBaseFromEnv =
  publicEnv.PUBLIC_API_BASE ||
  ((typeof window !== 'undefined' && (window as any).__API_BASE__) as string | undefined);

export const API_BASE: string = apiBaseFromEnv || (import.meta.env.DEV ? 'http://localhost:8000/api' : '');

if (!API_BASE) {
  throw new Error('PUBLIC_API_BASE no está configurada');
}
