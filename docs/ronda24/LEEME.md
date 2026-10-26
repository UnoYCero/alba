# Ronda 24 · mejoras elegidas y Surface Ops

Implementación en `mejoras-r23`, desde `labs-pro` (`fe14e1159e633b98b0e5e067078c0433a134495e`, PR #47). El destino es un PR en borrador a `UnoYCero/alba:main` desde `maxmerida77/alba:mejoras-r23`. No se hace merge.

## Cambios

- **Vision Ops 1:** el hallazgo real de los 41 segundos abre la página. Su imagen se identifica como recreación, y el enlace lleva al reporte de ejemplo. La escena técnica permanece después.
- **Portada 1:** tres propósitos llevan antes a UNBLIND, Vision Ops o Alba Space, conservando el titular y el catálogo de proyectos.
- **Labs 1:** la selección del manual, el contexto y la pregunta reemplazan «Entre ver y crear». Es una demostración manual, sin IA ni reconocimiento en vivo.
- **Space 1:** el instrumento aparece integrado en un CubeSat, con tres funciones seleccionables. Sigue marcado como diseño en laboratorio, sin vuelo.
- **Surface Ops:** entrada, escena foto → contorno → medidas → plano, oficina, trabajo sin señal, destinatarios y contacto. Escala con marcador impreso o cinta; profundidad con IA experimental, sin validación de campo, pilotos ni clientes. Se incorpora a la navegación y al catálogo.

La versión inglesa procede de `scripts/version-en/`. Se añadió Surface Ops al extractor, al generador y al verificador; este último ahora devuelve un fallo si encuentra español y revisa también Vision Ops. Los textos dinámicos nuevos viven en HTML para compartir la misma traducción.

## Capturas finales

| Cambio | Computadora | Celular | Teléfono bajo |
|---|---|---|---|
| Portada | [Ver](capturas/portada-computadora.jpg) | [Ver](capturas/portada-celular.jpg) | [Ver](capturas/portada-celular-bajo.jpg) |
| Vision Ops | [Ver](capturas/visionops-computadora.jpg) | [Ver](capturas/visionops-celular.jpg) | [Ver](capturas/visionops-celular-bajo.jpg) |
| Labs | [Ver](capturas/labs-computadora.jpg) | [Ver](capturas/labs-celular.jpg) | [Ver](capturas/labs-celular-bajo.jpg) |
| Alba Space | [Ver](capturas/space-computadora.jpg) | [Ver](capturas/space-celular.jpg) | [Ver](capturas/space-celular-bajo.jpg) |
| Surface Ops | [Ver](capturas/surfaceops-computadora.jpg) | [Ver](capturas/surfaceops-celular.jpg) | [Ver](capturas/surfaceops-celular-bajo.jpg) |

Hay diez capturas equivalentes en inglés, con `-en-` en el nombre. Labs muestra la sección nueva completa, no sólo el primer encuadre de la página. Las demás capturas principales muestran la entrada.

Las correcciones del revisor se documentan por separado: [Surface a 390 × 844](capturas/surface-saltar-corregido-celular.jpg), [Labs a 320 px](capturas/labs-modular-320.jpg) y [Labs en inglés a 320 px](capturas/labs-modular-en-320.jpg). Las cuatro capturas de estados de Surface anteriores al arreglo se conservan en `capturas-antes/`, sólo como antecedente del dictamen inicial.

## Verificación y límites

Se revisaron cinco páginas, en español e inglés, a **1440 × 900, 390 × 844 y 390 × 660**. Además, español a 1024 × 768 y 320 × 568. Son 40 combinaciones registradas en `medidas.json`, sin imágenes rotas ni desborde en los tamaños pedidos. Los botones medidos en celular tienen al menos 44 px. `consola.json` no registra errores. No se usó un teléfono físico ni se probaron Safari/iOS o Chrome/Android.

El configurador existente de Labs desbordaba 13 px a 320 px. El lote final lo dispone en una columna hasta 360 px; la confirmación ES/EN está en `correcciones.json`, con desborde cero y nombres completos. Ese archivo también confirma que «Saltar» de Surface mide 44 px, sin estirarse entre dos posiciones. La revisión independiente dio **`ship` al cierre de esos dos hallazgos**, no una certificación global de accesibilidad: [veredicto](VEREDICTO-FINAL.md).

**Menos movimiento:** Max eligió expresamente comprobar sólo el código. Se revisaron las consultas de preferencia, la escena corrida y la ausencia de avance automático nuevo. No se activó la preferencia del sistema ni se acredita prueba visual de esa modalidad. Surface también pasa a contenido corrido por debajo de 700 px de alto, probado en el teléfono bajo.

Se probaron las puertas, selección de función, contexto/pregunta/reinicio y las capas de Surface, con teclado y controles locales (`interacciones.json`). No se enviaron mensajes, no se ejercitaron cuentas ni se midió el producto en campo.

`npm run build`, la sintaxis de los dos scripts modificados y la generación/verificación inglesa pasan. `archivos.json` revisa diez HTML: recursos y enlaces locales existentes, un solo h1 e identificadores sin repetición. El detector impeccable se ejecutó una vez; sus avisos y su alcance se explican en [REVISION.md](REVISION.md). No se afirma AA global ni rendimiento bajo red limitada.

## Preservación y recursos

`public/orbita/`, `public/en/orbita/`, los tres scripts de UNBLIND y `subpagina.js`/`subpagina.css` no difieren de `labs-pro`. En UNBLIND sólo se agregaron enlaces de navegación a Surface Ops. No se tocó `surface-ops/bache-medidor/docs/ESTADO-ACTUAL.md` ni su app.

La ilustración del bache se creó con la herramienta integrada de imágenes; su instrucción exacta está en [imagen-original.txt](imagen-original.txt). Se convirtió a WebP de 1440 px, sin simular una foto real. Las otras dos imágenes proceden de `surface-ops/bache-medidor/docs/pantallazos/03-contorno.png` y `05-resultado.png`, convertidas a WebP de 900 px y mostradas como detalle mediante CSS. Son capturas reales sobre muestras de internet, identificadas como ilustración. Las imágenes para compartir son composiciones HTML propias a 1200 × 630, una por idioma, con la marca existente.

Las procedencias se guardan en metadatos o archivos auxiliares. Los cinco recursos de Surface suman aproximadamente 1 MB, compartido entre idiomas; las capturas de revisión no se cargan en el sitio. [Decisiones de diseño y límites](DISENO.md).
