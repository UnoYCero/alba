# Órbita como servicio independiente

El servicio tiene su propio proyecto Netlify, separado del ERP y de la web de Alba Vision:

- Equipo: AlbaVision (`alan-soubran`, conexión Secundario).
- Proyecto: `orbita-agentes-alba` (`805b1e9c-a8c4-47d6-bcdd-a8617a6913d5`).
- Origen: `https://orbita-agentes-alba.netlify.app`.
- Panel: `/orbita/panel`.
- Webhook: `/orbita/api/webhooks/whatsapp`.

## Código y publicación

`npm run build:orbita` genera `dist-orbita/` con la información pública de Órbita. Las funciones están en `netlify/functions/`, fuera de la carpeta pública. El build general de la web no se usa para publicar este servicio.

Después de compilar la carpeta estática, la publicación del proyecto independiente se realiza con Netlify CLI:

```sh
netlify deploy --prod --no-build --dir dist-orbita --functions netlify/functions --site 805b1e9c-a8c4-47d6-bcdd-a8617a6913d5
```

Comprobar siempre la cuenta seleccionada antes de publicar. No conectar el build de la web Next.js de Alba Vision por error: el receptor y el panel son funciones autónomas. La configuración local de Netlify y las carpetas generadas están excluidas de Git.

En Windows, instalar las dependencias físicas del servicio antes de empaquetar: no reutilizar `node_modules` ni OpenAI mediante uniones con otro checkout. El empaquetador de funciones puede omitir esas dependencias y producir un deploy que figure listo pero falle al arrancar. La publicación con OpenAI del 31 de octubre se preparó desde una copia independiente fuera del checkout, con las mismas funciones y archivos públicos, y una instalación física de `openai@7.47.0` y `@netlify/blobs@11.1.3`. Se comprobó el paquete ejecutable generado, además del estado de Netlify.

## Configuración de producción

- `ORBITA_NETLIFY_SITE_ID`: ID del proyecto independiente autorizado.
- `ORBITA_NETLIFY_TEAM_ID`: ID del equipo propietario, verificado con Netlify.
- `ORBITA_PUBLIC_ORIGIN`: origen HTTPS exacto, sin barra final ni ruta.
- `ORBITA_STATE_BACKEND=supabase`.
- `ORBITA_PROJECT_REF=pfptagachuwclcxkmldb` y `ORBITA_ORGANIZATION_ID=dgcoyccqqeyjhfatcasa`.
- Conservar la clave de cifrado existente para poder abrir las conversaciones y credenciales guardadas.
- Conservar las credenciales de Meta, Jev y las cuentas limitadas del panel como secretos de producción. Nunca copiarlas al directorio público ni a este documento.

La configuración de destino debe estar completa: un valor parcial o inválido bloquea el servicio. Los sitios de Sankalpa están explícitamente excluidos como destinos del servidor de Órbita. Los despliegues de vista previa y las publicaciones que no estén activas no pueden abrir la base real.

Cuando no existen variables del nuevo destino se conserva el destino histórico de Alba Vision para mantener la compatibilidad del repositorio. El portal usa el origen configurado para validar las solicitudes. La tarea de recuperación usa el mismo origen y no sigue redirecciones con su credencial privada.

## Cambio del receptor

1. Publicar con `ORBITA_ENABLED=false` y verificar panel, administrador, cliente limitado y conexión a Supabase.
2. Dejar pública únicamente la producción requerida por Meta; mantener la protección de las vistas previas. El panel conserva su autenticación propia.
3. Guardar `ORBITA_ENABLED=false` en el proyecto anterior y comprobar su estado publicado. Los cambios de variables necesitan una nueva publicación para aplicarse a funciones antiguas.
4. Activar y volver a publicar el proyecto nuevo. Guardar la configuración previa del webhook, cambiarlo en Meta y verificar la URL y la suscripción después del cambio.
5. Conservar el modo de prueba y sus remitentes permitidos. Verificar una conversación real antes de conectar otro teléfono o ampliar el canal.

La migración reutiliza la base de Órbita. No requiere cambios de esquema ni de datos en la base de Sankalpa. Los trabajos usan las concesiones y controles de idempotencia existentes.

El ERP debe configurar `ORBITA_PLATFORM_ORIGIN` con el origen nuevo después de publicar su proxy compatible. Esto cambia la dirección del proveedor y no concede al cliente credenciales de administrador.

## Interpretación con OpenAI

`ORBITA_AI_PROVIDER=openai` selecciona OpenAI para interpretar los mensajes en los canales con IA habilitada. `ORBITA_OPENAI_API_KEY` se guarda como secreto de producción de este proyecto; nunca lleva prefijo público. Se usa el SDK oficial y la Responses API directamente contra OpenAI, con `store:false`, sin herramientas, sin reintentos automáticos y con un tiempo máximo de 15 segundos.

El modelo fijado es `gpt-4.1-mini-2025-04-14`. Se comprobó su acceso y clasificación real el 31 de octubre de 2026. La documentación lo marca como deprecated: revisar la fecha de retirada y validar un reemplazo antes de actualizarlo. No cambiar el modelo sin actualizar también sus tarifas y las pruebas.

Solo se envían el texto entrante y el nombre del negocio: no se adjuntan teléfono, nombre del contacto, historial, claves ni registros del ERP. El texto podría contener datos personales escritos por la persona. El aviso de privacidad enumera OpenAI y TypeSafe. `store:false` no equivale a retención cero del proveedor.

Antes de activar OpenAI se aplica `orbita-database/openai-usage.sql` **exclusivamente al proyecto de Órbita**. Añade una reserva privada que considera entrada y salida y conserva los límites globales y por cliente. El consumo real ajusta la reserva una sola vez. Se estima sin descuento de caché a USD 0.40/1M de entrada y USD 1.60/1M de salida; no representa una factura. Las reservas sin uso verificable permanecen conservadoras.

El campo histórico `jev_enabled` conserva su nombre por compatibilidad, pero controla la IA seleccionada. El panel muestra el modelo configurado y etiquetas generales de IA. Sin `ORBITA_AI_PROVIDER` se conserva Jev; para volver a él se guarda `ORBITA_AI_PROVIDER=jev` y se vuelve a publicar, conservando su clave existente.

OpenAI produce únicamente intención y confianza; no crea texto comercial, precios, pedidos ni verificaciones de pago. Las respuestas usan los conectores y reglas existentes. Un fallo, rechazo o presupuesto insuficiente conserva la atención guiada. La base de Sankalpa no requiere ninguna modificación.
