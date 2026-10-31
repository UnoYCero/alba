# Atención y compra conversacional de Sankalpa

Alba Vision es la empresa, Órbita es la herramienta y Sankalpa es el cliente. Esta ampliación cambia la atención de ese cliente sin compartir su conocimiento con otros negocios ni modificar su base de datos.

## Recorrido implementado

1. Recibir el primer mensaje de WhatsApp, también cuando viene de una campaña.
2. Contestar preguntas generales y confirmar la ciudad antes de compartir menú, precio, ubicación o cobertura local. La lada solo sugiere una pregunta; nunca selecciona la ciudad por sí sola.
3. Consultar el catálogo autenticado del negocio y limitar el contexto y las respuestas a esa ciudad. Si el menú ya cerró, identificarlo como histórico y no venderlo como vigente.
4. Resolver dudas con información aprobada y permitir que el modelo formule una pregunta breve cuando ayude. Una interrupción no obliga a volver de inmediato al campo pendiente; un saludo tampoco se interpreta como un dato o una confirmación. Si falla el catálogo, las demás dudas pueden seguir atendiéndose.
5. Preguntar paquetes y solicitar permiso antes de recopilar nombre, correo, dirección y código postal. El teléfono se toma del mensaje firmado de WhatsApp; no lo decide el modelo. Revisar el resumen y pedir consentimiento antes de cualquier registro. Si se interrumpe una confirmación, volver a mostrarla antes de aceptar un «sí».
6. Por contrato, registrar al cliente, cotizar adicionales, revisar el total, pedir confirmación, registrar un pedido pendiente y emitir un ticket de texto con instrucciones de pago. Estas operaciones necesitan conectores reales verificados; las pruebas actuales usan adaptadores ficticios aislados.
7. Si existe una imagen aprobada para el menú exacto de esa ciudad, enviar una imagen con texto en un solo mensaje de Meta. Una imagen ausente nunca se sustituye por otra ciudad ni por una imagen inventada.
8. Marcar para revisión humana las solicitudes de quitar platillos, los comprobantes, las peticiones expresas de una persona y las operaciones inciertas. Nunca aprobar un pago por una captura. Una solicitud de revisión se refleja en la conversación del panel; no significa que se realizó una llamada telefónica o se envió un aviso externo.

## Qué se puede activar con la configuración actual

`ORBITA_SALES_ENABLED=true` y `ORBITA_SALES_PROFILES` seleccionan el perfil por UUID de cliente. El proveedor debe ser OpenAI. Sin perfil del cliente, se conserva su comportamiento anterior. El perfil de ejemplo está en `config/sankalpa-sales-profile.example.json` y deja direcciones, cobertura, fechas, imagen y pagos como pendientes.

`mode=test` impide registros, pedidos y cobros reales incluso si se activa por error una capacidad de escritura. La recopilación termina indicando expresamente que todavía no creó cuenta ni pedido. `ORBITA_COMMERCE_ENABLED` conserva su configuración previa.

La FAQ facilitada el 31 de octubre de 2026 vive en `orbita-server/sankalpa-knowledge.mjs` y solo se añade al perfil del cliente Sankalpa. Sus respuestas de salud, celiaquía y excepciones se presentan de forma controlada; una pregunta sobre cambios no modifica pedidos y un cambio concreto sigue requiriendo revisión humana. Actualizar esa FAQ requiere cambiar el código y desplegarlo: todavía no existe un editor de conocimiento en el panel. El documento no aporta direcciones, cobertura, datos bancarios ni precios vigentes.

## Información real aplazada por el usuario

- Ubicación o modalidad de recogida, horarios y días de entrega de cada ciudad.
- Cobertura, colonia/CP, costo de envío y menú vigente.
- Imagen aprobada, asociada al identificador de menú y ciudad.
- Banco, titular y CLABE. No hay cuentas ficticias en la configuración publicable.
- Configuración y enlace generado por Clip para el importe real del pedido.
- Canal externo para avisar a Diana. El panel mantiene la conversación marcada para revisión.

## Conexiones del ERP todavía pendientes

El backend actual del cliente no ofrece el contrato nuevo `/sales/register`, `/sales/orders` y `/sales/payment-link`. `sales-connector.mjs` declara los destinos fijos y sus límites; sus capacidades permanecen desactivadas. No habilitarlas solo por llenar los datos comerciales. Antes hace falta implementar y verificar esas operaciones en el backend de Sankalpa, con autorización estrecha, consentimiento, precios calculados por el servidor e idempotencia por referencia.

El alta debe permitir que el cliente establezca su acceso por un canal seguro. El agente no pide, crea ni envía contraseñas por WhatsApp. No se reutiliza el formulario actual que exige contraseña para simular una cuenta creada.

Un pedido debe existir como pendiente antes de cobrar. Su ticket no equivale a pago confirmado. El conector de Clip debe devolver un enlace verificado de payclip.com o clip.mx, asociado al pedido y al importe. La aprobación humana debe usar el flujo de revisión del ERP. Quitar platillos solo podrá automatizarse cuando el backend anuncie y aplique esa opción especial; mientras tanto se deriva a revisión.

## Persistencia, presupuesto y reintentos

Se reutilizan sesiones cifradas de Órbita, aisladas por cliente, canal y teléfono. No se agregan tablas ni funciones al proyecto de Sankalpa. OpenAI recibe información aprobada, el texto y un contexto limitado del mismo chat; nunca recibe credenciales ni el teléfono obtenido de Meta. El plan del modelo que contiene texto o datos personales se cifra antes de guardarlo en la decisión. El catálogo y las cantidades, precios, URL y operaciones se validan fuera del modelo.

Cada llamada reserva entrada y salida antes de ejecutarse y liquida el uso una vez. El contexto cifrado y la respuesta guardada permiten retomar un reintento sin volver a consultar OpenAI. Antes de una operación externa se persiste su referencia; un resultado incierto pasa a revisión y no se repite automáticamente.

La prueba aislada ejecuta la ruta con SQL real en PGlite, clientes ficticios y un conector que no puede tocar producción. Verifica ciudad, interrupciones, consentimiento, extras, pedido pendiente, ticket, enlace y comprobante; no acredita que los conectores pendientes ya estén instalados en el ERP real.
