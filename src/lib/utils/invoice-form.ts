/**
 * invoice-form.ts
 * Lógica pura de validación, cálculo y construcción de payload para el
 * formulario de creación manual de facturas. Sin dependencias de DOM,
 * completamente testeable con vitest.
 */

// ── Tipos públicos ────────────────────────────────────────────────────────────

export interface InvoiceFormState {
    client_id: string;
    client_plan_id: string;
    issue_date: string;
    due_date: string;
    amount: string | number;
    tax_rate: number;       // porcentaje (ej. 15 = 15 %)
    status: InvoiceStatus;
    description: string;
}

export type InvoiceStatus = 'draft' | 'pending' | 'paid' | 'failed' | 'cancelled';

export interface ValidationError {
    field: keyof InvoiceFormState;
    message: string;
}

export interface ValidationResult {
    ok: boolean;
    errors: ValidationError[];
}

export interface InvoiceTotals {
    amount: number;
    tax_amount: number;
    total_amount: number;
    tax_rate: number;
}

export interface InvoicePayload {
    client_id: number;
    client_plan_id: number;
    issue_date: string;
    due_date: string;
    amount: number;
    tax_amount: number;
    total_amount: number;
    status: InvoiceStatus;
    description: string;
}

// ── Constantes ────────────────────────────────────────────────────────────────

export const VALID_STATUSES: InvoiceStatus[] = ['draft', 'pending', 'paid', 'failed', 'cancelled'];
export const TAX_RATES = [0, 15] as const; // Ecuador: 0% (exento) y 15% IVA (Decreto 470/2024)
export const DEFAULT_TAX_RATE = 15;
export const MAX_DESCRIPTION_LENGTH = 500;
export const MAX_AMOUNT = 9_999_999.99;
export const MIN_DUE_DATE_DAYS = 1;   // mínimo 1 día después de issue_date

// ── Cálculo de totales ────────────────────────────────────────────────────────

/**
 * Calcula impuesto y total a partir del monto base y la tasa porcentual.
 * Redondea a 2 decimales usando rounding bancario para evitar acumulación
 * de error de punto flotante.
 */
export function calcTotals(amount: number, taxRate: number): InvoiceTotals {
    if (!isFinite(amount) || amount < 0) amount = 0;
    if (!isFinite(taxRate) || taxRate < 0) taxRate = 0;

    const tax_amount = round2(amount * (taxRate / 100));
    const total_amount = round2(amount + tax_amount);

    return { amount: round2(amount), tax_amount, total_amount, tax_rate: taxRate };
}

function round2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ── Validación ────────────────────────────────────────────────────────────────

/**
 * Valida el estado completo del formulario y devuelve todos los errores
 * encontrados (no se detiene en el primero).
 */
export function validateInvoiceForm(form: InvoiceFormState): ValidationResult {
    const errors: ValidationError[] = [];

    // cliente
    if (!form.client_id || String(form.client_id).trim() === '') {
        errors.push({ field: 'client_id', message: 'Debe seleccionar un cliente.' });
    }

    // plan
    if (!form.client_plan_id || String(form.client_plan_id).trim() === '') {
        errors.push({ field: 'client_plan_id', message: 'Debe seleccionar un plan contratado.' });
    }

    // fecha emisión
    if (!form.issue_date) {
        errors.push({ field: 'issue_date', message: 'La fecha de emisión es obligatoria.' });
    } else if (!isValidDate(form.issue_date)) {
        errors.push({ field: 'issue_date', message: 'La fecha de emisión no es válida.' });
    }

    // fecha vencimiento
    if (!form.due_date) {
        errors.push({ field: 'due_date', message: 'La fecha de vencimiento es obligatoria.' });
    } else if (!isValidDate(form.due_date)) {
        errors.push({ field: 'due_date', message: 'La fecha de vencimiento no es válida.' });
    } else if (form.issue_date && isValidDate(form.issue_date)) {
        const issueMs = Date.parse(form.issue_date);
        const dueMs   = Date.parse(form.due_date);
        if (dueMs < issueMs) {
            errors.push({ field: 'due_date', message: 'La fecha de vencimiento debe ser igual o posterior a la fecha de emisión.' });
        }
    }

    // monto
    const amountNum = Number(form.amount);
    if (form.amount === '' || form.amount === null || form.amount === undefined) {
        errors.push({ field: 'amount', message: 'El monto base es obligatorio.' });
    } else if (isNaN(amountNum)) {
        errors.push({ field: 'amount', message: 'El monto debe ser un número válido.' });
    } else if (amountNum < 0) {
        errors.push({ field: 'amount', message: 'El monto no puede ser negativo.' });
    } else if (amountNum === 0) {
        errors.push({ field: 'amount', message: 'El monto debe ser mayor a $0.00.' });
    } else if (amountNum > MAX_AMOUNT) {
        errors.push({ field: 'amount', message: `El monto no puede superar $${MAX_AMOUNT.toLocaleString()}.` });
    }

    // tasa de impuesto
    if (!isFinite(form.tax_rate) || form.tax_rate < 0 || form.tax_rate > 100) {
        errors.push({ field: 'tax_rate', message: 'La tasa de impuesto debe estar entre 0 % y 100 %.' });
    }

    // estado
    if (!VALID_STATUSES.includes(form.status)) {
        errors.push({ field: 'status', message: 'El estado seleccionado no es válido.' });
    }

    // descripción
    if (form.description && form.description.length > MAX_DESCRIPTION_LENGTH) {
        errors.push({ field: 'description', message: `La descripción no puede superar ${MAX_DESCRIPTION_LENGTH} caracteres.` });
    }

    return { ok: errors.length === 0, errors };
}

// ── Helpers de validación de fecha ───────────────────────────────────────────

export function isValidDate(dateStr: string): boolean {
    if (!dateStr || typeof dateStr !== 'string') return false;
    // Acepta formato YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
    const ts = Date.parse(dateStr);
    if (isNaN(ts)) return false;
    // Reconstruye para detectar fechas imposibles como 2025-02-31
    const d = new Date(dateStr);
    return d.toISOString().startsWith(dateStr);
}

/**
 * Suma `days` días calendario a una fecha YYYY-MM-DD y devuelve el resultado
 * en el mismo formato.
 * Usa aritmética sobre los componentes locales para evitar el desplazamiento
 * de huso horario que produce toISOString() (que es siempre UTC).
 */
export function addDays(dateStr: string, days: number): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d + days);
    const yr  = date.getFullYear();
    const mo  = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${day}`;
}

/**
 * Devuelve la fecha de hoy en formato YYYY-MM-DD, en timezone local.
 */
export function todayISO(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

// ── Construcción del payload ──────────────────────────────────────────────────

/**
 * Construye el payload listo para enviar a la API.
 * Presupone que `validateInvoiceForm` ya fue llamado y el resultado fue ok.
 */
export function buildInvoicePayload(form: InvoiceFormState): InvoicePayload {
    const amountNum = Number(form.amount);
    const { tax_amount, total_amount } = calcTotals(amountNum, form.tax_rate);

    return {
        client_id:      Number(form.client_id),
        client_plan_id: Number(form.client_plan_id),
        issue_date:     form.issue_date,
        due_date:       form.due_date,
        amount:         round2(amountNum),
        tax_amount,
        total_amount,
        status:         form.status,
        description:    form.description.trim(),
    };
}

// ── Filtrado de autocompletado ────────────────────────────────────────────────

export interface ClientSummary {
    id: number;
    name: string;
    dni: string;
    email?: string;
}

/**
 * Filtra la lista de clientes por término de búsqueda (nombre, DNI o email).
 * Retorna máximo `limit` resultados para no saturar el dropdown.
 */
export function filterClients(clients: ClientSummary[], term: string, limit = 8): ClientSummary[] {
    if (!term || term.trim().length < 1) return clients.slice(0, limit);
    const q = term.toLowerCase().trim();
    return clients
        .filter(c =>
            c.name.toLowerCase().includes(q) ||
            c.dni.toLowerCase().includes(q) ||
            (c.email ?? '').toLowerCase().includes(q)
        )
        .slice(0, limit);
}

// ── Detección de posible duplicado ───────────────────────────────────────────

export interface ExistingInvoice {
    client_id: number;
    client_plan_id: number;
    issue_date: string;   // YYYY-MM-DD
}

/**
 * Detecta si ya existe una factura para la misma combinación de
 * cliente + plan en el mismo mes/año que la fecha de emisión indicada.
 * Retorna true si se detecta un posible duplicado.
 */
export function isPossibleDuplicate(
    existing: ExistingInvoice[],
    form: { client_id: string; client_plan_id: string; issue_date: string }
): boolean {
    if (!form.client_id || !form.client_plan_id || !form.issue_date) return false;
    if (!isValidDate(form.issue_date)) return false;

    const [year, month] = form.issue_date.split('-').map(Number);
    const clientId = Number(form.client_id);
    const planId   = Number(form.client_plan_id);

    return existing.some(inv => {
        if (inv.client_id !== clientId || inv.client_plan_id !== planId) return false;
        const [iy, im] = inv.issue_date.split('-').map(Number);
        return iy === year && im === month;
    });
}

// ── Descripción auto-generada ─────────────────────────────────────────────────

/**
 * Genera una descripción predeterminada a partir del nombre del plan y la
 * fecha de emisión. Se usa para pre-rellenar el campo description.
 */
export function defaultDescription(planName: string, issueDate: string): string {
    if (!issueDate || !isValidDate(issueDate)) return `Servicio de Internet — ${planName}`;
    const d = new Date(issueDate + 'T00:00:00');
    const mes = d.toLocaleDateString('es-EC', { month: 'long', year: 'numeric' });
    return `Servicio de Internet (${planName}) — ${mes.charAt(0).toUpperCase() + mes.slice(1)}`;
}
