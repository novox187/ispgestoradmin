export const DASHBOARD_LOAD_CONTEXT = Symbol('dashboard-load-context');

export type DashboardLoadStatus = 'idle' | 'loading' | 'success' | 'error';

export type DashboardLoadBus = {
	start: (key: string, endpoint: string) => void;
	success: (key: string) => void;
	error: (key: string, details: { endpoint: string; status?: number; message: string }) => void;
};

export type CookieCacheEnvelope<T> = {
	v: 1;
	storedAt: number;
	data: T;
};

function safeDecode(value: string) {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

function safeEncode(value: string) {
	try {
		return encodeURIComponent(value);
	} catch {
		return value;
	}
}

export function readCookie(name: string): string | null {
	if (typeof document === 'undefined') return null;
	const needle = `${name}=`;
	const parts = document.cookie.split(';');
	for (const part of parts) {
		const trimmed = part.trim();
		if (trimmed.startsWith(needle)) return safeDecode(trimmed.slice(needle.length));
	}
	return null;
}

export function writeCookie(
	name: string,
	value: string,
	options: { maxAgeSeconds?: number; path?: string; sameSite?: 'Lax' | 'Strict' | 'None' } = {}
) {
	if (typeof document === 'undefined') return;
	const path = options.path ?? '/';
	const sameSite = options.sameSite ?? 'Lax';
	const maxAge = typeof options.maxAgeSeconds === 'number' ? `; Max-Age=${Math.max(0, Math.floor(options.maxAgeSeconds))}` : '';
	const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
	document.cookie = `${name}=${safeEncode(value)}; Path=${path}; SameSite=${sameSite}${maxAge}${secure}`;
}

export function readCookieCache<T>(name: string): CookieCacheEnvelope<T> | null {
	const raw = readCookie(name);
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw) as CookieCacheEnvelope<T>;
		if (!parsed || parsed.v !== 1 || typeof parsed.storedAt !== 'number') return null;
		return parsed;
	} catch {
		return null;
	}
}

export function writeCookieCache<T>(name: string, data: T, options: { maxAgeSeconds?: number } = {}) {
	const envelope: CookieCacheEnvelope<T> = { v: 1, storedAt: Date.now(), data };
	const maxAgeSeconds = options.maxAgeSeconds ?? 60 * 60 * 24;
	try {
		writeCookie(name, JSON.stringify(envelope), { maxAgeSeconds });
	} catch {
	}
	return envelope;
}

export type FetchErrorDetails = {
	timestamp: string;
	endpoint: string;
	status?: number;
	code?: string;
	message: string;
	response?: unknown;
	attempt: number;
	attempts: number;
};

function shouldRetryStatus(status?: number) {
	if (!status) return true;
	return status === 408 || status === 429 || (status >= 500 && status <= 599);
}

async function sleep(ms: number, signal?: AbortSignal) {
	if (ms <= 0) return;
	await new Promise<void>((resolve, reject) => {
		const id = setTimeout(() => resolve(), ms);
		if (!signal) return;
		if (signal.aborted) {
			clearTimeout(id);
			reject(new DOMException('Aborted', 'AbortError'));
			return;
		}
		signal.addEventListener(
			'abort',
			() => {
				clearTimeout(id);
				reject(new DOMException('Aborted', 'AbortError'));
			},
			{ once: true }
		);
	});
}

async function readResponseBody(res: Response) {
	const contentType = res.headers.get('content-type') || '';
	if (contentType.includes('application/json')) {
		return await res.json().catch(() => null);
	}
	return await res.text().catch(() => null);
}

function extractMessage(body: unknown): string | null {
	if (!body) return null;
	if (typeof body === 'string') return body.trim() || null;
	if (typeof body === 'object') {
		const anyBody = body as any;
		const msg = anyBody.message ?? anyBody.error ?? anyBody.detail;
		if (typeof msg === 'string' && msg.trim()) return msg.trim();
	}
	return null;
}

export async function fetchJsonWithRetry<T>(
	endpoint: string,
	init: RequestInit,
	options: {
		attempts?: number;
		baseDelayMs?: number;
		onRetry?: (details: FetchErrorDetails) => void;
	} = {}
): Promise<T> {
	const attempts = Math.max(1, Math.floor(options.attempts ?? 3));
	const baseDelayMs = Math.max(0, Math.floor(options.baseDelayMs ?? 600));
	let lastError: unknown;

	for (let attempt = 1; attempt <= attempts; attempt++) {
		try {
			const res = await fetch(endpoint, init);
			if (res.ok) {
				return (await res.json()) as T;
			}
			const body = await readResponseBody(res);
			const details: FetchErrorDetails = {
				timestamp: new Date().toISOString(),
				endpoint,
				status: res.status,
				code: String(res.status),
				message: extractMessage(body) ?? res.statusText ?? 'Error de petición',
				response: body ?? undefined,
				attempt,
				attempts
			};
			console.error('[RequestError]', details);

			if (attempt < attempts && shouldRetryStatus(res.status)) {
				options.onRetry?.(details);
				const delay = baseDelayMs * 2 ** (attempt - 1) + Math.floor(Math.random() * 200);
				await sleep(delay, init.signal ?? undefined);
				continue;
			}
			throw details;
		} catch (err: any) {
			lastError = err;
			const aborted = err?.name === 'AbortError';
			if (aborted) throw err;

			const details: FetchErrorDetails =
				err && typeof err === 'object' && 'endpoint' in err
					? (err as FetchErrorDetails)
					: {
							timestamp: new Date().toISOString(),
							endpoint,
							status: undefined,
							code: 'NETWORK_ERROR',
							message: typeof err?.message === 'string' ? err.message : 'Error de red',
							response: undefined,
							attempt,
							attempts
						};

			if (!(err && typeof err === 'object' && 'endpoint' in err)) {
				console.error('[RequestError]', details);
			}

			if (attempt < attempts) {
				options.onRetry?.(details);
				const delay = baseDelayMs * 2 ** (attempt - 1) + Math.floor(Math.random() * 200);
				await sleep(delay, init.signal ?? undefined);
				continue;
			}
			throw details;
		}
	}

	throw lastError instanceof Error ? lastError : new Error('Error de petición');
}
