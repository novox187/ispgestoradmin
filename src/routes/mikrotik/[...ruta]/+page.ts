import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

/**
 * Compatibilidad con los enlaces de la sección `/mikrotik`, que se fundió en
 * `/red`. Existe para no romper marcadores ni enlaces guardados en tickets;
 * puede retirarse cuando dejen de verse accesos en los registros.
 */
const DESTINOS: Record<string, string> = {
	'': '/red',
	dispositivos: '/red/dispositivos',
	firewall: '/red/firewall',
	sincronizacion: '/red/sincronizacion',
	// Las colas nunca tuvieron pantalla propia: ya redirigían a sincronización.
	colas: '/red/sincronizacion',
	monitoreo: '/red/monitoreo',
	agentes: '/red/agentes'
};

export const load: PageLoad = ({ params }) => {
	const ruta = params.ruta ?? '';
	redirect(308, DESTINOS[ruta] ?? '/red');
};
