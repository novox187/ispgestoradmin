// Formas de datos del módulo de clientes.
//
// Viven aquí y no dentro de los componentes porque un `export interface` en el
// bloque de instancia de un .svelte no es un export de módulo: Svelte trata los
// exports de ese bloque como props del componente.

/** Contadores de cartera que devuelve `GET /admin/clientes/summary` en `stats`. */
export interface ClientStats {
    total: number;
    active: number;
    suspended: number;
    inactive: number;
    with_debt: number;
    without_plan: number;
    debt_amount: number;
}

/** Fila del listado resumido de clientes. */
export interface ClientRow {
    id: number;
    name: string;
    email?: string | null;
    phone?: string | null;
    document_id?: string | null;
    plan?: string | null;
    plan_price?: number | null;
    status?: string;
    ip?: string | null;
    contract_date?: string | null;
    wallet_balance?: number;
    debt_total?: number;
    debt_count?: number;
    overdue_count?: number;
}

/** Factura tal como llega embebida en la ficha completa del cliente. */
export interface InvoiceLite {
    id: number;
    invoice_number?: string;
    issue_date?: string;
    due_date?: string;
    amount?: number | string;
    tax_amount?: number | string;
    total_amount?: number | string;
    status?: string;
    description?: string;
}
