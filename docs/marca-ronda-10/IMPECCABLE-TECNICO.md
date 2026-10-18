# Ronda 10 · auditoría técnica de la firma de familia

Método: evaluación B independiente, agente `/root/revision_tecnica`. Inspección de código y navegador antes del detector; detector ejecutado una sola vez después del mensaje «A terminó». No se leyó el informe A. Fecha: 17 de octubre de 2026.

## Veredicto de integridad

**Aprobado para el alcance de marca revisado.** Las marcas hijas tienen recursos propios, nombres accesibles y variantes para fondos claros y oscuros. Las sustituciones conservan la identidad aprobada. No encontré un bloqueo técnico nuevo de marca. Esto no certifica la accesibilidad, seguridad, rendimiento ni funcionamiento completo de las aplicaciones.

El enlace de marca que sacaba al visitante del inglés quedó corregido y comprobado en Órbita, UNBLIND y Alba Labs. También quedaron confirmados los controles de 44 × 44 px de Labs a 320 px y el logo de Vision Ops de 144 px en cabecera móvil y pie.

## Puntuación acotada al cambio

| Dimensión, 0–4 | Sitio: tres marcas y sus páginas EN | Vision Ops | Surface Ops |
|---|---:|---:|---:|
| Accesibilidad | 3 | 3 | 3 |
| Rendimiento | 4 | 4 | 4 |
| Adaptación de pantalla | 4 | 3 | 3 |
| Temas y variantes | 4 | 4 | 4 |
| Integridad de implementación | 4 | 4 | 4 |
| **Total** | **19/20** | **18/20** | **18/20** |

Los tres resultados caen en la banda excelente de la guía, exclusivamente para esta integración de marca. El 3 de accesibilidad reconoce las etiquetas y el foco comprobados, sin afirmar una auditoría WCAG completa ni una prueba con lector de pantalla real. Vision Ops y Surface Ops pierden un punto de adaptación por la altura del enlace de su logo, inferior a la recomendación de 44 px. No se interpreta como incumplimiento automático de WCAG AA.

## Alcance y evidencia

- Sitio: `public/orbita/index.html`, `public/Unblind/index.html`, `public/AlbaLabs/index.html`, sus equivalentes generados en inglés, `assets/marcas/menu.css`, SVG de menú, iconos y tarjetas de compartir.
- Vision Ops: reglas de marca en `platform/web/app/ui.css`, sustitución del rótulo de consola en `platform/web/app/consola/page.tsx`, componente compartido `components/Marca.tsx` como contexto y recursos ya referenciados.
- Surface Ops: `src/components/Marca.tsx`, `scripts/gen-icons.mjs`, SVG e iconos derivados como contexto.
- Navegador: Chrome con Playwright, contextos propios, anchos **1440, 390 y 320 px**, altura de 900 px. Se usó una pestaña IAB propia para la inspección inicial y el preflight de inyección.
- Diez rutas: seis del sitio —tres ES y tres EN—, portada/login/consola de Vision Ops y acceso inicial de Surface Ops. La matriz contiene **42 capturas de estado** y seis comprobaciones de apertura de menú. Se revisaron variantes claras/oscuras en Vision Ops y Surface Ops; el sitio usa su variante clara u oscura por superficie, sin selector global equivalente.
- `b-navegador.json` conserva medidas, fuentes de imagen, temas, errores y ancho de documento. **Sin desbordamiento horizontal en la matriz; sin respuestas HTTP fallidas ni errores de página capturados.** Esto describe las rutas observadas, no todos los estados posibles de las aplicaciones.
- `b-detalles.json` conserva nombres accesibles, foco y solicitudes de recursos. Favicons SVG/PNG, Apple Touch y tarjetas de compartir solicitaron HTTP 200; se verificaron las dimensiones PNG 48 × 48, 180 × 180 y 1200 × 630 cuando correspondían.
- `b-confirmacion.json` y `b-final-*.png` son la única pasada confirmatoria posterior a los ajustes del agente principal. Las capturas `b-*.png` sin `final` documentan la primera tanda y pueden mostrar el estado anterior.

El logo del sitio tiene un único nombre accesible en el enlace; las dos imágenes de tema tienen `alt=""`, evitando duplicar la lectura. El componente Surface añade nombre tanto en su enlace como en su representación no enlazada (`role="img"`). Vision Ops nombra el enlace y oculta su fondo decorativo de la lectura asistida. El foco visible se comprobó en enlaces de marca de las rutas de detalle.

Los recursos de logo de Vision Ops pesan aproximadamente 6 KB y 5 KB. Las tarjetas PNG del sitio rondan 39–41 KB. No aparecieron importaciones de animación o dependencias de ejecución nuevas para la marca; Sharp se usa en el generador de iconos de Surface, fuera de la ejecución de la interfaz. No se midió una puntuación Lighthouse ni se hizo una comparación de tiempos contra la versión anterior.

## Observaciones pendientes por gravedad

**0 P0, 0 P1, 0 P2; 2 P3 de comodidad táctil.**

### [P3] El enlace de logo de Vision Ops mide menos de 44 px de alto

- **Ubicación:** `vision-ops/alba-marca-ronda-10/platform/web/app/ui.css:5`, dimensiones de `.marca-logo` en la línea 12 y variante móvil en la línea 42.
- **Categoría:** adaptación de pantalla/accesibilidad motriz.
- **Evidencia:** 144 × 33,875 px en móvil; el enlace nuevo de consola conserva 33,875 px de alto. La confirmación de portada y pie mantiene el logo a 9 rem como se pidió.
- **Impacto:** la zona de pulsación es más estrecha en altura que la recomendación de 44 px; no impide navegar y el ancho es amplio.
- **Norma:** 44 px es el objetivo mejorado de WCAG 2.5.5, nivel AAA. La medida supera el mínimo de 24 px de WCAG 2.5.8, nivel AA; no se declara una infracción AA por este dato.
- **Recomendación:** dar al enlace `min-height: 44px` y centrar el logo conservando el tamaño visual actual. Comando sugerido: `$impeccable adapt`.

### [P3] El enlace de logo de Surface Ops conserva una zona de 34 px de alto

- **Ubicación:** `surface-ops/bache-medidor/.worktrees/firma-familia/src/components/Marca.tsx:14` y enlace en la línea 24.
- **Categoría:** adaptación de pantalla/accesibilidad motriz.
- **Evidencia:** 168,6875 × 34 px en la pantalla inicial, tanto clara como oscura. El tamaño normal de 34 px ya existía; esta ronda sube la variante compacta de 26 a 32 px. No se atribuye a esta ronda como regresión.
- **Impacto y norma:** misma comodidad táctil pendiente que el caso anterior; supera 24 px, pero no llega a la recomendación mejorada de 44 px.
- **Recomendación:** ampliar la caja del enlace a 44 px sin agrandar el arte. Comando sugerido: `$impeccable adapt`.

Son mejoras de acabado; no justifican cambiar los símbolos, la tipografía ni la composición aprobados.

## Ajustes confirmados durante la revisión

| Punto | Primera evidencia | Confirmación final |
|---|---|---|
| Logo en páginas EN | Al pulsarlo cambiaba a ES en las tres marcas | Se conserva `/en/orbita/`, `/en/unblind/` y `/en/albalabs/`, con `lang="en"` |
| Labs a 320 px | Cabecera muy ajustada al combinar logo, carrito, idioma y menú | Controles de carrito, idioma y menú de 44 × 44 px; logo con enlace de 44 px de alto; ancho de documento 320 px |
| Vision Ops móvil y pie | La cabecera y el pie no tenían idéntico ancho de logo | Logo de 144 px, equivalente a 9 rem, en ambos lugares; sin desbordamiento |

Los cambios los realizó el agente principal; B sólo escribió evidencia y este informe en `revision/`.

## Detector: ejecución y clasificación

Se ejecutó **una sola invocación**, con cinco argumentos de marcado: los tres HTML españoles, `consola/page.tsx` y `Surface Marca.tsx`. No se analizó un repositorio entero ni se pasó CSS como único objetivo. El detector terminó con **código 2**, que significa hallazgos, y produjo **26 registros: 23 advertencias y 3 avisos orientativos**. El JSON íntegro está en `b-detector.json`.

| Objetivo | Registros |
|---|---:|
| Órbita HTML | 11 |
| UNBLIND HTML | 8 |
| Alba Labs HTML | 7 |
| Vision Ops consola TSX | 0 |
| Surface Ops Marca TSX | 0 |

Todos los registros HTML traen `line: 0`; por ello no se inventa una ubicación de línea precisa del detector. Las ubicaciones CSS siguientes son la comprobación manual de contexto. El detector consume también estilos compartidos: encontrar una regla en una hoja cargada no demuestra que el selector tenga un elemento visible en esa página.

| Regla | Cantidad | Interpretación verificada en contexto |
|---|---:|---|
| `low-contrast` | 4 | Declara papel sobre papel en Órbita/Labs sin selector ni nodo. Es señal heredada de estilos/cascada; no demuestra un contraste 1:1 en los nuevos logos, que son imágenes con variantes propias. Las capturas muestran la marca oscura sobre claro. **No se convierte en una falla confirmada de marca ni se asegura que toda la página cumpla AA.** |
| `layout-transition` | 4 | Son reglas previas: transición de anchura de navegación en `landing.css:70`/`amanecer.css:73` y apertura de la solicitud de Órbita en `orbita.css:82`. La nueva hoja de marca no añade estas animaciones. Advertencia de rendimiento previa, fuera de esta sustitución. |
| `clipped-overflow-container` | 3 | Parte de `body` con `overflow-x:hidden` en `landing.css:27`. No se observó recorte del logo ni de los menús móviles abiertos. No basta para declarar un menú cortado; señal previa de alcance general. |
| `nested-cards` | 2 | Falso positivo semántico para esta página: los contenedores anidados pertenecen a la recreación de mensajes dentro de un teléfono. La forma de burbuja comunica conversación y la recreación está rotulada como ejemplo. No son tarjetas de navegación que compitan por jerarquía. |
| `pulsing-dot` | 1 | `.tm-escribiendo i`, en `orbita.css:44`, representa escritura dentro de esa recreación rotulada; no promete un servicio realmente conectado. Falso positivo respecto de «estado vivo engañoso» y código previo a la marca. |
| `marquee` | 3 | Regla compartida `.logos-lista` en `landing.css:495`, anterior a la ronda. No es una animación nueva de las marcas de menú; no se utiliza como argumento para rediseñarlas. |
| `dark-glow` | 3 | Sombra cromática de estilos anteriores compartidos. No añadida por `menu.css` ni por los componentes de marca revisados. No se confirmó un problema funcional del cambio. |
| `codex-grid-background` | 3 | Avisos orientativos procedentes de cuadrículas de CSS compartido, por ejemplo `landing.css:149,247` y `amanecer.css:40`. No aparecen en el nuevo arte de menú; no son hallazgos de esta ronda. |
| `cramped-padding` | 1 | Falso positivo de composición en `.ub-portada`: el retrato llega intencionalmente al borde; el texto tiene relleno propio en `subpagina.css:256` y adaptación en la línea 325. |
| `tight-leading` | 2 | Regla previa de citas: `subpagina.css:58` (1,12) y `:312` (1,25). No corresponde al texto de los logos ni demuestra por sí sola una infracción WCAG. Pendiente editorial previo si se amplía el alcance a esas citas. |

No se descontaron puntos de marca por reglas anteriores sin relación causal con el cambio. Tampoco se trató «0 registros TSX» como una garantía de ausencia de defectos.

## Buenas prácticas que conviene conservar

1. Un recurso por variante y un solo nombre accesible por marca; no hay redibujo de los símbolos en CSS ni lectura repetida de ambas imágenes.
2. SVG de menú e iconos derivados del símbolo aprobado, con dimensiones PNG coherentes para pestaña, inicio y compartir.
3. La hoja de menú se limita a `.nav-brand-hija`; conserva las medidas de la portada madre y Alba Space.
4. La firma permanece legible en los anchos revisados y la consola usa el componente común en vez de un rótulo aislado.

## Límites y notas de ejecución

- **Independencia:** B no vio A. El detector se retuvo hasta recibir literalmente «A terminó»; luego se entregan estos resultados para síntesis.
- **Lista de exclusiones:** no se encontró `ignore.md` en la raíz ni en las ubicaciones `.impeccable/critique/` de los tres árboles revisados. No se aplicaron exclusiones.
- **Identificadores calculados por la herramienta:** sitio `es-firma-familia-public-orbita-index-html-9dee33a6`; Vision `onda-10-platform-web-app-consola-page-tsx-b0d785a7`; Surface `es-firma-familia-src-components-marca-tsx-4c941b74`.
- **Visibilidad e inyección:** IAB se abrió en segundo plano. El preflight intentó cambiar `document.title` y añadir un script; la API rechazó ya la primera mutación con `Cannot set property title ... which has only a getter`. Se usó la señal de respaldo de sólo lectura. **No hubo superposición visible del detector ni registros de consola de `detect.js`.**
- **Servidor de superposición:** no se inició, porque el preflight de mutación falló. No hay un proceso `impeccable live-server` que limpiar.
- **Navegadores:** la pestaña temporal IAB se cerró; los contextos y procesos Chrome propios se cerraron al terminar cada guion.
- **Servidores de producto:** se usaron los que proporcionó el agente principal; B no inició ni detuvo los servidores 9010/9011/5177.
- **Temporalidad:** los guiones y PNG de B se conservan deliberadamente como evidencia en la única carpeta autorizada. No hay archivos temporales de B fuera de ella.
- **No probado:** lector NVDA real, dispositivo físico, ampliación de texto, gestos táctiles sintetizados, instalación PWA, previsualización de compartir en redes reales, procesos de medición/análisis, cargas de archivos, cuentas y autenticación de producción. Emular el ancho no prueba esos flujos.

## Acciones recomendadas

Opcionalmente, aplicar `$impeccable adapt` sólo a las cajas táctiles de los enlaces de logo descritos y cerrar con `$impeccable polish`. No hace falta otra ronda estética ni ampliar esta revisión a los contenidos anteriores del sitio. Una futura auditoría general debe tener alcance propio y verificar sus señales con nodos concretos.

Preguntas omitidas: B es una evaluación delegada; el agente principal integra A/B y cierra la conversación con Max.
