# Revisión Impeccable · síntesis de la ronda 10

**Integración aprobada para el alcance de marca.** Se conservaron las
composiciones de las páginas y la forma de los símbolos; se cambiaron los
recursos de identidad y sus cajas de presentación. No es una auditoría general
de los productos ni de sus servicios de producción.

## Dos evaluaciones independientes

- A: revisión visual propia, sin detector ni informe B. Heurísticas aplicables:
  **20/24**. `IMPECCABLE-VISUAL.md` conserva las diez heurísticas, carga cognitiva,
  evidencia y límites. No identificó una regresión nueva P0/P1 por el logo.
- B: inspección técnica y navegador propios, sin informe A. El detector se ejecutó
  una sola vez, después de que A terminara. `IMPECCABLE-TECNICO.md` documenta la
  auditoría: **sitio 19/20, Vision Ops 18/20 y Surface Ops 18/20**, acotada a marca.

El detector produjo 26 registros, todos en los tres HTML del sitio: 23 avisos y
3 orientaciones. Se clasificaron como previos, contextuales o falsos positivos;
no se convirtieron automáticamente en defectos nuevos de los logos. TSX: 0
registros. JSON original: `b-detector.json`. No se repitió el detector.

## Correcciones y confirmación

Quedaron corregidos el salto de EN a ES al pulsar el logo, el tamaño de logo
móvil/pie de Vision Ops y los controles de 44 px de Labs a 320. A continuación
se ampliaron también las cajas de marca de Vision Ops y Surface Ops a **44 px**,
sin aumentar el arte: resuelve las dos observaciones menores P3 de B. La matriz
final del agente principal añade la comprobación de esas cajas y conserva los
resultados en `vision/navegador.json` y `surface/navegador.json`. Las puntuaciones
del informe independiente no se recalificaron retroactivamente.

Las observaciones del maestro raster de UNBLIND son heredadas: se documentan en
el kit y no se redibujó sin un maestro autorizado de mayor resolución.

## Alcance y límites

Chrome automatizado en escritorio y celular emulado. La matriz principal prueba
1440, 1024, 390, 320 y un teléfono bajo de 390 × 660. Sitio: diez rutas ES/EN;
Vision Ops: portada ES/EN, login y consola con una API ficticia de lectura local;
Surface: claro y oscuro. A y B aportan contextos y capturas adicionales propias.
Las 56 pruebas de portada y cabeceras de Vision Ops ejercitan también movimiento
normal, movimiento reducido, teclado, toque y arrastre.

El sitio registra seis casos con incidencias en superficies **sin cambios**:
portada madre ES/EN (desborde móvil y botón estrecho en 320) y Alba Space ES/EN
(botón estrecho en 320). Se conservaron por la exclusión expresa del encargo;
las treinta combinaciones de las páginas modificadas pasan. No hubo errores de
página ni recursos HTTP 4xx en las cincuenta combinaciones del sitio.

No se probó lector de pantalla, teléfono físico, instalación/actualización de
PWA en un teléfono, impresión, cuentas reales ni cachés de redes sociales.
No se declara cumplimiento WCAG completo ni se asigna una puntuación Lighthouse.

## Notas de ejecución

No se creó una carpeta nueva en la raíz del taller: los informes y capturas
quedan dentro de esta entrega, en `kit-final/revision/`. El IAB rechazó la
mutación en el preflight; no hubo superposición del detector ni servidor de
superposición. La guía pedía Playwright con Chrome y ésa fue la herramienta de
las matrices. Los contextos de navegador propios se cerraron. Los servidores
locales de prueba se detienen al cerrar la entrega; no se despliega ni mergea.

Preguntas omitidas: Max ya fijó A1 + L0 y el alcance de implementación; no hay
una decisión visual pendiente para abrir los tres PR en borrador.
