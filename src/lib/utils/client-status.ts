// Estado de servicio de un cliente: una sola forma de leerlo.
//
// La columna `service_status` acepta el enum ACTIVE / LIMITED / SUSPENDED /
// CANCELLED, pero por el histórico de la base conviven variantes en castellano
// (ACTIVO, SUSPENDIDO, LIMITADO). Cada componente traía su propia tabla de
// equivalencias y ninguna cubría 'LIMITED', así que un cliente limitado se
// pintaba como «Inactivo». Aquí se resuelve una vez.

export type ServiceStatus = 'active' | 'limited' | 'suspended' | 'cancelled' | 'inactive';

export function normalizeStatus(raw?: string | null): ServiceStatus {
    const up = String(raw ?? '').trim().toUpperCase();
    if (up === 'ACTIVE' || up === 'ACTIVO') return 'active';
    if (up === 'LIMITED' || up === 'LIMITADO') return 'limited';
    if (up === 'SUSPENDED' || up === 'SUSPENDIDO') return 'suspended';
    if (up === 'CANCELLED' || up === 'CANCELADO') return 'cancelled';
    return 'inactive';
}

const LABELS: Record<ServiceStatus, string> = {
    active:    'Activo',
    limited:   'Limitado',
    suspended: 'Suspendido',
    cancelled: 'Cancelado',
    inactive:  'Inactivo'
};

/** Frase para la cabecera del cliente, donde se habla del servicio. */
const SERVICE_LABELS: Record<ServiceStatus, string> = {
    active:    'Servicio activo',
    limited:   'Servicio limitado',
    suspended: 'Servicio suspendido',
    cancelled: 'Dado de baja',
    inactive:  'Servicio inactivo'
};

/** Punto de color. El color nunca va solo: siempre acompaña a una etiqueta. */
const DOTS: Record<ServiceStatus, string> = {
    active:    'bg-success-400',
    limited:   'bg-info-400',
    suspended: 'bg-warning-400',
    cancelled: 'bg-danger-400',
    inactive:  'bg-text-disabled'
};

/** Clases de pastilla definidas en app.css. */
const BADGES: Record<ServiceStatus, string> = {
    active:    'status-badge-active',
    limited:   'status-badge-limited',
    suspended: 'status-badge-suspended',
    cancelled: 'status-badge-cancelled',
    inactive:  'status-badge-inactive'
};

/** Fondo del avatar en el listado. */
const AVATARS: Record<ServiceStatus, string> = {
    active:    'bg-primary-900 text-primary-200 ring-primary-700/40',
    limited:   'bg-info-900/50 text-info-200 ring-info-700/40',
    suspended: 'bg-warning-900/60 text-warning-200 ring-warning-700/40',
    cancelled: 'bg-danger-900/50 text-danger-200 ring-danger-700/40',
    inactive:  'bg-surface-overlay text-text-muted ring-white/10'
};

export const statusLabel        = (s?: string | null) => LABELS[normalizeStatus(s)];
export const serviceStatusLabel = (s?: string | null) => SERVICE_LABELS[normalizeStatus(s)];
export const statusDot          = (s?: string | null) => DOTS[normalizeStatus(s)];
export const statusBadge        = (s?: string | null) => BADGES[normalizeStatus(s)];
export const statusAvatar       = (s?: string | null) => AVATARS[normalizeStatus(s)];
