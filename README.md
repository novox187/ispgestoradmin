# ISPgestor Admin (Frontend)

[![Status](https://img.shields.io/badge/status-en%20desarrollo-yellow)](#)
[![SvelteKit](https://img.shields.io/badge/SvelteKit-2-ff3e00?logo=svelte&logoColor=white)](https://kit.svelte.dev/)
[![Svelte](https://img.shields.io/badge/Svelte-5-ff3e00?logo=svelte&logoColor=white)](https://svelte.dev/)
[![Vite](https://img.shields.io/badge/Vite-%5E7-646cff?logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4-06b6d4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

Panel administrativo (SvelteKit) del sistema ISPgestor. Provee UI para operar el backend (`ispgestorserver`) y administrar entidades como clientes, planes, proveedores, facturas, usuarios y estado de MikroTik.

## Índice

- [Descripción](#descripción)
- [Stack](#stack)
- [Requisitos previos](#requisitos-previos)
- [Instalación](#instalación)
- [Configuración](#configuración)
- [Comandos](#comandos)
- [Estructura de carpetas](#estructura-de-carpetas)
- [Ejemplos de uso](#ejemplos-de-uso)
- [Contribución](#contribución)
- [Solución de problemas](#solución-de-problemas)
- [Seguridad](#seguridad)

## Descripción

Este proyecto contiene el frontend de administración de ISPgestor. Se conecta al backend por HTTP (API) y gestiona autenticación mediante token almacenado en `localStorage`.

## Stack

- Framework: SvelteKit + Svelte 5
- Build tooling: Vite
- UI: TailwindCSS + Skeleton
- Tipado: TypeScript
- Calidad: ESLint + svelte-check
- Utilidades: `jspdf`/`jspdf-autotable` (PDFs), `@lucide/svelte` (iconos), `svelte-sonner` (toasts), `recharts` (gráficas)

## Requisitos previos

- Node.js 18+ (recomendado LTS)
- Gestor de paquetes: pnpm (recomendado, existe `pnpm-lock.yaml`), o npm/yarn
- Backend corriendo y accesible (por defecto `http://127.0.0.1:8000/api`)

## Instalación

1) Instalar dependencias:

```bash
pnpm install
```

2) Crear el archivo de entorno:

```bash
cp .env.example .env
```

En Windows (PowerShell):

```powershell
Copy-Item .env.example .env
```

3) Ajustar `PUBLIC_API_BASE` para apuntar al backend (ver [Configuración](#configuración)).

## Configuración

### Variables de entorno

SvelteKit expone variables públicas con el prefijo `PUBLIC_`. Este proyecto utiliza:

| Variable | Ejemplo | Requerida | Descripción |
|---|---:|:---:|---|
| `PUBLIC_API_BASE` | `http://127.0.0.1:8000/api` | Sí | URL base del backend API. Debe incluir `/api`. |

La app valida esta variable en tiempo de ejecución (si está vacía, falla con error). En desarrollo, si no se define, usa el fallback `http://localhost:8000/api`.

### Autenticación (token)

- La app guarda el token de sesión en `localStorage` bajo la clave `employee_token`.
- Las llamadas autenticadas al backend deben enviarlo como:

```http
Authorization: Bearer <TOKEN>
```

Nota: si estás depurando requests, busca esta cabecera en la pestaña Network del navegador.

## Comandos

Usa el gestor de paquetes que prefieras (ejemplos con pnpm).

### Desarrollo

```bash
pnpm dev
```

### Build

```bash
pnpm build
```

Este proyecto usa `@sveltejs/adapter-node`, por lo que el artefacto de producción es un servidor Node generado en `build/`.

### Producción (Node)

```bash
pnpm build
node build
```

### Preview (Vite)

```bash
pnpm preview
```

### Checks y lint

```bash
pnpm check
pnpm lint
```

## Estructura de carpetas

```text
ispgestoradmin/
├─ src/
│  ├─ routes/                 # Rutas SvelteKit (+page.svelte, +server.ts)
│  ├─ lib/
│  │  ├─ components/          # Componentes UI (clientes, planes, proveedores, etc.)
│  │  ├─ stores/              # Estado global
│  │  ├─ utils/               # Utilidades (cache, cálculos, helpers)
│  │  └─ config.ts            # Resolución de API_BASE (env + fallbacks)
│  ├─ app.html                # Template base
│  └─ app.css                 # Estilos globales
├─ static/                    # Assets estáticos
├─ .env.example               # Plantilla de variables de entorno
├─ svelte.config.js           # Adapter/config SvelteKit
└─ vite.config.js             # Config Vite
```

## Ejemplos de uso

### Apuntar a un backend local

En `.env`:

```env
PUBLIC_API_BASE=http://127.0.0.1:8000/api
```

Luego:

```bash
pnpm dev
```

### Inyectar la API base en runtime (opcional)

El código contempla un fallback a `window.__API_BASE__` (útil en ciertos despliegues donde se inyecta configuración al vuelo).

Ejemplo conceptual (tu servidor debe inyectar esta variable antes de cargar la app):

```html
<script>
  window.__API_BASE__ = "https://mi-dominio.com/api";
</script>
```

## Contribución

- Mantén el estilo y estructura del proyecto (SvelteKit + componentes en `src/lib/components`).
- Antes de abrir un PR:
  - `pnpm check`
  - `pnpm lint`
- Si agregas una variable nueva:
  - Debe comenzar con `PUBLIC_` si se necesita en el navegador.
  - Actualiza `.env.example` y este README.

## Solución de problemas

| Problema | Causa probable | Solución |
|---|---|---|
| Error `PUBLIC_API_BASE no está configurada` | Falta `.env` o la variable está vacía | Crea `.env` desde `.env.example` y define `PUBLIC_API_BASE` |
| 401 en API | Token ausente/expirado o backend no autoriza | Verifica `employee_token` en `localStorage` y re-login |
| CORS bloquea requests | Backend sin CORS para el dominio/puerto del admin | Ajusta CORS del backend y confirma `PUBLIC_API_BASE` |
| La UI no carga datos | API base incorrecta (`/api` faltante) | Define `PUBLIC_API_BASE` con `/api` al final |
| `pnpm`/`node` incompatibles | Versión antigua de Node | Usa Node LTS (18+) y reinstala dependencias |

## Seguridad

- No expongas tokens ni los loguees en consola en entornos reales.
- No subas `.env` al repositorio.
- En producción, sirve el admin bajo HTTPS para proteger credenciales/tokens.
