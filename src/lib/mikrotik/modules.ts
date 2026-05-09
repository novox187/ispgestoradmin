import type { Component } from 'svelte';
import { ArrowLeftRight, Bell, LayoutDashboard, Shield, Smartphone } from '@lucide/svelte';

export type MikrotikModuleId = 'overview' | 'firewall' | 'sync' | 'monitoring' | 'devices';

export type MikrotikModule = {
	id: MikrotikModuleId;
	label: string;
	description: string;
	href: string;
	icon: Component<any>;
	status?: 'ready' | 'prototype' | 'coming_soon';
};

export const MIKROTIK_MODULES: MikrotikModule[] = [
	{
		id: 'overview',
		label: 'Resumen',
		description: 'Accesos rápidos y estado general del módulo MikroTik.',
		href: '/mikrotik',
		icon: LayoutDashboard,
		status: 'ready'
	},
	{
		id: 'firewall',
		label: 'Firewall',
		description: 'Gestión de filtros (input/output/forward) y reglas NAT.',
		href: '/mikrotik/firewall',
		icon: Shield,
		status: 'ready'
	},
	{
		id: 'sync',
		label: 'Sincronización',
		description: 'Sincroniza colas y reglas de firewall entre la BD y el router MikroTik.',
		href: '/mikrotik/sincronizacion',
		icon: ArrowLeftRight,
		status: 'ready'
	},
	{
		id: 'monitoring',
		label: 'Monitoreo',
		description: 'Indicadores y estado operativo del router y del servicio.',
		href: '/mikrotik/monitoreo',
		icon: Bell,
		status: 'coming_soon'
	},
	{
		id: 'devices',
		label: 'Dispositivos',
		description: 'Gestión de equipos, credenciales y perfiles por router.',
		href: '/mikrotik/dispositivos',
		icon: Smartphone,
		status: 'coming_soon'
	}
];
