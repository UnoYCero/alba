Los estados ocultos reservaban el espacio del texto más largo y varias escenas consumían demasiado desplazamiento. Este cambio ajusta la altura al contenido visible y combina escenas breves con lectura natural en portada, Vision Ops, Alba Space, Alba Labs y Surface Ops, en español e inglés.

**Base e integración:** parte de `mejoras-r23` (`87e8c10`, PR #48 todavía abierto y en borrador). Este PR hacia `main` incluye esa base. Para revisar sólo esta construcción: [comparación desde mejoras-r23](https://github.com/maxmerida77/alba/compare/mejoras-r23...ritmo-movimiento-integral). No hacer merge ni publicar como parte de este encargo.

## Cambios

- Altura dinámica, separación coherente y salida a lectura corrida si una escena no cabe; sin reservar el tamaño de estados ocultos.
- Portada conserva ojo, luz, identidad y tres puertas, con una respuesta discreta al elegir.
- Vision Ops: recorrido anónimo de 41 segundos mostrado en 5.2 s con pausa/exploración; formulario en tarjeta centrada u hoja móvil, tres campos, validación, resumen editable y WhatsApp preparado sin enviar.
- Space: CubeSat → instrumento con el GLB existente a demanda, funciones junto a la imagen, galería/despiece/baffle más breves y elecciones manuales persistentes.
- Labs: del manual seleccionado al fragmento de contexto y la pregunta, con continuar/reiniciar y módulos conservados.
- Surface: firma oficial clara/oscura, favicon/Apple Touch y piezas para compartir; mismo contorno de 22 vértices en foto y plano, con cotas de ejemplo coherentes. Menú móvil desplazable debajo de cabecera.
- Las entradas de Space y Labs muestran sus objetos también a 1024 px. Los rótulos de estaciones no tapan las métricas de Vision Ops.

UNBLIND y Órbita ES/EN y las dependencias compartidas protegidas no cambian respecto de la base. Se mantienen avisos de concepto, ilustración, ejemplo y desarrollo; Surface sigue en pruebas, sin pilotos ni clientes y con profundidad experimental.

## Comprobación

- 50 combinaciones: cinco páginas × dos idiomas × 1440×900, 1024×768, 390×844, 390×660 y 320×568; cero desbordes e imágenes cargadas rotas. Capturas completas por tramos y estados, no sólo entradas.
- Controles, validación y resumen del piloto, Tab/Mayús+Tab, Escape, foco de regreso, valores conservados y mensaje preparado sin enviar. Cortina tiene superficie táctil en toda la figura y tirador de 44 px; su rango de 1 px es sólo control de teclado visualmente recortado.
- Fuentes demoradas 12 s: recálculo de altura sin desborde. Respaldo sin WebGL mediante guardas del sitio.
- Inglés generado con scripts/version-en; ocho comprobaciones de sintaxis JavaScript, recursos/IDs/h1, protección, compilación y diff correctos. Consola de prueba sin avisos/errores.
- Revisión independiente completa seguida de cuatro correcciones. Dictamen `ship` limitado a esa lista, las cuatro `resolved`; no es certificación general.
- Activos nuevos: 289495 bytes sin compresión, más CSS/JS registrado; sin vídeo nuevo, nuevo GLB ni biblioteca externa. Procedencia de los rásteres de producción registrada.

**Límites:** los tamaños de celular son ventanas de navegador, no teléfonos físicos. Se simuló espacio de teclado a 390×360; no se probó un teclado móvil real. «Menos movimiento» se revisó sólo en código en la entrega anterior; la nueva revisión visual solicitada aún no se ha podido realizar. La prueba sin WebGL activa las guardas y no desactiva físicamente la GPU. No se certifica accesibilidad global, rendimiento o conversión. No se enviaron mensajes reales ni se publicó producción.

[Informe y pruebas](https://github.com/maxmerida77/alba/blob/ritmo-movimiento-integral/docs/plan-integral/LEEME.md) · [Revisión independiente](https://github.com/maxmerida77/alba/blob/ritmo-movimiento-integral/docs/plan-integral/REVISION.md) · [Índice de capturas](https://github.com/maxmerida77/alba/blob/ritmo-movimiento-integral/docs/plan-integral/CAPTURAS.md) · [Matriz completa](https://github.com/maxmerida77/alba/blob/ritmo-movimiento-integral/docs/plan-integral/matriz-entrega.json)

## Capturas y revisión pendiente

Las capturas se retiraron del historial de esta rama y se trasladaron al [respaldo de marca](https://github.com/maxmerida77/alba-marca/blob/respaldo-plan-integral-2026-10-26/propuestas/2026-10-26-plan-integral/). Ese repositorio es privado; requiere acceso.

La nueva revisión visual con `prefers-reduced-motion: reduce` en 1440×900 y 390×844 está pendiente: el control del navegador detuvo la sesión al no poder verificar con confianza la dirección de la ventana de Brave. La revisión anterior fue sólo de código y no se presenta como prueba visual.
