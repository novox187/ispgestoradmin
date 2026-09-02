import type { Component } from 'svelte';
import { Activity, LayoutDashboard, Map, Radar, Radio } from '@lucide/svelte';

/**
 * Módulos de la sección Red.
 *
 * Sección aparte de `/mikrotik` y no un reemplazo: aquella gobierna el plano de
 * control de MikroTik —firewall, colas, router primary— y esta el parque
 * entero, que desde que hay antenas Ubiquiti es lo que necesitan el inventario,
 * el monitoreo y el mapa. Fusionarlas obligaría a decidir hoy qué pasa con las
 * pantallas específicas de RouterOS, y eso puede esperar a que la sección nueva
 * esté rodada.
 */
export type NetworkModuleId = 'overview' | 'devices' | 'discovery' | 'monitoring' | 'map';

export type NetworkModule = {
	id: NetworkModuleId;
	label: string;
	description: string;
	href: string;
	icon: Component<any>;
	status?: 'ready' | 'prototype' | 'coming_soon';
};

export const NETWORK_MODULES: NetworkModule[] = [
	{
		id: 'overview',
		label: 'Resumen',
		description: 'Estado general del parque de equipos, por fabricante y por papel en la red.',
		href: '/red',
		icon: LayoutDashboard,
		status: 'ready'
	},
	{
		id: 'devices',
		label: 'Dispositivos',
		description:
			'Inventario de routers y antenas. Alta manual de antenas por IP y asignación al agente que las sondea.',
		href: '/red/dispositivos',
		icon: Radio,
		status: 'ready'
	},
	{
		id: 'discovery',
		label: 'Descubrimiento',
		description:
			'Barre un rango de la red de gestión y ofrece dar de alta los equipos que encuentre.',
		href: '/red/descubrimiento',
		icon: Radar,
		status: 'ready'
	},
	{
		id: 'monitoring',
		label: 'Monitoreo',
		description: 'Señal, CCQ y estado de cada enlace, con el detalle de por qué está así.',
		href: '/red/monitoreo',
		icon: Activity,
		status: 'ready'
	},
	{
		id: 'map',
		label: 'Mapa',
		description: 'Sitios, equipos y enlaces sobre el terreno, coloreados por calidad.',
		href: '/red/mapa',
		icon: Map,
		status: 'ready'
	}
];
