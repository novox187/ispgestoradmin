/**
 * Configuración centralizada de identidad de marca — Iron Link
 *
 * Todos los componentes, vistas y servicios deben consumir estos valores
 * en lugar de usar nombres hardcodeados. Para actualizar la marca en toda
 * la aplicación basta con modificar este archivo.
 *
 * Uso:
 *   import { BRAND } from '$lib/brand';
 *   <title>{BRAND.pageTitle('Dashboard')}</title>
 *   doc.text(BRAND.nameUpper, 14, 22);
 */

export const BRAND = {
  /** Nombre comercial completo */
  name: 'Iron Link',

  /** Nombre en mayúsculas para encabezados y badges */
  nameUpper: 'IRON LINK',

  /** Siglas para avatares o espacios reducidos */
  shortName: 'IL',

  /** Slogan de la empresa */
  slogan: 'Conectando el futuro',

  /** Descripción breve para el sub-encabezado del menú */
  tagline: 'ISP administracion y automatizacion',

  /** Descripción larga para meta tags */
  description: 'Iron Link — Plataforma de gestión integral para proveedores de internet.',

  /** Información de contacto de la empresa */
  contact: {
    email: 'contacto@ironlink.com',
    address: 'Av. Principal 123',
    nit: '123456789-0',
    website: 'ironlink.com',
    phone: '+1 800 000 0000',
  },

  /**
   * Texto alternativo para los logos (accesibilidad).
   * Usar en todos los atributos alt de <img> con logos.
   */
  logoAlt: 'Iron Link',

  /**
   * Rutas de logos dentro de src/lib/assets/logos/.
   * Para usar en componentes Svelte:
   *   import logoDefault from '$lib/assets/logos/logopng.png';
   *
   * Esta propiedad documenta los archivos disponibles y su propósito:
   *   primary      → logoprimario.png  (logo principal, ideal para login/splash)
   *   default      → logopng.png       (logo estándar sobre fondo oscuro)
   *   withBackground → logofondopng.png (logo con fondo integrado)
   *   metallic     → metalico.png      (variante metálica/premium)
   *   svg          → logosvg.svg       (vector escalable, ideal para navbar)
   *   favicon      → favicon.ico       (favicon estándar 32×32)
   *   faviconFondo → faviconfondo.ico  (favicon con fondo, usado en <link rel="icon">)
   */
  logos: {
    primary:        '/src/lib/assets/logos/logoprimario.png',
    default:        '/src/lib/assets/logos/logopng.png',
    withBackground: '/src/lib/assets/logos/logofondopng.png',
    metallic:       '/src/lib/assets/logos/metalico.png',
    svg:            '/src/lib/assets/logos/logosvg.svg',
    favicon:        '/src/lib/assets/favicon.ico',
    faviconFondo:   '/src/lib/assets/faviconfondo.ico',
  },

  /**
   * Genera el título de página con el formato estándar.
   * @param section - Nombre de la sección/módulo activo
   * @returns Título completo para <title> y <svelte:head>
   *
   * Ejemplo:
   *   BRAND.pageTitle('Dashboard') → 'Dashboard | Iron Link'
   *   BRAND.pageTitle()            → 'Iron Link'
   */
  pageTitle: (section?: string): string =>
    section ? `${section} | Iron Link` : 'Iron Link',

} as const;

export type BrandConfig = typeof BRAND;
