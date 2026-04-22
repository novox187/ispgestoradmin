// Centraliza la configuración del frontend
// Lee PUBLIC_API_BASE desde variables públicas de SvelteKit y provee fallback local
import { env as publicEnv } from '$env/dynamic/public';

export const API_BASE: string =
  publicEnv.PUBLIC_API_BASE ||
  ((typeof window !== 'undefined' && (window as any).__API_BASE__) as string | undefined) ||
  'http://localhost:8000/api';
