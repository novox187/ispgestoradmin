import { describe, it, expect } from 'vitest';
import {
    calcTotals,
    validateInvoiceForm,
    isValidDate,
    addDays,
    todayISO,
    buildInvoicePayload,
    filterClients,
    isPossibleDuplicate,
    defaultDescription,
    DEFAULT_TAX_RATE,
    MAX_AMOUNT,
    MAX_DESCRIPTION_LENGTH,
    type InvoiceFormState,
    type ClientSummary,
    type ExistingInvoice,
} from './invoice-form';

// ── Helpers ───────────────────────────────────────────────────────────────────

function baseForm(overrides: Partial<InvoiceFormState> = {}): InvoiceFormState {
    return {
        client_id:      '42',
        client_plan_id: '7',
        issue_date:     '2025-06-01',
        due_date:       '2025-06-16',
        amount:         100,
        tax_rate:       15,
        status:         'pending',
        description:    'Servicio de prueba',
        ...overrides,
    };
}

// ══════════════════════════════════════════════════════════════════════════════
// calcTotals
// ══════════════════════════════════════════════════════════════════════════════

describe('calcTotals', () => {
    it('calcula correctamente con tasa del 15 %', () => {
        const { amount, tax_amount, total_amount, tax_rate } = calcTotals(100, 15);
        expect(amount).toBe(100);
        expect(tax_amount).toBe(15);
        expect(total_amount).toBe(115);
        expect(tax_rate).toBe(15);
    });

    it('calcula correctamente con tasa del 0 %', () => {
        const t = calcTotals(200, 0);
        expect(t.tax_amount).toBe(0);
        expect(t.total_amount).toBe(200);
    });

    it('redondea correctamente montos con decimales largos', () => {
        // 99.99 * 15% = 14.9985 → debe quedar 15.00
        const t = calcTotals(99.99, 15);
        expect(t.tax_amount).toBe(15);
        expect(t.total_amount).toBe(114.99);
    });

    it('redondea a 2 decimales (caso 1/3)', () => {
        // 10 * (10/100) = 1.0 exacto; 10/3 * 3 = posibles errores de punto flotante
        const t = calcTotals(10 / 3, 30);
        expect(t.tax_amount).toBeLessThanOrEqual(10);
        // total_amount debe ser un número finito con ≤ 2 decimales
        const str = t.total_amount.toString();
        const decimals = str.includes('.') ? str.split('.')[1].length : 0;
        expect(decimals).toBeLessThanOrEqual(2);
    });

    it('devuelve 0 para monto negativo', () => {
        const t = calcTotals(-50, 15);
        expect(t.amount).toBe(0);
        expect(t.total_amount).toBe(0);
    });

    it('devuelve 0 para tasa negativa', () => {
        const t = calcTotals(100, -5);
        expect(t.tax_amount).toBe(0);
        expect(t.total_amount).toBe(100);
    });

    it('maneja monto NaN y devuelve 0', () => {
        const t = calcTotals(NaN, 15);
        expect(t.amount).toBe(0);
    });

    it('calcula correctamente con monto grande', () => {
        const t = calcTotals(9_999_999.99, 15);
        expect(t.tax_amount).toBeCloseTo(1_499_999.998, 0);
        expect(t.total_amount).toBeGreaterThan(9_999_999.99);
    });

    it('tasa del 100 %: total es el doble del monto', () => {
        const t = calcTotals(500, 100);
        expect(t.tax_amount).toBe(500);
        expect(t.total_amount).toBe(1000);
    });
});

// ══════════════════════════════════════════════════════════════════════════════
// isValidDate
// ══════════════════════════════════════════════════════════════════════════════

describe('isValidDate', () => {
    it('acepta fechas válidas YYYY-MM-DD', () => {
        expect(isValidDate('2025-01-01')).toBe(true);
        expect(isValidDate('2025-12-31')).toBe(true);
        expect(isValidDate('2024-02-29')).toBe(true); // 2024 es bisiesto
    });

    it('rechaza formato incorrecto', () => {
        expect(isValidDate('01/01/2025')).toBe(false);
        expect(isValidDate('2025/01/01')).toBe(false);
        expect(isValidDate('2025-1-1')).toBe(false);
    });

    it('rechaza fecha imposible', () => {
        expect(isValidDate('2025-02-30')).toBe(false);
        expect(isValidDate('2025-13-01')).toBe(false);
        expect(isValidDate('2025-00-10')).toBe(false);
    });

    it('rechaza string vacío y undefined/null', () => {
        expect(isValidDate('')).toBe(false);
        expect(isValidDate(null as any)).toBe(false);
        expect(isValidDate(undefined as any)).toBe(false);
    });

    it('rechaza 29-feb en año no bisiesto', () => {
        expect(isValidDate('2025-02-29')).toBe(false);
        expect(isValidDate('2023-02-29')).toBe(false);
    });
});

// ══════════════════════════════════════════════════════════════════════════════
// addDays
// ══════════════════════════════════════════════════════════════════════════════

describe('addDays', () => {
    it('suma 15 días correctamente', () => {
        expect(addDays('2025-06-01', 15)).toBe('2025-06-16');
    });

    it('cruza mes correctamente', () => {
        expect(addDays('2025-01-20', 15)).toBe('2025-02-04');
    });

    it('cruza año correctamente', () => {
        expect(addDays('2025-12-25', 10)).toBe('2026-01-04');
    });

    it('suma 0 días devuelve la misma fecha', () => {
        expect(addDays('2025-06-01', 0)).toBe('2025-06-01');
    });

    it('maneja años bisiestos', () => {
        expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
        expect(addDays('2025-02-28', 1)).toBe('2025-03-01');
    });
});

// ══════════════════════════════════════════════════════════════════════════════
// todayISO
// ══════════════════════════════════════════════════════════════════════════════

describe('todayISO', () => {
    it('devuelve una cadena con formato YYYY-MM-DD', () => {
        const today = todayISO();
        expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(isValidDate(today)).toBe(true);
    });
});

// ══════════════════════════════════════════════════════════════════════════════
// validateInvoiceForm
// ══════════════════════════════════════════════════════════════════════════════

describe('validateInvoiceForm — formulario válido', () => {
    it('aprueba un formulario completamente válido', () => {
        const result = validateInvoiceForm(baseForm());
        expect(result.ok).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('acepta tasa del 0 % con monto válido', () => {
        const result = validateInvoiceForm(baseForm({ tax_rate: 0 }));
        expect(result.ok).toBe(true);
    });

    it('acepta descripción vacía', () => {
        const result = validateInvoiceForm(baseForm({ description: '' }));
        expect(result.ok).toBe(true);
    });

    it('acepta estado draft', () => {
        const result = validateInvoiceForm(baseForm({ status: 'draft' }));
        expect(result.ok).toBe(true);
    });

    it('acepta fecha de vencimiento igual a la fecha de emisión', () => {
        const result = validateInvoiceForm(baseForm({ due_date: '2025-06-01' }));
        expect(result.ok).toBe(true);
    });
});

describe('validateInvoiceForm — campo client_id', () => {
    it('falla si client_id está vacío', () => {
        const r = validateInvoiceForm(baseForm({ client_id: '' }));
        expect(r.ok).toBe(false);
        expect(r.errors.some(e => e.field === 'client_id')).toBe(true);
    });

    it('falla si client_id es solo espacios', () => {
        const r = validateInvoiceForm(baseForm({ client_id: '   ' }));
        expect(r.ok).toBe(false);
    });
});

describe('validateInvoiceForm — campo client_plan_id', () => {
    it('falla si client_plan_id está vacío', () => {
        const r = validateInvoiceForm(baseForm({ client_plan_id: '' }));
        expect(r.ok).toBe(false);
        expect(r.errors.some(e => e.field === 'client_plan_id')).toBe(true);
    });
});

describe('validateInvoiceForm — fechas', () => {
    it('falla si issue_date está vacía', () => {
        const r = validateInvoiceForm(baseForm({ issue_date: '' }));
        expect(r.ok).toBe(false);
        expect(r.errors.find(e => e.field === 'issue_date')?.message).toBeTruthy();
    });

    it('falla si issue_date tiene formato incorrecto', () => {
        const r = validateInvoiceForm(baseForm({ issue_date: '01-06-2025' }));
        expect(r.ok).toBe(false);
        expect(r.errors.some(e => e.field === 'issue_date')).toBe(true);
    });

    it('falla si due_date está vacía', () => {
        const r = validateInvoiceForm(baseForm({ due_date: '' }));
        expect(r.ok).toBe(false);
        expect(r.errors.some(e => e.field === 'due_date')).toBe(true);
    });

    it('falla si due_date es anterior a issue_date', () => {
        const r = validateInvoiceForm(baseForm({ due_date: '2025-05-31' }));
        expect(r.ok).toBe(false);
        const err = r.errors.find(e => e.field === 'due_date');
        expect(err).toBeDefined();
        expect(err!.message).toMatch(/posterior/i);
    });

    it('no falla si due_date == issue_date (mismo día)', () => {
        const r = validateInvoiceForm(baseForm({ issue_date: '2025-06-01', due_date: '2025-06-01' }));
        expect(r.errors.some(e => e.field === 'due_date')).toBe(false);
    });
});

describe('validateInvoiceForm — campo amount', () => {
    it('falla si amount es 0', () => {
        const r = validateInvoiceForm(baseForm({ amount: 0 }));
        expect(r.ok).toBe(false);
        expect(r.errors.some(e => e.field === 'amount')).toBe(true);
    });

    it('falla si amount es negativo', () => {
        const r = validateInvoiceForm(baseForm({ amount: -1 }));
        expect(r.ok).toBe(false);
    });

    it('falla si amount supera el máximo', () => {
        const r = validateInvoiceForm(baseForm({ amount: MAX_AMOUNT + 1 }));
        expect(r.ok).toBe(false);
        const err = r.errors.find(e => e.field === 'amount');
        expect(err?.message).toMatch(/superar/i);
    });

    it('falla si amount está vacío (string)', () => {
        const r = validateInvoiceForm(baseForm({ amount: '' }));
        expect(r.ok).toBe(false);
        expect(r.errors.some(e => e.field === 'amount')).toBe(true);
    });

    it('acepta amount en el límite exacto', () => {
        const r = validateInvoiceForm(baseForm({ amount: MAX_AMOUNT }));
        expect(r.errors.some(e => e.field === 'amount')).toBe(false);
    });

    it('acepta montos con decimales', () => {
        const r = validateInvoiceForm(baseForm({ amount: 49.99 }));
        expect(r.ok).toBe(true);
    });
});

describe('validateInvoiceForm — campo tax_rate', () => {
    it('falla si tax_rate es negativo', () => {
        const r = validateInvoiceForm(baseForm({ tax_rate: -1 }));
        expect(r.ok).toBe(false);
        expect(r.errors.some(e => e.field === 'tax_rate')).toBe(true);
    });

    it('falla si tax_rate > 100', () => {
        const r = validateInvoiceForm(baseForm({ tax_rate: 101 }));
        expect(r.ok).toBe(false);
    });

    it('acepta tax_rate = 0', () => {
        const r = validateInvoiceForm(baseForm({ tax_rate: 0 }));
        expect(r.errors.some(e => e.field === 'tax_rate')).toBe(false);
    });

    it('acepta tax_rate = 100', () => {
        const r = validateInvoiceForm(baseForm({ tax_rate: 100 }));
        expect(r.errors.some(e => e.field === 'tax_rate')).toBe(false);
    });
});

describe('validateInvoiceForm — campo status', () => {
    it('falla con estado inválido', () => {
        const r = validateInvoiceForm(baseForm({ status: 'invalid' as any }));
        expect(r.ok).toBe(false);
        expect(r.errors.some(e => e.field === 'status')).toBe(true);
    });
});

describe('validateInvoiceForm — campo description', () => {
    it('falla si supera MAX_DESCRIPTION_LENGTH', () => {
        const r = validateInvoiceForm(baseForm({ description: 'x'.repeat(MAX_DESCRIPTION_LENGTH + 1) }));
        expect(r.ok).toBe(false);
        expect(r.errors.some(e => e.field === 'description')).toBe(true);
    });

    it('acepta descripción exactamente en el límite', () => {
        const r = validateInvoiceForm(baseForm({ description: 'x'.repeat(MAX_DESCRIPTION_LENGTH) }));
        expect(r.errors.some(e => e.field === 'description')).toBe(false);
    });
});

describe('validateInvoiceForm — errores múltiples', () => {
    it('reporta todos los errores de una vez (formulario vacío)', () => {
        const empty: InvoiceFormState = {
            client_id: '', client_plan_id: '', issue_date: '', due_date: '',
            amount: '', tax_rate: 15, status: 'pending', description: '',
        };
        const r = validateInvoiceForm(empty);
        expect(r.ok).toBe(false);
        expect(r.errors.length).toBeGreaterThanOrEqual(4);
    });
});

// ══════════════════════════════════════════════════════════════════════════════
// buildInvoicePayload
// ══════════════════════════════════════════════════════════════════════════════

describe('buildInvoicePayload', () => {
    it('construye el payload correctamente con tasa 15 %', () => {
        const payload = buildInvoicePayload(baseForm({ amount: 200, tax_rate: 15 }));
        expect(payload.client_id).toBe(42);
        expect(payload.client_plan_id).toBe(7);
        expect(payload.amount).toBe(200);
        expect(payload.tax_amount).toBe(30);
        expect(payload.total_amount).toBe(230);
        expect(payload.status).toBe('pending');
    });

    it('recorta los espacios de la descripción', () => {
        const payload = buildInvoicePayload(baseForm({ description: '  test  ' }));
        expect(payload.description).toBe('test');
    });

    it('convierte client_id y client_plan_id a número', () => {
        const payload = buildInvoicePayload(baseForm({ client_id: '99', client_plan_id: '3' }));
        expect(typeof payload.client_id).toBe('number');
        expect(typeof payload.client_plan_id).toBe('number');
    });

    it('amount en el payload es redondeado a 2 decimales', () => {
        const payload = buildInvoicePayload(baseForm({ amount: 33.333 }));
        const str = payload.amount.toString();
        const decimals = str.includes('.') ? str.split('.')[1].length : 0;
        expect(decimals).toBeLessThanOrEqual(2);
    });
});

// ══════════════════════════════════════════════════════════════════════════════
// filterClients
// ══════════════════════════════════════════════════════════════════════════════

describe('filterClients', () => {
    const clients: ClientSummary[] = [
        { id: 1, name: 'Juan Pérez',    dni: '12345678', email: 'juan@example.com' },
        { id: 2, name: 'María López',   dni: '87654321', email: 'maria@example.com' },
        { id: 3, name: 'Carlos García', dni: '11111111', email: 'carlos@example.com' },
        { id: 4, name: 'Ana Martínez',  dni: '22222222', email: 'ana@example.com' },
    ];

    it('retorna todos si el término está vacío (respetando limit)', () => {
        const result = filterClients(clients, '', 10);
        expect(result).toHaveLength(4);
    });

    it('filtra por nombre (case insensitive)', () => {
        const result = filterClients(clients, 'juan');
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe(1);
    });

    it('filtra por DNI', () => {
        const result = filterClients(clients, '87654321');
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe(2);
    });

    it('filtra por email parcial', () => {
        const result = filterClients(clients, 'carlos@');
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe(3);
    });

    it('retorna vacío si no hay coincidencias', () => {
        const result = filterClients(clients, 'zzzzz');
        expect(result).toHaveLength(0);
    });

    it('respeta el límite de resultados', () => {
        // Crea 20 clientes con el mismo nombre
        const many: ClientSummary[] = Array.from({ length: 20 }, (_, i) => ({
            id: i + 1, name: 'Test User', dni: String(i).padStart(8, '0'), email: `t${i}@x.com`,
        }));
        const result = filterClients(many, 'Test', 5);
        expect(result).toHaveLength(5);
    });

    it('retorna máximo 8 resultados por defecto', () => {
        const many: ClientSummary[] = Array.from({ length: 20 }, (_, i) => ({
            id: i + 1, name: 'User', dni: String(i).padStart(8, '0'),
        }));
        const result = filterClients(many, '');
        expect(result).toHaveLength(8);
    });

    it('maneja clientes sin email', () => {
        const noEmail: ClientSummary[] = [{ id: 1, name: 'Sin Email', dni: '00000000' }];
        expect(() => filterClients(noEmail, 'sin')).not.toThrow();
        expect(filterClients(noEmail, 'sin')).toHaveLength(1);
    });
});

// ══════════════════════════════════════════════════════════════════════════════
// isPossibleDuplicate
// ══════════════════════════════════════════════════════════════════════════════

describe('isPossibleDuplicate', () => {
    const existing: ExistingInvoice[] = [
        { client_id: 1, client_plan_id: 10, issue_date: '2025-06-15' },
        { client_id: 2, client_plan_id: 20, issue_date: '2025-05-01' },
    ];

    it('detecta duplicado mismo cliente+plan en el mismo mes', () => {
        const result = isPossibleDuplicate(existing, {
            client_id: '1', client_plan_id: '10', issue_date: '2025-06-01',
        });
        expect(result).toBe(true);
    });

    it('no detecta duplicado si el mes es diferente', () => {
        const result = isPossibleDuplicate(existing, {
            client_id: '1', client_plan_id: '10', issue_date: '2025-07-01',
        });
        expect(result).toBe(false);
    });

    it('no detecta duplicado si el cliente es diferente', () => {
        const result = isPossibleDuplicate(existing, {
            client_id: '3', client_plan_id: '10', issue_date: '2025-06-01',
        });
        expect(result).toBe(false);
    });

    it('no detecta duplicado si el plan es diferente', () => {
        const result = isPossibleDuplicate(existing, {
            client_id: '1', client_plan_id: '99', issue_date: '2025-06-01',
        });
        expect(result).toBe(false);
    });

    it('devuelve false si los campos están vacíos', () => {
        expect(isPossibleDuplicate(existing, { client_id: '', client_plan_id: '10', issue_date: '2025-06-01' })).toBe(false);
        expect(isPossibleDuplicate(existing, { client_id: '1', client_plan_id: '', issue_date: '2025-06-01' })).toBe(false);
        expect(isPossibleDuplicate(existing, { client_id: '1', client_plan_id: '10', issue_date: '' })).toBe(false);
    });

    it('devuelve false con lista vacía', () => {
        const result = isPossibleDuplicate([], { client_id: '1', client_plan_id: '10', issue_date: '2025-06-01' });
        expect(result).toBe(false);
    });

    it('detecta duplicado al final del mes', () => {
        const result = isPossibleDuplicate(existing, {
            client_id: '1', client_plan_id: '10', issue_date: '2025-06-30',
        });
        expect(result).toBe(true);
    });

    it('no detecta duplicado si el año es diferente', () => {
        const result = isPossibleDuplicate(existing, {
            client_id: '1', client_plan_id: '10', issue_date: '2026-06-01',
        });
        expect(result).toBe(false);
    });
});

// ══════════════════════════════════════════════════════════════════════════════
// defaultDescription
// ══════════════════════════════════════════════════════════════════════════════

describe('defaultDescription', () => {
    it('genera descripción con mes y plan', () => {
        const desc = defaultDescription('Plan Básico 10MB', '2025-06-01');
        expect(desc).toContain('Plan Básico 10MB');
        expect(desc).toContain('Junio');
        expect(desc).toContain('2025');
    });

    it('capitaliza la primera letra del mes', () => {
        const desc = defaultDescription('Plan X', '2025-01-15');
        expect(desc[0]).toMatch(/[A-Z]/);
    });

    it('devuelve descripción sin mes si la fecha es inválida', () => {
        const desc = defaultDescription('Plan Y', 'not-a-date');
        expect(desc).toContain('Plan Y');
    });

    it('devuelve descripción sin mes si la fecha está vacía', () => {
        const desc = defaultDescription('Plan Z', '');
        expect(desc).toContain('Plan Z');
    });
});

// ══════════════════════════════════════════════════════════════════════════════
// Tests de integración — flujo completo de creación
// ══════════════════════════════════════════════════════════════════════════════

describe('Integración — flujo de creación de factura', () => {
    it('valida, calcula y construye payload correctamente en flujo normal', () => {
        const form = baseForm({ amount: 80, tax_rate: 15 });

        const validation = validateInvoiceForm(form);
        expect(validation.ok).toBe(true);

        const totals = calcTotals(Number(form.amount), form.tax_rate);
        expect(totals.tax_amount).toBe(12);
        expect(totals.total_amount).toBe(92);

        const payload = buildInvoicePayload(form);
        expect(payload.amount).toBe(80);
        expect(payload.tax_amount).toBe(12);
        expect(payload.total_amount).toBe(92);
        expect(payload.client_id).toBe(42);
        expect(payload.client_plan_id).toBe(7);
    });

    it('detecta duplicado antes de enviar', () => {
        const form = baseForm();
        const existing: ExistingInvoice[] = [
            { client_id: 42, client_plan_id: 7, issue_date: '2025-06-10' },
        ];
        const isDuplicate = isPossibleDuplicate(existing, form);
        expect(isDuplicate).toBe(true);
        // En este caso el flujo debe pedir confirmación — no bloquearlo
    });

    it('formulario con todos los errores posibles no genera payload', () => {
        const form: InvoiceFormState = {
            client_id: '', client_plan_id: '', issue_date: '', due_date: '',
            amount: -100, tax_rate: -5, status: 'invalid' as any,
            description: 'x'.repeat(MAX_DESCRIPTION_LENGTH + 1),
        };
        const { ok, errors } = validateInvoiceForm(form);
        expect(ok).toBe(false);
        expect(errors.length).toBeGreaterThanOrEqual(6);
    });

    it('autocompletado + cálculo en tiempo real: selección de cliente filtra correctamente', () => {
        const clients: ClientSummary[] = [
            { id: 1, name: 'Empresa ABC', dni: '900123456', email: 'abc@empresa.com' },
            { id: 2, name: 'Empresa XYZ', dni: '900999000', email: 'xyz@empresa.com' },
        ];
        const filtered = filterClients(clients, 'ABC');
        expect(filtered).toHaveLength(1);
        expect(filtered[0].id).toBe(1);

        // Simula selección y cálculo
        const form = baseForm({ client_id: String(filtered[0].id), amount: 150, tax_rate: DEFAULT_TAX_RATE });
        const totals = calcTotals(150, DEFAULT_TAX_RATE);
        expect(totals.total_amount).toBe(172.5);

        const { ok } = validateInvoiceForm(form);
        expect(ok).toBe(true);
    });

    it('actualizar monto recalcula totales en tiempo real correctamente', () => {
        const amounts = [50, 100, 200, 999.99];
        const rate = 15;
        for (const amt of amounts) {
            const { tax_amount, total_amount } = calcTotals(amt, rate);
            const expected_tax = Math.round((amt * 0.15 + Number.EPSILON) * 100) / 100;
            const expected_total = Math.round((amt + expected_tax + Number.EPSILON) * 100) / 100;
            expect(tax_amount).toBe(expected_tax);
            expect(total_amount).toBe(expected_total);
        }
    });

    it('DEFAULT_TAX_RATE es 15', () => {
        expect(DEFAULT_TAX_RATE).toBe(15);
    });
});
