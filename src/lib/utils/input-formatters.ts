// ─── IP Address ───────────────────────────────────────────────────────────────

export type IpValidationState = 'empty' | 'partial' | 'valid' | 'invalid';
export interface IpValidation { state: IpValidationState; message: string; }

/**
 * Filters the raw IP input to digits+dots, caps each octet to 3 digits,
 * limits to 4 octets, and auto-inserts a trailing dot when the last octet
 * reaches 3 digits (only while adding chars, not deleting).
 *
 * Returns the processed value. Caller handles cursor restoration.
 */
export function processIpInput(newRaw: string, prevRaw: string): string {
    const isAdding = newRaw.length >= prevRaw.length;

    // Keep only digits and dots
    const filtered = newRaw.replace(/[^\d.]/g, '');

    // Split into octets, cap each to 3 digits, take at most 4
    const parts = filtered.split('.');
    const processed = parts.slice(0, 4).map(o => o.slice(0, 3));
    let result = processed.join('.');

    // Auto-insert trailing dot when last octet just completed 3 digits
    const lastPart = processed[processed.length - 1];
    if (isAdding && lastPart?.length === 3 && processed.length < 4 && !result.endsWith('.')) {
        result += '.';
    }

    return result.slice(0, 15);
}

/** Validates a complete IP address string and returns typed state + message. */
export function validateIp(ip: string): IpValidation {
    if (!ip || !ip.trim()) return { state: 'empty', message: '' };

    const parts = ip.split('.');

    // Partial: fewer than 4 octets or trailing dot
    if (parts.length < 4 || ip.endsWith('.')) {
        return { state: 'partial', message: '' };
    }

    if (parts.length > 4) {
        return { state: 'invalid', message: 'La IP debe tener 4 octetos separados por puntos' };
    }

    for (let i = 0; i < 4; i++) {
        const p = parts[i];
        if (!/^\d{1,3}$/.test(p)) {
            return { state: 'invalid', message: `Octeto ${i + 1} inválido: "${p}"` };
        }
        const n = Number(p);
        if (n > 255) {
            return { state: 'invalid', message: `Octeto ${i + 1} fuera de rango: ${n} (máx. 255)` };
        }
    }

    return { state: 'valid', message: '' };
}

// ─── GPS Coordinates ──────────────────────────────────────────────────────────

export type GpsValidationState = 'empty' | 'partial' | 'valid' | 'invalid';
export interface GpsValidation {
    state: GpsValidationState;
    message: string;
    parsed?: { lat: number; lon: number };
}

/**
 * Parses GPS coordinates from multiple common formats:
 *   "10.5,-66.9"   "10.5 -66.9"   "10,5 -66,9"   "10,5;-66,9"   "10.5°N, 66.9°W"
 */
export function parseGpsCoordinates(raw: string): { lat: number; lon: number } | null {
    if (!raw || !raw.trim()) return null;
    let s = raw.trim()
        .replace(/[°'"]/g, '')
        .replace(/[NSns]/g, '')
        .replace(/[EWew]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    const RE = /^(-?\d+[.,]\d+|-?\d+)[,;\s]+(-?\d+[.,]\d+|-?\d+)$/;
    const m = s.match(RE);
    if (!m) return null;
    const lat = parseFloat(m[1].replace(',', '.'));
    const lon = parseFloat(m[2].replace(',', '.'));
    if (isNaN(lat) || isNaN(lon)) return null;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    return { lat, lon };
}

/** Validates a GPS string and returns typed state, error message, and parsed result. */
export function validateGps(raw: string): GpsValidation {
    if (!raw || !raw.trim()) return { state: 'empty', message: '' };

    const trimmed = raw.trim();
    if (trimmed.length < 3) return { state: 'partial', message: '' };

    const parsed = parseGpsCoordinates(trimmed);
    if (parsed) return { state: 'valid', message: '', parsed };

    // Diagnose the failure for a specific error message
    const cleaned = trimmed
        .replace(/[°'"NSnsEWew]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    const parts = cleaned.split(/[,;\s]+/).filter(p => p.length > 0);

    if (parts.length < 2) return { state: 'partial', message: '' };

    if (parts.length > 2) {
        return { state: 'invalid', message: 'Demasiados valores — ingresa solo latitud y longitud' };
    }

    const lat = parseFloat(parts[0].replace(',', '.'));
    const lon = parseFloat(parts[1].replace(',', '.'));

    if (isNaN(lat) || isNaN(lon)) {
        return { state: 'invalid', message: 'Valores no numéricos detectados' };
    }

    if (lat < -90 || lat > 90) {
        return {
            state: 'invalid',
            message: `Latitud fuera de rango: ${lat.toFixed(4)}° (debe ser -90° a 90°)`
        };
    }

    if (lon < -180 || lon > 180) {
        return {
            state: 'invalid',
            message: `Longitud fuera de rango: ${lon.toFixed(4)}° (debe ser -180° a 180°)`
        };
    }

    return { state: 'partial', message: '' };
}
