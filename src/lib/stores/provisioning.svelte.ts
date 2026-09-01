import {
	fetchProvisioningSessions,
	type ProvisioningSession
} from '$lib/api/provisioning';

/**
 * Altas de dispositivos en curso.
 *
 * Sondea en lugar de suscribirse por WebSocket porque es el patrón vigente en
 * todo el panel y porque no existe un canal de Reverb para routers; montarlo
 * solo para esto no compensa. El intervalo es corto (3 s, el mismo que usa la
 * pantalla de sincronización) porque al otro lado suele haber alguien con el
 * equipo delante esperando a ver avanzar los pasos.
 *
 * Cuando no hay ninguna sesión viva el sondeo se relaja: no tiene sentido
 * castigar la API cada 3 segundos mientras nadie está dando de alta nada.
 */

const ACTIVE_INTERVAL_MS = 3_000;
const IDLE_INTERVAL_MS = 15_000;

export class ProvisioningState {
	sessions = $state<ProvisioningSession[]>([]);
	loading = $state(false);
	lastError = $state<string | null>(null);

	#timer: ReturnType<typeof setTimeout> | null = null;
	#running = false;

	/** Sesiones que todavía están avanzando. */
	get active(): ProvisioningSession[] {
		return this.sessions.filter((s) => !s.is_terminal);
	}

	/** Sesiones detenidas esperando que un administrador las apruebe. */
	get awaitingApproval(): ProvisioningSession[] {
		return this.sessions.filter((s) => s.status === 'awaiting_approval');
	}

	/** Altas recientes que no prosperaron y merecen una mirada. */
	get recentFailures(): ProvisioningSession[] {
		return this.sessions.filter((s) => s.status === 'failed' || s.status === 'rolled_back');
	}

	async refresh(): Promise<void> {
		if (typeof window === 'undefined') return;
		if (!localStorage.getItem('employee_token')) return;

		this.loading = true;
		try {
			this.sessions = await fetchProvisioningSessions({ perPage: 20 });
			this.lastError = null;
		} catch (e: any) {
			this.lastError = e?.message ?? 'No se pudieron cargar las altas de dispositivos';
		} finally {
			this.loading = false;
		}
	}

	start(): void {
		if (this.#running) return;
		this.#running = true;
		void this.#tick();
	}

	stop(): void {
		this.#running = false;
		if (this.#timer !== null) {
			clearTimeout(this.#timer);
			this.#timer = null;
		}
	}

	async #tick(): Promise<void> {
		if (!this.#running) return;

		await this.refresh();

		if (!this.#running) return;

		// El siguiente sondeo se agenda al terminar el anterior y no con un
		// intervalo fijo: si la API va lenta, un setInterval acabaría solapando
		// peticiones y empeorándolo.
		const delay = this.active.length > 0 ? ACTIVE_INTERVAL_MS : IDLE_INTERVAL_MS;
		this.#timer = setTimeout(() => void this.#tick(), delay);
	}
}

export const provisioning = new ProvisioningState();
