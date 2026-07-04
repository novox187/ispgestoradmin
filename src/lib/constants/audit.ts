// Etiquetas y estilos compartidos para presentar registros de auditoría.
// Usados por el visor general (/configuraciones/auditoria) y el historial
// por cliente (ClientHistoryDrawer).

export const operationLabels: Record<string, string> = {
  INSERT: 'Creado',
  UPDATE: 'Modificado',
  DELETE: 'Eliminado',
  UPDATE_DETAILS: 'Edición manual',
  SUSPEND_TECH_OP: 'Corte manual',
  SUSPEND_AUTO_OP: 'Corte automático',
  SUSPEND_FAILED_OP: 'Corte fallido',
  SUSPEND_BLOCKED_WHITELIST: 'Corte bloqueado (lista blanca)',
  ACTIVATE_TECH_OP: 'Reactivación manual',
  ACTIVATE_FAILED_OP: 'Reactivación fallida',
  REACTIVATE_AUTO_OP: 'Reactivación automática',
  CANCEL_OP: 'Baja del servicio',
  INVOICE_DUE_CALC_OP: 'Cálculo de vencimiento',
  WHITELIST_CREATE: 'Inclusión en lista blanca',
  WHITELIST_UPDATE: 'Edición de lista blanca',
  WHITELIST_DELETE: 'Baja de lista blanca',
  SYNC: 'Sincronización',
};

export const operationStyles: Record<string, string> = {
  INSERT: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
  UPDATE: 'bg-blue-500/10 text-blue-400 border-blue-500/25',
  DELETE: 'bg-red-500/10 text-red-400 border-red-500/25',
  UPDATE_DETAILS: 'bg-blue-500/10 text-blue-400 border-blue-500/25',
  SUSPEND_TECH_OP: 'bg-orange-500/10 text-orange-400 border-orange-500/25',
  SUSPEND_AUTO_OP: 'bg-orange-500/10 text-orange-400 border-orange-500/25',
  SUSPEND_FAILED_OP: 'bg-red-500/10 text-red-400 border-red-500/25',
  SUSPEND_BLOCKED_WHITELIST: 'bg-purple-500/10 text-purple-400 border-purple-500/25',
  ACTIVATE_TECH_OP: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
  ACTIVATE_FAILED_OP: 'bg-red-500/10 text-red-400 border-red-500/25',
  REACTIVATE_AUTO_OP: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
  CANCEL_OP: 'bg-neutral-500/10 text-neutral-300 border-neutral-500/25',
  WHITELIST_CREATE: 'bg-purple-500/10 text-purple-400 border-purple-500/25',
  WHITELIST_UPDATE: 'bg-purple-500/10 text-purple-400 border-purple-500/25',
  WHITELIST_DELETE: 'bg-purple-500/10 text-purple-400 border-purple-500/25',
};

export const tableLabels: Record<string, string> = {
  clients: 'Cliente',
  client_plans: 'Plan del cliente',
  invoices: 'Factura',
  transactions: 'Transacción',
  wallets: 'Billetera',
  client_whitelists: 'Lista blanca',
  tickets: 'Ticket',
  mikrotik_queues: 'Cola MikroTik',
  mikrotik_queue_sync: 'Sync MikroTik',
  automation_settings: 'Automatización',
};

export function formatAuditDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-EC', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function formatAuditValue(v: any): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  if (typeof v === 'object') return JSON.stringify(v, null, 1);
  return String(v);
}
