# Administración de Órbita

Alba Vision administra la plataforma en `https://albavision.tech/orbita/panel`.
Sankalpa es un cliente y consulta su agente desde `/admin/orbita` de su ERP.

| Capacidad | Alba Vision (`admin`) | Cliente (`tenant`) |
| --- | --- | --- |
| Ver agentes y consumo | Todos los clientes | Solo su negocio |
| Pausar/reanudar canal existente | Sí | Solo su canal |
| Activar/desactivar Jev | Sí | No |
| Asignar límite mensual y suspender cliente | Sí | No |
| Registrar nuevo cliente pausado | Sí | No |
| Ver conversaciones | Cliente seleccionado | Solo su negocio |

Aplicar `orbita-database/management.sql` exclusivamente al proyecto dedicado de Alba Vision después de comprobar destino. Añade auditoría privada y funciones de servidor; no cambia la base comercial de ningún cliente. El consumo mensual usa el periodo de Ciudad de México y los registros existentes de `orbita.usage`: consultas, tokens de entrada/salida, reservas pendientes, gasto estimado y saldo del límite técnico de Jev. No es una cuota comercial de mensajes ni incluye WhatsApp, infraestructura o una factura del proveedor. Un límite ausente se muestra como no asignado, sin inventar un saldo. El límite global del servicio también puede impedir una llamada aunque el cliente conserve saldo.

`ORBITA_PORTAL_ACCOUNTS` define accesos privados. Ejemplos sin credenciales:

```json
[
 {"id":"alba-vision","name":"Alba Vision","role":"admin","accessHash":"<sha256 del código privado>"},
 {"id":"sankalpa","name":"Sankalpa","role":"tenant","tenantId":"<UUID asignado>","accessHash":"<otro digest>"}
]
```

Sesiones de una hora firmadas, cookie HttpOnly/Secure/SameSite=Strict, control de origen y CSRF. Las funciones SQL son invoker con search_path vacío y no accesibles a anon/authenticated. El servidor fija el alcance del cliente. Cada cambio de estado/límite queda auditado. La pausa comprueba nuevamente el canal y cliente antes del envío de un trabajo ya preparado; un envío ya aceptado por Meta no puede retirarse.

El ERP no recibe claves de Supabase, Meta u operador. Su servidor intercambia el código del responsable por una sesión de cliente. Revalida el rol antes de cada operación y solo admite consulta de consumo o cambio de pausa. El login actual del ERP no autoriza estas operaciones; se requiere el código privado adicional porque ese login todavía usa un indicador local del navegador.

Alta de canales/números, credenciales de Meta y provisión de accesos no se realizan con los botones de esta versión. El alta de un cliente crea únicamente su registro pausado, no un número de WhatsApp listo. La creación de pedidos continúa gobernada por el flag comercial independiente.
