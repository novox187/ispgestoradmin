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

  /** Razón social — usada en estructuras Schema.org de organización */
  legalName: 'Iron Link — Plataforma de gestión ISP',

  /** Slogan de la empresa */
  slogan: 'Conectando el futuro',

  /** Descripción breve para el sub-encabezado del menú */
  tagline: 'ISP administracion y automatizacion',

  /** Descripción larga para meta tags */
  description: 'Iron Link — Plataforma de gestión integral para proveedores de internet.',

  /**
   * Descripción optimizada para SEO. Pensada para aparecer en SERPs:
   * 150-160 caracteres con propuesta de valor, alcance funcional y CTA implícito.
   */
  seoDescription:
    'Iron Link es la plataforma profesional para proveedores de internet (ISP): gestión de clientes, facturación, control MikroTik, soporte y monitoreo en tiempo real.',

  /**
   * Descripción corta y persuasiva para Open Graph y redes sociales.
   * Optimizada para impacto visual y conversión cuando se comparte el link.
   */
  socialDescription:
    'Plataforma todo-en-uno para ISPs: clientes, facturación SRI, MikroTik, soporte en tiempo real y monitoreo de red.',

  /**
   * Palabras clave estratégicas — usadas en <meta name="keywords">.
   * Aunque Google ya no las usa para ranking, otros motores (Bing, Yandex) y
   * agregadores corporativos sí las consultan. Sirven también como referencia
   * interna del posicionamiento objetivo.
   */
  keywords: [
    'gestión ISP',
    'software para proveedores de internet',
    'plataforma ISP',
    'administración ISP',
    'facturación SRI',
    'MikroTik administración',
    'control de routers MikroTik',
    'monitoreo de red en tiempo real',
    'gestión de clientes ISP',
    'CRM ISP',
    'cobranza ISP',
    'soporte técnico ISP',
    'WISP software',
    'Iron Link',
  ],

  /** Dominio canónico oficial (sin protocolo) — usado en og:url, canonical y JSON-LD. */
  domain: 'admin.ironlink.uk',

  /** URL canónica completa con protocolo — fuente única para enlaces absolutos. */
  canonicalUrl: 'https://admin.ironlink.uk',

  /** Locale principal en formato BCP 47 — para og:locale y lang. */
  locale: 'es_EC',

  /** Idioma del documento (atributo lang). */
  lang: 'es',

  /** Categoría/sector de la aplicación — usado en og:type secundario y Schema.org. */
  category: 'BusinessApplication',

  /** Color principal de la marca (hex) — usado en theme-color y manifest. */
  primaryColor: '#0f0f0f',

  /** Color de acento — para tile color en Windows, splash en iOS, etc. */
  accentColor: '#3b82f6',

  /** Información de contacto de la empresa */
  contact: {
    email: 'novoxdeveloper@gmail.com',
    address: 'Av. Principal 123',
    ruc: '1790000000001',
    website: 'ironlink.uk',
    phone: '+7 995 241 46 35',
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
   *   favicon      → faviconv2.ico       (favicon estándar 32×32)
   *   faviconFondo → faviconfondo.ico  (favicon con fondo, usado en <link rel="icon">)
   */
  logos: {
    primary:        '/src/lib/assets/logos/logoprimario.png',
    default:        '/src/lib/assets/logos/logopng.png',
    withBackground: '/src/lib/assets/logos/logofondopng.png',
    metallic:       '/src/lib/assets/logos/metalico.png',
    svg:            '/src/lib/assets/logos/logosvg.svg',
    favicon:        '/src/lib/assets/faviconv2.ico',
    faviconFondo:   '/src/lib/assets/faviconfondo.ico',
  },

  /**
   * Imagen Open Graph absoluta — la que se muestra al compartir el sitio en
   * redes sociales. Debe ser PNG/JPG de 1200×630 alojado en `static/` con ruta
   * pública estable. Si el archivo cambia, actualizar aquí.
   */
  ogImage: 'https://admin.ironlink.uk/og-image.PNG',

  /**
   * Handle de Twitter/X de la marca (incluyendo `@`). Si la empresa aún no
   * tiene cuenta, deja la cadena vacía y la meta se omite automáticamente.
   */
  twitterHandle: '@ironlink',

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
    section ? `${section} | Iron Link` : 'Iron Link — Plataforma de gestión ISP',

  /**
   * Genera la descripción contextual de cada sección.
   * Si la sección no está mapeada, devuelve la descripción SEO global.
   *
   * @param section - Slug en minúsculas de la sección (ej. 'clientes')
   * @returns Descripción optimizada para meta description
   */
  pageDescription: (section?: string): string => {
    const map: Record<string, string> = {
      dashboard:
        'Panel de control Iron Link: KPIs en tiempo real, ingresos, clientes activos, estado del router MikroTik y capacidad de red.',
      clientes:
        'Gestión completa de clientes ISP en Iron Link: alta, suspensión, reactivación, billetera y control de servicio sobre MikroTik.',
      facturas:
        'Emisión y control de facturas electrónicas adaptadas al SRI Ecuador. Cobranza, vencimientos y descarga PDF desde Iron Link.',
      planes:
        'Administración de planes de servicio ISP en Iron Link: velocidad, precio, ciclo de facturación y sincronización con MikroTik.',
      usuarios:
        'Gestión de empleados, roles y permisos del panel administrativo Iron Link con control de acceso granular por módulo.',
      proveedores:
        'Administración de proveedores de internet (uplinks) y conexiones mayoristas desde el panel Iron Link.',
      mikrotik:
        'Control y monitoreo de routers MikroTik desde Iron Link: colas, firewall, dispositivos, sincronización y monitoreo en vivo.',
      configuraciones:
        'Configuración global de Iron Link: parámetros de facturación SRI, importación de clientes y opciones del sistema.',
      perfil:
        'Configuración de perfil personal del empleado en Iron Link: datos, preferencias y sesión activa.',
      login:
        'Acceso seguro al panel administrativo Iron Link — gestión ISP profesional con MikroTik, facturación y soporte.',
    };
    if (!section) return BRAND.seoDescription;
    return map[section.toLowerCase()] ?? BRAND.seoDescription;
  },

} as const;

export type BrandConfig = typeof BRAND;
