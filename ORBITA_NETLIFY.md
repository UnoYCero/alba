# Órbita en albavision.tech

Despliegue preparado en el proyecto Netlify `albavision`, ID
`aa3eb206-3126-4e99-bc91-46a4bb2d59d2`, cuenta del equipo `6864502cf6cc9967e3dac6db`.
Este ID procede del registro de compilación de producción; el ID del editor visual es distinto.
No requiere crear una base de datos de Órbita, instalar SQL ni cambiar Nutrihi o Sankalpa.
SDK `@netlify/blobs` fijado a `11.1.3`; Node 22 en Netlify. Compilación Next.js existente conservada.
Servicio publicado y canal de prueba activado el 7 de octubre de 2026. Meta usa el webhook
`https://albavision.tech/orbita/api/webhooks/whatsapp`. El número de prueba es `+1 555 178-9080`,
limitado al destinatario autorizado configurado en el canal privado. Una consulta en lenguaje natural fue recibida,
clasificada por Jev y respondida con el menú anterior de Sankalpa; Meta registró la respuesta leída
y el usuario confirmó su recepción. El número real de Alba Vision sigue pendiente de coexistencia.

## Componentes

- `netlify/functions/orbita.mjs`: receptor firmado y API privada bajo `/orbita/api/`.
- `orbita-recovery.mjs`: recuperación programada cada minuto, un mensaje por invocación.
- `orbita-server/`: clasificación Jev, cifrado, enrutamiento y conector comercial de Sankalpa.
- Netlify Blobs, almacén `orbita-private-v1`: estado operativo cifrado, conservado entre despliegues.

El webhook persiste antes de devolver éxito y procesa un mensaje mediante `context.waitUntil`.
La recuperación programada invoca `/orbita/api/jobs/run` con el token privado del trabajador.
Netlify reporta `published=false` en la tarea programada de producción; por eso esta tarea nunca
abre el almacén directamente. El receptor canónico exige su propia condición de despliegue
publicado antes de abrir datos o enviar mensajes. Así atiende trabajo pendiente si la ejecución
inicial se interrumpe. No utiliza
Background Functions ni cambia el plan Free Legacy existente. No promete envíos exactamente
una vez: un resultado de Meta incierto se marca para revisión y no se reenvía automáticamente.

El almacén usa lecturas fuertes y escrituras condicionales con ETag. El transporte rechaza
errores HTTP: el SDK actual puede reportar éxito condicional en errores distintos de 412.
Una escritura sin confirmación
no se considera exitosa. El documento único es para el volumen inicial; tiene un límite explícito
de 8 MiB de texto sin cifrar. Alcanzarlo devuelve error, sin borrar historial o mensajes pendientes.
Es necesario vigilar tamaño y contención y cambiar la arquitectura si crece el tráfico. No es un
libro contable ni reemplaza la base de pedidos del cliente. La estimación de uso de Jev no es una factura.

## Aislamiento

Solo el despliegue publicado de producción del ID y equipo indicados abre ese almacén. Las
previews, otros sitios y despliegues anteriores no pueden acceder a datos ni enviar WhatsApps.
Los teléfonos y mensajes permanecen cifrados en el blob; los tokens de cada canal tienen además
cifrado con contexto de cliente/canal. Nunca guardar secretos en `public`, `NEXT_PUBLIC_*` o Git.
El panel local sin autenticación no se publica. Las rutas del operador requieren su token propio.

## Configuración de producción

Secretos **solo para producción**, en el proyecto de Alba Vision, marcados como
`Contains secret values`. Excluir Deploy Previews, Branch deploys, Preview Server,
Agent Runners y desarrollo local. El plan Free Legacy no permite limitar el ámbito
exclusivamente a Functions: también los recibe el código de Builds y Runtime de este
sitio. Es una ampliación explícita del acceso del código de producción y requiere
autorización antes de cargar valores. No cambiar el plan de forma automática.

Netlify no permite reclasificar una variable una vez marcada como secreta. El ID
público de la app de Meta figura en la documentación, por lo que `netlify.toml`
excluye únicamente `ORBITA_META_APP_ID` del escaneo de valores secretos. Las claves,
tokens y secretos reales siguen sujetos al detector; el escaneo permanece activo.

`ORBITA_CREDENTIAL_KEY`, `ORBITA_OPERATOR_TOKEN`, `ORBITA_WORKER_TOKEN`,
`ORBITA_META_APP_ID`, `ORBITA_META_APP_SECRET`, `ORBITA_META_VERIFY_TOKEN`,
`ORBITA_TYPESAFE_API_KEY`; opcional `ORBITA_MONTHLY_BUDGET_USD`.

`ORBITA_ENABLED=false` durante el alta y las comprobaciones. Respaldar la clave de cifrado fuera
de Netlify: perderla impide leer el historial o las credenciales. No regenerarla en cada despliegue.

Registrar cada cliente pausado y cada canal desactivado. Para activarlo, verificar una credencial
duradera de Meta de la app `1782537496230918`, con `whatsapp_business_messaging` y
`whatsapp_business_management`, y confirmar que el número pertenece a su WABA. La cuenta de
prueba sigue limitada a sus destinatarios autorizados; Alba Vision requiere completar coexistencia.

Una vez verificado HTTPS, firma, rechazo de acceso anónimo, guardado real en Blobs y envío real,
cambiar el callback de Meta a `https://albavision.tech/orbita/api/webhooks/whatsapp` y probar una
conversación correlacionada. Conservar el callback anterior hasta terminar la validación. La
configuración y los datos del cliente no son el destino de este despliegue.

La API de Sankalpa conserva su responsabilidad sobre catálogo, cotizaciones y solicitudes
pendientes; Órbita no confirma pagos, inventario ni entregas. El registro de clientes y los canales
permiten agregar negocios, pero cada negocio necesita su conector y credencial verificadas.
