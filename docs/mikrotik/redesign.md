# Rediseño del módulo MikroTik (Frontend)

## 1) Diseño actual (antes del rediseño)

### Qué existe hoy
- La ruta `/mikrotik` ofrece una única acción operacional: “Sincronizar MikroTik con planes y clientes”, encapsulada por `MikroTikActionCard`.
- No existe navegación interna del dominio MikroTik (todas las futuras herramientas tendrían que agregarse como bloques en una sola página).
- No hay un “estado” del módulo (qué router está activo, cuándo se aplicó la última configuración, qué hay pendiente).

### Limitaciones y problemas de usabilidad
- Escalabilidad pobre: una sola página con acciones se vuelve rápidamente un “panel infinito” y difícil de descubrir.
- Falta de IA (arquitectura de información): no hay separación clara por áreas (Firewall, Colas, Monitoreo, Dispositivos).
- Falta de contexto operativo: el usuario ejecuta acciones sin ver claramente el estado y el impacto (resumen, pendiente/aplicado, auditoría).
- Validaciones acopladas a acciones: la validación existe solo para la acción de sincronización (y no como patrón de módulo).
- Accesibilidad limitada por falta de estructura consistente: no hay sub-navegación semántica por sección, ni consistencia de “título + descripción + panel”.

## 2) Objetivos del rediseño
- Proveer navegación clara y extensible para múltiples funcionalidades MikroTik.
- Introducir una opción nueva: configuración de Firewall (filtros input/output/forward y NAT) con validaciones en tiempo real.
- Mantener consistencia visual con el resto del admin (tema oscuro, tipografía, spacing y componentes existentes).
- Diseñar para backend futuro: tipos, payloads y estructura de UI que se pueda conectar a endpoints sin rehacer el layout.

## 3) Nueva arquitectura modular (IA + estructura de rutas)

### Registro de módulos (extensible)
- Se centraliza un listado de módulos en `src/lib/mikrotik/modules.ts`.
- Agregar una futura sección (p.ej. “VPN”, “IP Pools”, “DHCP”) requiere:
  - Añadir una entrada en `MIKROTIK_MODULES` (id, label, href, icon, description).
  - Crear una ruta `src/routes/mikrotik/<modulo>/+page.svelte`.
  - No requiere cambios estructurales del layout ni del menú global.

### Layout de módulo (compartido)
- `src/routes/mikrotik/+layout.svelte` provee:
  - Encabezado estándar de la app.
  - Contenedor responsivo.
  - Navegación interna (desktop sidebar + selector mobile).
  - Área de contenido para subrutas.

### Rutas
- `/mikrotik` (Resumen): accesos rápidos y guía de uso.
- `/mikrotik/colas`: operación existente de sincronización.
- `/mikrotik/firewall`: prototipo funcional de configuración de firewall.
- `/mikrotik/monitoreo`: placeholder listo para métricas.
- `/mikrotik/dispositivos`: placeholder listo para gestión multi-router.

## 4) Nuevo layout y navegación

### Navegación interna
- Desktop: menú lateral dentro del módulo (no reemplaza el sidebar global).
- Mobile: selector `select` para saltar de sección sin problemas de espacio.

### Consistencia visual
- Se respeta el estilo actual del admin:
  - Fondo y bordes oscuros (neutral + azul como acento).
  - Componentes con `rounded-xl`, `border-neutral-800`, `bg-neutral-900/30`.
  - Íconos `lucide`.

## 5) Firewall (prototipo interactivo + validaciones)

### Capacidades UI
- Filtros:
  - Cadenas: `input`, `output`, `forward`.
  - Campos: protocolo, IP/CIDR origen/destino, interfaces in/out, puertos, comentario, flags (enabled/log).
- NAT:
  - Cadenas: `srcnat`, `dstnat`.
  - Acciones: `masquerade`, `src-nat`, `dst-nat`, `redirect`.
  - Campos: IP/CIDR, interfaz, puertos y `to-addresses/to-ports` (según acción).
- Estado:
  - Totales y habilitadas por tipo.
  - Timestamps “cargado” y “última aplicación” (simulado).
- Exportación:
  - “Exportar JSON” copia el snapshot al portapapeles para facilitar el backend.

### Validaciones en tiempo real
- IP/CIDR IPv4 (máscara 0-32).
- Puertos: número o rango (1-65535, rango ascendente).
- Reglas de consistencia:
  - Puertos solo cuando el protocolo es TCP/UDP.
  - Advertencias de interfaz según cadena (p.ej. output no usa in-interface).
- Feedback visual:
  - Errores inline con `role="alert"`.
  - `aria-invalid` en inputs.
  - Botón de submit deshabilitado cuando hay errores.

### Persistencia del prototipo
- El borrador del firewall se guarda en `localStorage` para simular un “estado actual”.
- En integración backend, este almacenamiento se reemplaza por:
  - `GET` snapshot del router activo.
  - “Aplicar cambios” que envía un batch y actualiza `appliedAt`.

## 6) Accesibilidad (WCAG 2.1) aplicada
- Etiquetas `<label for=...>` en todos los campos.
- Estados de error accesibles (`role="alert"`, `aria-invalid`).
- Navegación por teclado:
  - Botones y links con focus visible (`focus:ring`).
  - Estructura semántica `nav` y jerarquía de encabezados.
- Contraste: uso de colores con suficiente contraste sobre fondo oscuro.

## 7) Puntos pendientes para backend
- Selección de router activo (multi-router) y permisos por rol.
- Lectura del estado real de firewall desde RouterOS y aplicación transaccional (con auditoría).
- Historial de cambios (audits), con “razón del cambio” y rollback.

