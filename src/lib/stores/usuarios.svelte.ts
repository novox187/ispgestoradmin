import { API_BASE } from '$lib/config';

export type Employee = {
    id: number;
    name: string;
    email: string;
    phone: string | null;
    role: string | null;
    role_id: number | null;
    status: 'active' | 'inactive';
    created_at: string | null;
    deleted_at: string | null;
};

export type RoleOption = {
    id: number;
    nombre: string;
    slug: string;
    descripcion?: string | null;
    employees_count?: number;
    permissions?: Permission[];
};

export type Permission = {
    id: number;
    nombre: string;
    slug: string;
    descripcion?: string | null;
};

export type PaginationMeta = {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
};

export type EmployeeFilters = {
    search: string;
    status: '' | 'active' | 'inactive';
    role_id: string;
    date_from: string;
    date_to: string;
    trashed: '' | 'only' | 'with';
    sort_by: 'nombre' | 'email' | 'created_at' | 'status';
    sort_dir: 'asc' | 'desc';
    per_page: number;
    page: number;
};

function getToken(): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem('employee_token');
}

function authHeaders(): Record<string, string> {
    const token = getToken();
    return {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
}

function createEmployeeStore() {
    let employees = $state<Employee[]>([]);
    let meta = $state<PaginationMeta>({ current_page: 1, last_page: 1, per_page: 15, total: 0, from: null, to: null });
    let loading = $state(false);
    let error = $state<string | null>(null);

    let roles = $state<RoleOption[]>([]);
    let rolesLoading = $state(false);

    let filters = $state<EmployeeFilters>({
        search: '',
        status: '',
        role_id: '',
        date_from: '',
        date_to: '',
        trashed: '',
        sort_by: 'created_at',
        sort_dir: 'desc',
        per_page: 15,
        page: 1,
    });

    async function fetchEmployees() {
        loading = true;
        error = null;
        try {
            const params = new URLSearchParams();
            if (filters.search)    params.set('search', filters.search);
            if (filters.status)    params.set('status', filters.status);
            if (filters.role_id)   params.set('role_id', filters.role_id);
            if (filters.date_from) params.set('date_from', filters.date_from);
            if (filters.date_to)   params.set('date_to', filters.date_to);
            if (filters.trashed)   params.set('trashed', filters.trashed);
            params.set('sort_by', filters.sort_by);
            params.set('sort_dir', filters.sort_dir);
            params.set('per_page', String(filters.per_page));
            params.set('page', String(filters.page));

            const res = await fetch(`${API_BASE}/admin/employees?${params}`, { headers: authHeaders() });
            if (!res.ok) throw new Error('Error al cargar empleados');
            const json = await res.json();
            employees = json.data ?? [];
            meta = json.meta ?? meta;
        } catch (e: any) {
            error = e.message ?? 'Error desconocido';
        } finally {
            loading = false;
        }
    }

    async function fetchRoles() {
        rolesLoading = true;
        try {
            const res = await fetch(`${API_BASE}/admin/roles`, { headers: authHeaders() });
            if (res.ok) {
                const json = await res.json();
                roles = json.data ?? [];
            }
        } finally {
            rolesLoading = false;
        }
    }

    async function deleteEmployee(id: number): Promise<void> {
        const res = await fetch(`${API_BASE}/admin/employees/${id}`, {
            method: 'DELETE',
            headers: authHeaders(),
        });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.message ?? 'Error al eliminar');
        }
        await fetchEmployees();
    }

    async function restoreEmployee(id: number): Promise<void> {
        const res = await fetch(`${API_BASE}/admin/employees/${id}/restore`, {
            method: 'POST',
            headers: authHeaders(),
        });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.message ?? 'Error al restaurar');
        }
        await fetchEmployees();
    }

    async function toggleStatus(id: number): Promise<void> {
        const res = await fetch(`${API_BASE}/admin/employees/${id}/toggle-status`, {
            method: 'PATCH',
            headers: authHeaders(),
        });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.message ?? 'Error al cambiar estado');
        }
        await fetchEmployees();
    }

    function setFilter<K extends keyof EmployeeFilters>(key: K, value: EmployeeFilters[K]) {
        filters[key] = value;
        if (key !== 'page') filters.page = 1;
    }

    function setSort(column: EmployeeFilters['sort_by']) {
        if (filters.sort_by === column) {
            filters.sort_dir = filters.sort_dir === 'asc' ? 'desc' : 'asc';
        } else {
            filters.sort_by = column;
            filters.sort_dir = 'asc';
        }
        filters.page = 1;
    }

    function resetFilters() {
        filters = {
            search: '',
            status: '',
            role_id: '',
            date_from: '',
            date_to: '',
            trashed: '',
            sort_by: 'created_at',
            sort_dir: 'desc',
            per_page: 15,
            page: 1,
        };
    }

    return {
        get employees() { return employees; },
        get meta() { return meta; },
        get loading() { return loading; },
        get error() { return error; },
        get roles() { return roles; },
        get rolesLoading() { return rolesLoading; },
        get filters() { return filters; },
        fetchEmployees,
        fetchRoles,
        deleteEmployee,
        restoreEmployee,
        toggleStatus,
        setFilter,
        setSort,
        resetFilters,
    };
}

export const usuariosStore = createEmployeeStore();
