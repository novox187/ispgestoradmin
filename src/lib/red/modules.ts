import type { Component } from 'svelte';
import {
	Activity,
	ArrowLeftRight,
	Cpu,
	LayoutDashboard,
	Map,
	Radar,
	Router,
	Shield
} from '@lucide/svelte';

/**
 * Catálogo único de la sección Red.
 *
 * Antes había dos secciones de primer nivel —`/red` y `/mikrotik`— con dos
 * layouts, dos sub-sidebars y dos pantallas de «Dispositivos» sobre la *misma*
 * tabla `network_devices`. La separación describía la arquitectura del backend
 * (`MikrotikRouter extends NetworkDevice`), no el trabajo del operador: para
 * dar de alta un equipo había que adivinar de qué fabricante era antes de
 * elegir el menú, y las dos pantallas se enlazaban entre sí para devolverse el
 * trabajo.
 *
 * Aquí la distinción sobrevive donde sí importa —qué módulos valen para todo el
 * parque y cuáles solo para RouterOS— pero como **grupos dentro de una sección**
 * en lugar de dos destinos que compiten en el menú principal.
 */
export type NetworkModuleId =
	| 'overview'
	| 'devices'
	| 'monitoring'
	| 'map'
	| 'firewall'
	| 'sync'
	| 'discovery'
	| 'agents';

/** Bloques del sub-sidebar, en orden de aparición. */
export type NetworkModuleGroup = 'parque' | 'routeros' | 'aprovisionamiento';

export const NETWORK_GROUPS: { id: NetworkModuleGroup; label: string; hint: string }[] = [
	{ id: 'parque', label: 'Parque', hint: 'Todos los fabricantes' },
	{ id: 'routeros', label: 'RouterOS', hint: 'Solo MikroTik' },
	{ id: 'aprovisionamiento', label: 'Aprovisionamiento', hint: 'Altas y agentes' }
];

export type NetworkModule = {
	id: NetworkModuleId;
	label: string;
	/** Se muestra en la tarjeta del resumen y como bajada del encabezado. */
	description: string;
	href: string;
	icon: Component<any>;
	group: NetworkModuleGroup;
	status?: 'ready' | 'prototype' | 'coming_soon';
	/**
	 * Módulos que no significan nada sin un router principal configurado. Se
	 * bloquean en el sidebar en lugar de dejar que la pantalla falle con un 423.
	 *
	 * Dispositivos y Agentes NO lo llevan a propósito: son justamente las
	 * pantallas donde se crea el primer router.
	 */
	requiresPrimaryRouter?: boolean;
};

export const NETWORK_MODULES: NetworkModule[] = [
	{
		id: 'overview',
		label: 'Resumen',
		description: 'Estado del parque por fabricante, por papel en la red y por conectividad.',
		href: '/red',
		icon: LayoutDashboard,
		group: 'parque',
		status: 'ready'
	},
	{
		id: 'devices',
		label: 'Dispositivos',
		description:
			'Inventario único de routers MikroTik y antenas Ubiquiti: alta, credenciales y router principal.',
		href: '/red/dispositivos',
		icon: Router,
		group: 'parque',
		status: 'ready'
	},
	{
		id: 'monitoring',
		label: 'Monitoreo',
		description:
			'Señal, CCQ y estado de cada enlace, con el detalle de por qué está así. Se refresca solo cada 30 segundos.',
		href: '/red/monitoreo',
		icon: Activity,
		group: 'parque',
		status: 'ready'
	},
	{
		id: 'map',
		label: 'Mapa',
		description: 'Sitios, equipos y enlaces sobre el terreno, coloreados por calidad.',
		href: '/red/mapa',
		icon: Map,
		group: 'parque',
		status: 'ready'
	},
	{
		id: 'firewall',
		label: 'Firewall',
		description: 'Filtros (input/output/forward) y reglas NAT del router principal.',
		href: '/red/firewall',
		icon: Shield,
		group: 'routeros',
		status: 'ready',
		requiresPrimaryRouter: true
	},
	{
		id: 'sync',
		label: 'Sincronización',
		description: 'Concilia colas y reglas de firewall entre la base de datos y el router.',
		href: '/red/sincronizacion',
		icon: ArrowLeftRight,
		group: 'routeros',
		status: 'ready',
		requiresPrimaryRouter: true
	},
	{
		id: 'discovery',
		label: 'Descubrimiento',
		description: 'Barre un rango de la red de gestión y ofrece dar de alta lo que encuentre.',
		href: '/red/descubrimiento',
		icon: Radar,
		group: 'aprovisionamiento',
		status: 'ready'
	},
	{
		id: 'agents',
		label: 'Agentes',
		description:
			'Demonios que detectan los routers conectados por cable y configuran la VPN en ambos extremos. Se conectan hacia la API por HTTPS: no hay que abrir puertos.',
		href: '/red/agentes',
		icon: Cpu,
		group: 'aprovisionamiento',
		status: 'ready'
	}
];

/** Módulo que corresponde a una ruta, para encabezados y estado activo. */
export function moduleForPath(path: string): NetworkModule | null {
	const exact = NETWORK_MODULES.find((m) => m.href === path);
	if (exact) return exact;
	return NETWORK_MODULES.find((m) => m.href !== '/red' && path.startsWith(m.href)) ?? null;
}
