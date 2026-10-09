# Órbita: solicitudes y revisión de pedidos

Alba Vision es la empresa, Órbita la plataforma y Sankalpa su primer conector comercial. El panel se puede publicar independientemente del flujo comercial; habilitarlo no activa la creación de pedidos ni conecta un teléfono real.

## Comportamiento

- Conversación guiada con contexto cifrado persistente: sucursal, menú abierto, cantidad, nombre, entrega o recogida, dirección, código postal, zona, extras y método de pago.
- El conector de Sankalpa calcula los importes con sus propios datos. Jev clasifica la intención; no determina precios, inventario, identidad ni aprobación de pago.
- El cliente ve el desglose y confirma explícitamente. Un cambio de precio, cantidad o vencimiento exige una confirmación nueva.
- La confirmación del cliente crea una solicitud privada en Órbita. Un responsable revisa disponibilidad, entrega y pago desde `/orbita/panel`; solo entonces se solicita la creación del pedido en Sankalpa.
- Cada cuenta del panel queda vinculada a un único tenant. La sesión dura una hora, usa cookie HttpOnly/Secure/SameSite y protege las acciones con Origin y CSRF. Las credenciales del conector permanecen en el servidor.
- El panel muestra solicitudes y conversaciones, y permite pausar/reanudar al agente. La atención personal se realiza en WhatsApp Business; el panel no incluye un compositor de mensajes.
- Aprobaciones repetidas conservan la referencia y la autorización original. Una operación incierta se reconcilia con esa misma referencia; una revisión en curso tiene una ventana de recuperación de 30 segundos.

## Configuración y activación pendientes

1. Aplicar `orbita-database/commerce.sql` **solo** al proyecto de plataforma `pfptagachuwclcxkmldb` (Alba Vision). Es una ampliación privada del esquema Órbita existente, no una migración de la base de Sankalpa.
2. Para publicar solo el panel, conservar `ORBITA_COMMERCE_ENABLED` desactivado. El panel muestra las conversaciones existentes y permite pausar/reanudar el agente. La API y el formulario de aprobación comercial permanecen bloqueados. Revisar y desplegar el conector de Sankalpa antes de activar el flujo comercial.
3. Configurar exclusivamente en las funciones de producción de Netlify:
   - `ORBITA_PORTAL_ENABLED=true`. Usar `ORBITA_COMMERCE_ENABLED=true` únicamente al activar el flujo comercial completo.
   - `ORBITA_PORTAL_SESSION_KEY`: 32 bytes aleatorios representados como 64 caracteres hexadecimales.
   - `ORBITA_PORTAL_ACCOUNTS`: JSON con `{id,name,tenantId,accessHash}`. `accessHash` es SHA-256 de un código aleatorio de al menos 32 caracteres entregado privadamente al responsable. No guardar el código en este repositorio.
   - Para activar aprobación comercial: `ORBITA_COMMERCE_REVIEW_TOKENS`, objeto JSON que asigna al tenant la autorización comercial de revisión, independiente del token de catálogo. No se necesita para consultar conversaciones desde el panel.
   - Conservar la configuración existente de Supabase, cifrado, webhook y canal. Se requiere `ORBITA_STATE_BACKEND=supabase` y despliegue publicado de producción; los previews no abren el panel.
4. Desplegar el código y habilitar el flujo primero en el canal de prueba autorizado. Verificar conversación, solicitud, revisión y pedido antes de conectar Alba Vision por coexistencia.

Los flags nuevos están apagados por defecto. Para detener el flujo nuevo, desactivarlos y conservar las tablas y registros; no borrar pedidos ni ejecutar un rollback destructivo. El endpoint de revisión de Meta existente permanece separado.

## Límites de esta versión

El adaptador comercial está restringido al conector de Sankalpa existente. El almacenamiento y las identidades están separados por tenant, pero incorporar otro negocio requiere su propio adaptador y configuración. No se afirma que exista onboarding autoservicio para cualquier negocio.

No se reabren menús históricos. Para compras reales hace falta un menú válido abierto por el negocio. El cliente debe tener un perfil único vinculado a su teléfono y una dirección verificada para la conversión a pedido. Los perfiles nuevos o duplicados se resuelven en el sistema del negocio. Los comprobantes, cupones y promociones se derivan a atención humana; efectivo requiere autorización del perfil. No se añaden cobros con tarjeta ni notificaciones proactivas de cambios de estado.

## Verificación

`node --test tests/orbita-*.test.mjs` comprueba cifrado, aislamiento entre tenants y teléfonos, autenticación/CSRF, confirmación, cambios de precio, menús cerrados, pausas, recuperación de revisiones e idempotencia. PGlite ejecuta el SQL de plataforma sin acceso a bases reales. La prueba integrada adicional usa un segundo PGlite con el SQL comercial de Sankalpa y un transporte local que rechaza llamadas de red reales.
