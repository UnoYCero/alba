> Actualización 26-oct-2026: capturas fuera del historial del sitio, en el [respaldo de marca](https://github.com/maxmerida77/alba-marca/blob/respaldo-plan-integral-2026-10-26/propuestas/2026-10-26-plan-integral/). Este informe conserva sus resultados anteriores; la nueva prueba visual de movimiento reducido sigue pendiente.

# Comprobaciones del plan integral

26 de octubre de 2026. La revisión independiente y su dictamen se registran en `REVISION.md`.

| Compromiso | Implementación y evidencia |
|---|---|
| Cinco páginas, portada conservada | `ritmo.css` e `integral.js` se cargan sólo en las cinco páginas autorizadas. La portada conserva ojo, luz y contenido; las tres puertas tienen respuesta breve. Capturas `portada-es-1440-operaciones.jpg` y `portada-es-1440-espacio.jpg`. |
| Altura del texto visible | Operación de Vision Ops y despiece de Space con controles manuales; el texto inactivo sale de composición y del teclado. `pasos-visionops.json`: el bloque inicial mide 354.79 px a 390 px y los estados breves 90.85–114.88 px; no heredan su reserva. Capturas `visionops-es-390-tablero.jpg`, estados de despiece y salidas. |
| Ritmo y salidas | Altura visible medida aparte del presupuesto de avance; salida a lectura corrida si la composición deja de caber, al redimensionar o en pantallas bajas. Se revisaron las cuatro fases del reporte y crecimiento, tres misiones, despiece y baffle; capturas por tramos y estados. |
| Hallazgo de Vision Ops | Recorrido anónimo y contador 0→41 en 5.2 s; pausa/reproducción y deslizador. Fotograma identificado como recreación. Capturas `visionops-es-1440-momento-0.jpg` y `-momento-41.jpg`. |
| Piloto | Diálogo centrado / hoja móvil; tres campos, validación de cámaras 1–50, resumen, editar, reapertura y valores conservados. Escape, cerrar, clic fuera, vuelta del foco y ciclo Tab/Mayús+Tab comprobados. Mensaje de WhatsApp preparado con tres cámaras, sin abrir ni enviar mensajes reales. Capturas de formulario, error y resumen ES/EN. |
| Teclado móvil | Reducción del espacio disponible a 390×360: diálogo desplazable de 348 px y campo de cámaras visible con 44 px. Captura `visionops-es-390-espacio-teclado-simulado.jpg`. Es simulación de espacio, no prueba con teléfono físico ni teclado de un sistema móvil. |
| Space | Acercamiento CubeSat→instrumento reutiliza GLB existente a demanda; tres funciones visuales. Elegir función abre instrumento y en celular los controles quedan junto a la imagen. Números y estado del diseño conservados. Capturas `space-es-1440-instrumento-*.jpg`, `space-es-390-aproximacion.jpg` y variantes EN. |
| Labs | Fragmento recortado de la misma imagen del manual seleccionado; contexto→pregunta, continuar y reiniciar. Módulos y configurador conservados. Capturas de receta ES/EN, módulo y configuración. Demostración manual, no IA operativa. |
| Surface | Firma y variantes oficiales, tamaños 40/32 px, favicon y Apple Touch propios. Dos imágenes para compartir de 1200×630 con firma completa. Foto y plano usan exactamente el mismo contorno de 22 vértices y dimensiones exteriores de ejemplo. Detalle A–V ilustrativo; escala, revisión humana y profundidad experimental visibles. |
| ES/EN y cinco tamaños | `matriz-entrega.json`: 50 combinaciones, todas sin desborde horizontal ni imágenes cargadas rotas. Capturas individuales y láminas por medida. El escáner de controles conserva hallazgos brutos; la excepción de cortina es un control de teclado visualmente recortado con superficie táctil en toda la figura y tirador de 44 px. `controles-finales.json` registra comprobaciones posteriores. |
| Fuente todavía cargando | `fuentes-finales.json`: servidor de pruebas demora WOFF2 12 s. Sin desborde antes/después; los pins pasan de 638 a 697 px y sus secciones crecen los mismos 59 px, sin perder presupuesto de avance. |
| Ausencia de WebGL | Servidor de pruebas añade `data-webgl="off"`, activa guardas reales de carga y permite revisar lectura/fotografía de respaldo. No se desactivó físicamente la GPU del equipo. |
| Menos movimiento | Revisión de CSS/JS: ausencia de animación automática nueva, lectura completa, estados finales y controles manuales; imagen del instrumento como respaldo. No se realizó emulación ni prueba visual de esta preferencia, por elección de Max. |
| Protección | `archivos.json`: cero cambios respecto de `87e8c10` en UNBLIND y Órbita ES/EN, `subpagina.css/js`, `landing.css` y `amanecer.css`. La generación inglesa conserva sus archivos. No se modificaron maestros de marca. |
| Verificaciones de entrega | Inglés generado y revisado, sintaxis JavaScript, recursos/IDs/h1 y `npm run build`. Consola de la pestaña de pruebas registrada. Detector Impeccable ejecutado una vez; 54 avisos se entregan al revisor con su contexto heredado. No es certificación global de accesibilidad ni medición de conversión. |

## Alcance de la evidencia

Los tamaños son ventanas CSS de navegador: 1440×900, 1024×768, 390×844, 390×660 y 320×568. Las páginas completas se capturan por tramos porque este navegador no admite captura larga. Las láminas son índices; los JPEG individuales son la evidencia de lectura.

`medidas.json`, `medidas-finales.json` y `fuentes.json` conservan el historial anterior a los últimos ajustes. Para el resultado de entrega mandan `matriz-entrega.json`, `fuentes-finales.json`, las comprobaciones posteriores y el dictamen independiente. Se excluyen mediante `.gitignore` las exploraciones inválidas y los tramos sustituidos; no se presentan como prueba final.

No se hicieron cambios de producción, envíos de WhatsApp ni merge de PR.
