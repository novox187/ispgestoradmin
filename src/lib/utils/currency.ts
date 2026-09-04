// Formato monetario del sistema.
//
// Iron Link factura contra el SRI de Ecuador, cuya moneda de curso legal es el
// dólar estadounidense (la tabla `wallets` también nace con `currency` = 'USD').
// Varios módulos venían formateando en pesos colombianos, lo que mostraba
// cifras con un símbolo y una escala que no corresponden a ninguna cuenta real.
// Este módulo centraliza el criterio para que no vuelva a divergir.

const LOCALE = 'es-EC';
const CURRENCY = 'USD';

const money = new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: CURRENCY,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});

const moneyCompact = new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: CURRENCY,
    notation: 'compact',
    maximumFractionDigits: 1
});

/** Convierte a número finito; cualquier basura cae a 0. */
export function toAmount(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

/** `$1.234,50` — la forma canónica para importes que el usuario puede auditar. */
export function formatCurrency(value: unknown): string {
    return money.format(toAmount(value));
}

/**
 * `$1,2 mil` — sólo para tarjetas de resumen donde el ancho manda.
 * Nunca para importes que alguien vaya a cuadrar contra una factura.
 */
export function formatCurrencyCompact(value: unknown): string {
    return moneyCompact.format(toAmount(value));
}
