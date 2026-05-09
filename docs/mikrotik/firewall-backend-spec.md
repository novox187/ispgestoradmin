# Firewall MikroTik – Especificación técnica (Backend futuro)

## Objetivo
Definir endpoints y payloads para que el frontend del módulo `/mikrotik/firewall` pueda:
- Leer el estado actual del firewall (filtros + NAT) del router activo.
- Crear/editar/eliminar reglas en modo “borrador”.
- Aplicar cambios al router con operación controlada (auditoría, validación y rollback).

## Alcance
- RouterOS: `/ip/firewall/filter` y `/ip/firewall/nat`.
- No incluye en esta fase: mangle, raw, address-lists, layer7, scheduler.

## Convenciones
- Auth: `Authorization: Bearer <employee_token>`.
- Respuesta estándar:
  - `200` con `{ data: ... }`
  - Errores con `{ message, code?, errors? }`
- Auditoría (recomendado):
  - Registrar: user_id/employee_id, router_id, operación, snapshot previo, snapshot aplicado, razón del cambio.

## Modelo de datos (frontend)

### FilterRule
```json
{
  "id": "uuid",
  "kind": "filter",
  "enabled": true,
  "priority": 1,
  "chain": "input|output|forward",
  "action": "accept|drop|reject",
  "protocol": "any|tcp|udp|icmp",
  "srcAddress": "192.168.88.0/24",
  "srcAddressList": "clientes_permitidos",
  "dstAddress": "10.0.0.0/8",
  "srcPort": "1024-65535",
  "dstPort": "80",
  "inInterface": "LAN",
  "outInterface": "WAN",
  "comment": "texto",
  "log": false,
  "createdAt": 1710000000000,
  "updatedAt": 1710000000000
}
```

### NatRule
```json
{
  "id": "uuid",
  "kind": "nat",
  "enabled": true,
  "priority": 1,
  "chain": "srcnat|dstnat",
  "action": "masquerade|src-nat|dst-nat|redirect",
  "protocol": "any|tcp|udp|icmp",
  "srcAddress": "192.168.88.0/24",
  "srcAddressList": "clientes_permitidos",
  "dstAddress": "10.0.0.10",
  "srcPort": "1024-65535",
  "dstPort": "80",
  "outInterface": "WAN",
  "toAddresses": "10.0.0.10",
  "toPorts": "8080",
  "comment": "texto",
  "log": false,
  "createdAt": 1710000000000,
  "updatedAt": 1710000000000
}
```

### FirewallSnapshot
```json
{
  "routerId": "router_1",
  "loadedAt": 1710000000000,
  "appliedAt": 1710000000000,
  "filters": [ /* FilterRule[] */ ],
  "nat": [ /* NatRule[] */ ]
}
```

## Endpoints propuestos

### 1) Obtener snapshot actual
`GET /api/mikrotik/firewall/snapshot?router_id=<id>`

Respuesta `200`:
```json
{ "data": { /* FirewallSnapshot */ } }
```

Errores:
- `401` sesión inválida
- `403` sin permisos
- `404` router no encontrado
- `502` fallo de conexión a router

### 2) Aplicar snapshot (batch)
`POST /api/mikrotik/firewall/apply`

Body:
```json
{
  "router_id": "router_1",
  "reason": "Motivo del cambio",
  "snapshot": { /* FirewallSnapshot */ }
}
```

Respuesta `200`:
```json
{ "data": { "applied_at": 1710000000000 } }
```

Errores:
- `422` validación (por ejemplo CIDR/puertos inválidos, campos incompatibles)
- `409` conflicto (router ocupado, lock de aplicación, cambios concurrentes)
- `502` fallo al aplicar en router

Notas de implementación:
- Lock por router durante apply (evita condiciones de carrera).
- Aplicación recomendada:
  - Validar snapshot completo.
  - Comparar con snapshot actual del router (opcional: detectar drift).
  - Ejecutar operaciones (create/update/delete) de manera determinística.
  - En caso de fallo, rollback (si se implementa un “snapshot previo”).

### 3) CRUD opcional por regla (si se requiere UI granular)
Si el producto prefiere ediciones unitarias en vez de batch, exponer:

- `POST /api/mikrotik/firewall/filter`
- `PUT /api/mikrotik/firewall/filter/{id}`
- `DELETE /api/mikrotik/firewall/filter/{id}`
- `POST /api/mikrotik/firewall/nat`
- `PUT /api/mikrotik/firewall/nat/{id}`
- `DELETE /api/mikrotik/firewall/nat/{id}`

Recomendación: mantener igualmente el endpoint batch `apply` para garantizar consistencia.

## Reglas de validación (backend)
- `srcPort/dstPort/toPorts`:
  - Solo permitido si `protocol` ∈ {tcp, udp}.
  - Formato: `N` o `A-B` con 1..65535 y A<=B.
- `srcAddress/dstAddress/toAddresses`:
  - IPv4 o IPv4/CIDR.
- `srcAddressList`:
  - Nombre de address-list (letras, números, `_`, `.`, `-`), longitud <= 64.
- Restricciones NAT:
  - `masquerade` no debe usar `toAddresses/toPorts`.
- Estandarizar campos vacíos como `null`.
