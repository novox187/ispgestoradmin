import { describe, expect, it } from 'vitest';
import { ErrorUbicacion, mensajeErrorUbicacion } from './geolocalizacion';

/**
 * Lo que se comprueba no es que exista un mensaje, sino que cada fallo diga la
 * causa Y una salida. Un «no se pudo obtener la ubicación» a secas deja al
 * operador sin saber si tiene que tocar el navegador, moverse o teclearlo.
 */
describe('mensajeErrorUbicacion', () => {
	const casos = [
		['permiso', 'candado'],
		['inseguro', 'HTTPS'],
		['no_soportado', 'navegador'],
		['no_disponible', 'GPS'],
		['timeout', 'intentarlo']
	] as const;

	it.each(casos)('el error «%s» explica la causa', (codigo, fragmento) => {
		const mensaje = mensajeErrorUbicacion(new ErrorUbicacion('x', codigo));
		expect(mensaje).toContain(fragmento);
	});

	it.each(casos)('el error «%s» ofrece una salida', (codigo) => {
		const mensaje = mensajeErrorUbicacion(new ErrorUbicacion('x', codigo));
		// Todas las vías muertas tienen la misma alternativa: marcarlo a mano.
		expect(mensaje.toLowerCase()).toContain('mapa');
	});

	it('un fallo desconocido tampoco deja al operador sin salida', () => {
		expect(mensajeErrorUbicacion(new Error('boom')).toLowerCase()).toContain('mapa');
		expect(mensajeErrorUbicacion(null).toLowerCase()).toContain('mapa');
	});
});
