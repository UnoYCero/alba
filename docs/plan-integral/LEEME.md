> Actualización 26-oct-2026: capturas fuera del historial del sitio, en el [respaldo de marca](https://github.com/maxmerida77/alba-marca/blob/respaldo-plan-integral-2026-10-26/propuestas/2026-10-26-plan-integral/). Este informe conserva sus resultados anteriores; la nueva prueba visual de movimiento reducido sigue pendiente.

# Ritmo, diseño y movimiento de Alba

Plan aprobado el 25-oct; construcción y comprobaciones del 26-oct-2026. Rama `ritmo-movimiento-integral`, desde `87e8c10` (`mejoras-r23`, PR #48). Autoridad: el plan integral en la carpeta de marca. Se conservan la portada como referencia, Hanken Grotesk 300 e itálica, paleta y composición abierta.

Los estados ocultos dejan de reservar la altura del texto más largo. La altura visible y el presupuesto de avance se calculan por separado. Operación de Vision Ops, despiece de Space y tres tiempos de Labs usan controles en lectura natural; las escenas restantes liberan la lectura cuando dejan de caber. Las cinco páginas comparten ritmo de capítulos y grupos.

| Página | Resultado |
|---|---|
| Portada | Ojo, luz, titular y estructura conservados; transición discreta entre las tres puertas. |
| Vision Ops | Recorrido anónimo 0→41 en 5.2 s, pausa y exploración manual. Reporte y crecimiento más breves, métricas legibles. Piloto en tarjeta centrada / hoja móvil: tres campos, validación, resumen editable y WhatsApp preparado sin enviar. |
| Alba Space | CubeSat→instrumento con GLB existente a demanda y tres funciones ópticas. Controles junto al objeto móvil, selección persistente, galería/despiece/baffle más breves. |
| Alba Labs | Del mismo manual seleccionado sale el fragmento de contexto que acompaña la pregunta. Continuar, reiniciar, módulos y configurador conservados; demostración manual identificada. |
| Surface Ops | Firma vectorial oficial clara/oscura, iconos y piezas para compartir ES/EN. Foto y plano con el mismo contorno de 22 lados y medidas de ejemplo coherentes; menú adaptado a pantallas bajas. |

Las entradas de Space y Labs muestran el objeto junto al texto y acción también a 1024 px. UNBLIND y Órbita ES/EN y sus dependencias compartidas protegidas conservan el contenido respecto de la base.

## Ver y revisar

Desde la casa madre: `python -m http.server 8771 --directory sitio-web/public`. Abrir [la portada](http://localhost:8771/?plan=entrega), [Vision Ops](http://localhost:8771/visionops/), [Space](http://localhost:8771/AlbaSpace/), [Labs](http://localhost:8771/AlbaLabs/) o [Surface](http://localhost:8771/surfaceops/).

- [ACEPTACION.md](ACEPTACION.md): cada compromiso, evidencia y límite real.
- [REVISION.md](REVISION.md): revisión independiente y resolución de hallazgos.
- [matriz-entrega.json](matriz-entrega.json): 50 combinaciones, cinco páginas × dos idiomas × cinco tamaños, sin desborde ni imágenes cargadas rotas. Tamaños: 1440×900, 1024×768, 390×844, 390×660 y 320×568.
- [Capturas](https://github.com/maxmerida77/alba-marca/blob/respaldo-plan-integral-2026-10-26/propuestas/2026-10-26-plan-integral/capturas/) reales por tramos y estados; [láminas](https://github.com/maxmerida77/alba-marca/blob/respaldo-plan-integral-2026-10-26/propuestas/2026-10-26-plan-integral/laminas/) como índice. Se revisan los originales para leer los detalles.
- [verificaciones.json](verificaciones.json): inglés, sintaxis, recursos y compilación. [archivos.json](archivos.json): frontera protegida, identificadores y recursos.
- [fuentes-finales.json](fuentes-finales.json), [persistencia.json](persistencia.json), [controles-finales.json](controles-finales.json) y [consola.json](consola.json): casos específicos.
- [DESIGN.md](../../DESIGN.md), `.impeccable/design.json` y [DISENO.md](DISENO.md): sistema visual extraído y ámbito autorizado.

Celular significa ventana de navegador, no teléfono físico. El espacio con teclado se simuló a 390×360, sin teclado móvil real. «Menos movimiento» se revisó sólo en código, como eligió Max. El caso sin WebGL activa las guardas mediante un servidor de pruebas; no desactiva físicamente la GPU. El detector conserva 54 avisos brutos juzgados en contexto; no equivalen a defectos confirmados ni a certificación global de contraste o accesibilidad. No se midió conversión.

No se añade servidor ni recopilación de datos. No se enviaron mensajes reales. Se mantienen avisos de concepto, ilustración, ejemplo y desarrollo. Surface sigue en pruebas, sin pilotos ni clientes y con profundidad experimental.

## Recursos e integración

`ritmo.css` e `integral.js` sólo se cargan en las cinco páginas autorizadas. [pesos.json](pesos.json) registra 289495 bytes de activos nuevos sin compresión HTTP y el tamaño del CSS/JS nuevo. Se reutilizan los GLB existentes; no se añade vídeo ni biblioteca externa.

Inglés se genera desde `scripts/version-en/`: extraer, conservar/agregar traducciones, generar y revisar. `scripts/plan-integral.py` y `plan-interacciones.py` fueron migraciones únicas: no repetir sobre el sitio construido. `plan-traducciones.py` conserva el mapa histórico. `servidor-pruebas.py` es auxiliar local y no se despliega.

`medidas.json`, `medidas-finales.json` y `fuentes.json` conservan historial anterior a los últimos ajustes. Las exploraciones y capturas sustituidas están excluidas de la entrega. La preferencia del navegador puede escalar la imagen capturada; las medidas CSS se registran aparte.

La base es el PR [#48](https://github.com/UnoYCero/alba/pull/48), comprobado abierto y en borrador. Comparación exclusiva: [mejoras-r23…ritmo-movimiento-integral](https://github.com/maxmerida77/alba/compare/mejoras-r23...ritmo-movimiento-integral). El PR a `UnoYCero/alba:main` incluye esa base mientras #48 siga pendiente. No hacer merge ni publicar como parte del encargo.

Entrega de esta construcción: [PR #49 en borrador](https://github.com/UnoYCero/alba/pull/49), con enlaces al informe y a las capturas del respaldo de marca.
