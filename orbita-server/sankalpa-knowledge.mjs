// Approved trial FAQ supplied by Sankalpa on 2026-10-31. Never shared with another tenant.
// This contains no account credentials, payment details, or customer records.
const SANKALPA_TENANT='53eefea1-ce35-4449-8d93-3ba510577b15';
const approved={
 paquetes:'Hay opciones de adicionales y algunos cambios sujetos a revisión. No modificamos un paquete sin confirmar la excepción con el equipo.',
 cambio_ensalada:'Los lunes se puede cambiar la ensalada por media orden extra de sopa y media orden de guisado con guarnición. Si quieres hacerlo en tu pedido, el equipo debe revisar y confirmar el cambio.',
 vegetal:'La cocina es 100% vegetal y está pensada para todas las personas, sean o no vegetarianas o veganas.',
 ingredientes:'Se pueden revisar algunos cambios si el ingrediente no es una base de la receta; ajo o cebolla generalmente no se pueden retirar. Hay que avisar el miércoles, cuando se recibe el menú, para revisar la solicitud.',
 desayuno:'Por ahora el servicio es para la comida. Hay una tienda en línea con opciones de desayuno en preparación, pero todavía no está disponible.',
 macros:'No ofrecemos meal prep con conteo de macros y no contamos con nutriólogos para calcularlos.',
 salud:'No somos un servicio para tratar condiciones médicas y no ofrecemos recomendaciones médicas ni nutricionales. Puedes revisar las opciones del menú con tu médico o nutriólogo.',
 gluten:'No somos un servicio apto para personas celíacas: el equipo está en contacto con trigo. Algunas opciones del menú pueden no incluir trigo, pero otras sí; no podemos garantizar ausencia de contaminación cruzada.',
 recogida:'Puedes recoger el pedido en la sucursal de tu ciudad los domingos de 5 a 6 de la tarde. La dirección exacta está pendiente de confirmar.',
 contenedores:'Usamos un kit estandarizado de contenedores para el manejo y almacenaje, por lo que no recibimos tuppers propios.',
 menu_semanal:'Sí, el menú cambia cada semana.',
 adicionales:'También manejamos pedidos por kilo, litro o pieza. La disponibilidad y los precios deben consultarse para el menú correspondiente.'
};
export function approvedTenantKnowledge(tenantId){return tenantId===SANKALPA_TENANT?approved:{};}
