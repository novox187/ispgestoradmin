// Utilidades de fechas tolerantes a zona horaria.
//
// El backend serializa columnas `date` de Eloquent como ISO con sufijo Z
// (ej. "2026-04-01T00:00:00.000000Z"). Si el frontend hace `new Date(...)`
// y luego formatea en la zona local, la fecha se desplaza un día en cualquier
// equipo configurado al oeste de UTC (Ecuador es UTC-5, así que 00:00 UTC pasa
// a 19:00 del día anterior). Estas helpers tratan estos valores como fechas
// puras (sin hora ni zona) para que se vean igual en cualquier máquina.

/** Devuelve YYYY-MM-DD a partir de un string de fecha del backend o `<input type=date>`. */
export function toDateInputValue(raw: string | Date | null | undefined): string {
    if (!raw) return '';
    if (raw instanceof Date) {
        if (Number.isNaN(raw.getTime())) return '';
        // Date objeto: extraer componentes UTC (los date-only del backend llegan a 00:00 UTC).
        const y = raw.getUTCFullYear();
        const m = String(raw.getUTCMonth() + 1).padStart(2, '0');
        const d = String(raw.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    // String: tomar los primeros 10 chars si comienza con YYYY-MM-DD (cubre
    // "2026-04-01", "2026-04-01T00:00:00", "2026-04-01 12:34:56" y "2026-04-01T00:00:00.000000Z").
    const match = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
    // Fallback: parsear y leer en UTC para no aplicar zona local.
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}

/** Hoy en formato YYYY-MM-DD según la zona local (usar como `max` en `<input type=date>`). */
export function todayDateInputValue(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}

/**
 * Formatea una fecha pura (sin hora) sin desplazamientos por zona horaria.
 * Por defecto: "01 abr 2026" en español.
 */
export function formatDate(
    raw: string | Date | null | undefined,
    options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' },
    locale: string = 'es-CO'
): string {
    const iso = toDateInputValue(raw);
    if (!iso) return '—';
    // Anclar a UTC para que el formateador no aplique la zona local.
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(dt);
}

/** Días transcurridos entre una fecha pura y hoy, calculados a nivel calendario (sin sesgo de hora/zona). */
export function daysSinceDate(raw: string | Date | null | undefined): number {
    const iso = toDateInputValue(raw);
    if (!iso) return 0;
    const [y, m, d] = iso.split('-').map(Number);
    const start = Date.UTC(y, m - 1, d);
    const now = new Date();
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.max(0, Math.floor((today - start) / 86400000));
}

/** Texto relativo en español ("hace 3 días", "hace 2 meses", etc.) a partir de una fecha pura. */
export function relativeFromDate(raw: string | Date | null | undefined): string {
    const days = daysSinceDate(raw);
    if (days < 1) return 'desde hoy';
    if (days < 30) return `hace ${days} día${days === 1 ? '' : 's'}`;
    if (days < 365) {
        const months = Math.floor(days / 30);
        return `hace ${months} mes${months === 1 ? '' : 'es'}`;
    }
    const years = Math.floor(days / 365);
    return `hace ${years} año${years === 1 ? '' : 's'}`;
}
