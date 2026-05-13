/**
 * Single source of truth for the permission matrix.
 * Every module and its allowed actions are defined here.
 *
 * To add a new module: append an entry to PERMISSION_MODULES.
 * To add a new action to a module: add the action string to that module's `actions` array.
 *
 * After any change, run `php artisan db:seed --class=PermissionSeeder` on the backend
 * so the database reflects the new slugs.
 *
 * Generated slug format: `{module}.{action}` — e.g. `usuarios.crear`, `clientes.ver`
 */
export const PERMISSION_MODULES = [
    { slug: 'usuarios',      label: 'Usuarios',       actions: ['ver', 'crear', 'editar', 'eliminar'] },
    { slug: 'clientes',      label: 'Clientes',        actions: ['ver', 'crear', 'editar', 'eliminar'] },
    { slug: 'planes',        label: 'Planes',          actions: ['ver', 'crear', 'editar', 'eliminar'] },
    { slug: 'facturas',      label: 'Facturación',     actions: ['ver', 'crear', 'editar', 'eliminar'] },
    { slug: 'mikrotik',      label: 'MikroTik',        actions: ['ver', 'gestionar'] },
    { slug: 'proveedores',   label: 'Proveedores ISP', actions: ['ver', 'crear', 'editar', 'eliminar'] },
    { slug: 'soporte',       label: 'Soporte / Chat',  actions: ['ver', 'gestionar'] },
    { slug: 'configuracion', label: 'Configuración',   actions: ['ver', 'gestionar'] },
] as const;

/** All possible action columns (union across every module). */
export const ALL_ACTIONS = ['ver', 'crear', 'editar', 'eliminar', 'gestionar'] as const;

export type PermissionModule = (typeof PERMISSION_MODULES)[number];
export type ModuleSlug       = PermissionModule['slug'];
export type ActionSlug       = (typeof ALL_ACTIONS)[number];

/** Build the full slug from a module + action pair. */
export function permSlug(module: string, action: string): string {
    return `${module}.${action}`;
}
