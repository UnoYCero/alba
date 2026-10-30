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
