/**
 * Reactive auth store.
 * Reads from localStorage on boot and stays in sync after login/logout.
 * Exposes can(slug) to check if the current employee has a permission.
 */

function read(key: string): string {
    if (typeof localStorage === 'undefined') return '';
    return localStorage.getItem(key) ?? '';
}

function readJson<T>(key: string, fallback: T): T {
    if (typeof localStorage === 'undefined') return fallback;
    try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback; }
    catch { return fallback; }
}

function createAuthStore() {
    let token       = $state(read('employee_token'));
    let nombre      = $state(read('employee_nombre'));
    let roleSlug    = $state(read('employee_role_slug'));
    let roleName    = $state(read('employee_role'));
    let permissions = $state<string[]>(readJson('employee_permissions', []));
    let employeeId  = $state(read('employee_id'));

    function load() {
        token       = read('employee_token');
        nombre      = read('employee_nombre');
        roleSlug    = read('employee_role_slug');
        roleName    = read('employee_role');
        permissions = readJson<string[]>('employee_permissions', []);
        employeeId  = read('employee_id');
    }

    function save(data: {
        token: string;
        nombre: string;
        roleSlug: string;
        roleName: string;
        permissions: string[];
        employeeId: string | number;
    }) {
        localStorage.setItem('employee_token',      data.token);
        localStorage.setItem('employee_nombre',     data.nombre);
        localStorage.setItem('employee_role_slug',  data.roleSlug);
        localStorage.setItem('employee_role',       data.roleName);
        localStorage.setItem('employee_permissions', JSON.stringify(data.permissions));
        localStorage.setItem('employee_id',         String(data.employeeId));
        load();
    }

    function clear() {
        localStorage.removeItem('employee_token');
        localStorage.removeItem('employee_nombre');
        localStorage.removeItem('employee_role_slug');
        localStorage.removeItem('employee_role');
        localStorage.removeItem('employee_permissions');
        localStorage.removeItem('employee_id');
        load();
    }

    /**
     * Returns true if the current employee can perform `action` on `module`.
     * Slug checked: `${module}.${action}` — e.g. can('usuarios', 'crear')
     *
     * Bypasses:
     *   - super_admin role → always allowed
     *   - acceso_total permission → always allowed
     */
    function can(module: string, action: string): boolean {
        if (!token) return false;
        if (roleSlug === 'super_admin') return true;
        if (permissions.includes('acceso_total')) return true;
        return permissions.includes(`${module}.${action}`);
    }

    const isAuthenticated = $derived(!!token);
    const isSuperAdmin    = $derived(roleSlug === 'super_admin');

    return {
        get token()           { return token; },
        get nombre()          { return nombre; },
        get roleSlug()        { return roleSlug; },
        get roleName()        { return roleName; },
        get permissions()     { return permissions; },
        get employeeId()      { return employeeId; },
        get isAuthenticated() { return isAuthenticated; },
        get isSuperAdmin()    { return isSuperAdmin; },
        can,
        save,
        clear,
        load,
    };
}

export const auth = createAuthStore();
