/**
 * Geolocalización del navegador.
 *
 * Envuelve la API por dos motivos: devuelve una promesa en vez de callbacks, y
 * traduce sus códigos de error a algo que el operador pueda accionar. «Error 1»
 * no le dice a nadie que tiene que abrir el candado de la barra de direcciones.
 */

export type PosicionActual = {
	latitude: number;
	longitude: number;
	/** Radio de incertidumbre en metros, según el navegador. */
	accuracy: number;
};

/** Por encima de esto la posición viene de la IP o del wifi, no de un GPS. */
export const PRECISION_POBRE_M = 1000;

export class ErrorUbicacion extends Error {
	constructor(
		message: string,
		readonly codigo: 'no_soportado' | 'inseguro' | 'permiso' | 'no_disponible' | 'timeout'
	) {
		super(message);
		this.name = 'ErrorUbicacion';
	}
}

export function ubicacionActual(): Promise<PosicionActual> {
	return new Promise((resolver, rechazar) => {
		if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
			rechazar(new ErrorUbicacion('Este navegador no ofrece geolocalización.', 'no_soportado'));
			return;
		}

		// Los navegadores solo dan la posición en contextos seguros. Sin esta
		// comprobación la llamada falla con un PERMISSION_DENIED indistinguible
		// del que produce el usuario al negar el permiso, y se acaba buscando el
		// problema en el sitio equivocado.
		if (!window.isSecureContext) {
			rechazar(
				new ErrorUbicacion(
					'La geolocalización solo funciona sobre HTTPS (o en localhost).',
					'inseguro'
				)
			);
			return;
		}

		navigator.geolocation.getCurrentPosition(
			(pos) =>
				resolver({
					latitude: pos.coords.latitude,
					longitude: pos.coords.longitude,
					accuracy: pos.coords.accuracy
				}),
			(err) => {
				switch (err.code) {
					case err.PERMISSION_DENIED:
						rechazar(new ErrorUbicacion('Permiso de ubicación denegado.', 'permiso'));
						break;
					case err.POSITION_UNAVAILABLE:
						rechazar(
							new ErrorUbicacion('El dispositivo no pudo determinar dónde está.', 'no_disponible')
						);
						break;
					default:
						rechazar(new ErrorUbicacion('La ubicación tardó demasiado.', 'timeout'));
				}
			},
			// `enableHighAccuracy` pide el GPS del equipo; sin él un portátil
			// devuelve la posición del proveedor de internet, que puede estar a
			// kilómetros. El margen de 15 s es para que dé tiempo a fijar satélites.
			{ enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 }
		);
	});
}

/** Mensaje con causa y salida, no solo con el fallo. */
export function mensajeErrorUbicacion(e: unknown): string {
	if (!(e instanceof ErrorUbicacion)) {
		return 'No se pudo obtener la ubicación. Puedes marcarla en el mapa a mano.';
	}

	switch (e.codigo) {
		case 'permiso':
			return 'Permiso de ubicación denegado. Actívalo en el candado de la barra de direcciones, o marca el punto en el mapa.';
		case 'inseguro':
			return 'La geolocalización solo funciona sobre HTTPS. Marca el punto en el mapa.';
		case 'no_soportado':
			return 'Este navegador no ofrece geolocalización. Marca el punto en el mapa.';
		case 'no_disponible':
			return 'El equipo no pudo determinar dónde está. Suele pasar sin GPS ni wifi cerca; marca el punto en el mapa.';
		case 'timeout':
			return 'La ubicación tardó demasiado. Vuelve a intentarlo o marca el punto en el mapa.';
	}
}
