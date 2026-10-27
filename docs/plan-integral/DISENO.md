> Actualización 26-oct-2026: capturas fuera del historial del sitio, en el [respaldo de marca](https://github.com/maxmerida77/alba-marca/blob/respaldo-plan-integral-2026-10-26/propuestas/2026-10-26-plan-integral/). Este informe conserva sus resultados anteriores; la nueva prueba visual de movimiento reducido sigue pendiente.

# Diseño del plan integral

26 de octubre de 2026. Registro documental posterior a la implementación y al lote de cuatro correcciones. Clasificación: **extensión aprobada de un mundo existente**, con cambio durable de ritmo y una tarjeta funcional de piloto. No es un rediseño ni una reparación general de deriva.

## Autoridad y alcance

Mandaron [el plan](../../../marca/propuestas/2026-10-25-plan-integral/LEEME.md), su `OBJETIVO.md`, `PRODUCT.md`, la portada existente y el [kit de Surface](../../../marca/propuestas/2026-10-17-firma-de-familia/kit-final/surface-ops/REGLAS.md). No existe `marca/GUIA.md`; se encontró y leyó la guía vigente `marca/GUIA-DEL-SITIO.md`.

El sistema durable queda registrado en [DESIGN.md](../../DESIGN.md) y `.impeccable/design.json`. Sus reglas nuevas se limitan a portada, Vision Ops, Alba Space, Alba Labs y Surface Ops, con sus diez HTML ES/EN. UNBLIND, Órbita y las dependencias compartidas quedan protegidos. Los estilos comunes se leyeron para extraer la referencia; este pase no modifica implementación, fuentes, activos ni traducciones.

## Contrato de dirección de esta entrega

- **MODE:** persuadir mediante una demostración comprensible y una acción concreta; operar sólo en controles y preparación del piloto.
- **THESIS:** mostrar cómo Alba pasa de lo visible a una pregunta, una función o una medida, con texto breve y evidencia identificada.
- **OWN-WORLD:** amanecer existente; Hanken 300 e itálica, papel/marino/azul, composición abierta. Portada conservada como referencia. La tarjeta del piloto es una excepción funcional autorizada.
- **STORY:** cada página explica una relación propia. El contenido visible gobierna su altura; el desplazamiento deja de fijarse cuando la composición no cabe y mantiene una salida legible.
- **FIRST VIEWPORT:** portada con ojo/luz/puertas; Vision Ops con evidencia recreada, secuencia 0–41 y acción; Space con CubeSat/instrumento y funciones; Labs con lentes, concepto y acción; Surface con foto, medición, escala y firma.
- **FORM:** objetos e imágenes protagonistas, controles textuales y movimiento acotado. Tres campos → resumen editable → WhatsApp preparado sin envío; ninguna nueva colección de cajas generales. Versión quieta completa, revisada aquí sólo en código.

## Correspondencia comprobada con la fuente

| Página | Mecanismo y contrato conservado | Fuente leída |
|---|---|---|
| Portada | Ojo, cielo y puertas existentes; cambio manual de puerta y entrada breve de su contenido. | `public/index.html`, `landing.css`, `amanecer.css`, `ronda24.css/js`, `ritmo.css`. |
| Vision Ops | El recorrido anónimo va de 0 a 41 en 5.2 s; botón de reproducción/pausa, deslizador y estado final. Es una recreación identificada. Operación usa pasos manuales y oculta del flujo los textos inactivos. Los rótulos redundantes se ocultan sólo al aparecer el tablero. | `public/visionops/index.html`, `visionops.css/js`, `integral.js`, `ritmo.css`. |
| Piloto | `dialog` con dos selectores y cámaras 1–50; validación nativa; resumen editable; valores conservados al reabrir; cierre, Escape y retorno de foco. `visionops.js` prepara el vínculo con texto y `integral.js` gestiona presentación y foco. No hay envío automático. | HTML de Vision Ops, función `piloto` de `visionops.js` y bloque de diálogo de `integral.js`. |
| Space | CubeSat → instrumento; modelo existente cargado al pedir el acercamiento. Elegir función abre el instrumento y cambia su explicación óptica. Respaldo de imagen si no hay modelo o movimiento. La elección manual de basura/aplicaciones persiste; foco, puntero o teclado detienen el avance del rango de acoplamiento. | `public/AlbaSpace/index.html`, `space.js`, `ronda24.js`, `integral.js`. |
| Labs | La selección del manual extrae un fragmento de la misma fotografía; contexto → pregunta, continuar y reiniciar. Selección manual demostrativa, sin afirmar reconocimiento o IA activa. Módulos y configurador existentes conservados. | `public/AlbaLabs/index.html`, `labs.js`, `ronda24.js`, `integral.js`, `ritmo.css`. |
| Surface | Foto y plano comparten el mismo trazado de 22 vértices A–V y el corte de ejemplo 1.20 × 0.55 m. Cotas, escala, revisión humana y aviso de profundidad experimental acompañan el recorrido. Firma de menú oficial sin sello y variantes originales. | `public/surfaceops/index.html`, `ronda24.css/js`, `ritmo.css`, kit de marca. |
| Inglés | Los cinco HTML generados cargan las mismas piezas nuevas y mantienen los mecanismos. La generación sigue siendo la vía de edición. | `public/en/index.html`, `en/visionops/`, `en/albaspace/`, `en/albalabs/`, `en/surfaceops/`. |

## Ritmo y adaptación

`ritmo.css` incorpora dos espacios reutilizados: capítulo y grupo. Los estados ocultos de operación y despiece usan `display:none`; no conservan el tamaño del primer titular. `integral.js` mide contenido con `ResizeObserver`, espera fuentes y vuelve a medir al cambiar ventana. La altura de la composición y el presupuesto de avance se suman por separado, sin realimentar el cociente de avance. Si deja de caber, la escena pasa a lectura natural durante esa visita.

La corrección final mantiene las entradas de Space y Labs a dos columnas entre 761 y 1080 px. El menú colapsado empieza debajo de la cabecera, admite desplazamiento vertical y conserva alturas de acción. Estas reglas residen en el archivo cargado sólo por las páginas autorizadas.

`fuentes-finales.json` registra una demora de fuente de 12 s: el pin cambia de 638 a 697 px y ambas secciones crecen los mismos 59 px; el desborde registrado es cero. Es evidencia del constructor leída en archivo, no una ejecución de este pase.

La versión quieta se leyó en CSS/JS: se cancelan las animaciones y transiciones, las escenas pasan a lectura corrida según su mecanismo, se conserva el estado final del hallazgo y el instrumento usa imagen de respaldo. **No se hizo prueba visual ni emulación de «menos movimiento»**, por la preferencia de Max. Tampoco se prueba un teléfono físico mediante capturas de ventanas.

## Evidencia y límites de este registro

Se leyeron `ACEPTACION.md`, `REVISION.md`, `fuentes-finales.json` y `pesos.json`. `pesos.json` declara 289495 bytes de recursos nuevos, más los archivos nuevos de CSS/JS listados aparte, sin compresión HTTP; se reutilizan GLB existentes y no se incorpora vídeo nuevo. Este registro no mide rendimiento.

El documentador abrió las recapturas de entrada a 1024 y contrastó la norma con el código. El constructor completó después las capturas del menú y del tablero; el revisor independiente examinó esos originales y los seis estados manuales de Space. El dictamen posterior de `REVISION.md` es `ship`, limitado a las cuatro correcciones puntuadas como resueltas. Conserva la revisión completa inicial como historial.

La matriz y las pruebas del constructor se describen en `ACEPTACION.md`. El documentador no las reejecutó, no abrió navegador ni ejecutó detector; esta documentación no certifica accesibilidad, consola, conversión o calidad global.
## Qué queda normativo y qué no

Se conserva el mundo existente y se fijan el ritmo por contenido visible, las salidas de lectura, el comportamiento manual persistente, la excepción modal del piloto y la identidad de Surface dentro del alcance. Las rampas del archivo complementario sólo ayudan a visualizar los colores; no son nuevos colores de producto. Los ejemplos de componentes documentan formas existentes y no ejecutan sus mecanismos.

No se convierten en reglas los pesos 400 heredados frente a Hanken 300 ni los avisos brutos del detector. No se añade una prohibición global contra las pastillas, tarjetas funcionales, velos o sombras que ya tienen una función en este mundo. No se corrige deriva preexistente ni se extiende el encargo a UNBLIND/Órbita. Los compromisos de producto contradictorios o desactualizados de otros registros tampoco se reescriben como parte de este pase visual.
