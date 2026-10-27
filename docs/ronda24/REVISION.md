# Revisión final independiente · Ronda 24

## 1. Disposición

**fix** — La dirección está resuelta y las cuatro mejoras elegidas conservan la familia del sitio. Hay dos defectos concretos de adaptación que deben corregirse antes de entregar. No hace falta reconstruir la propuesta ni abrir otra dirección visual.

Lote cerrado: corregir el botón «Saltar esta parte» de Surface Ops y el ancho mínimo del configurador de Labs a 320 px. Después, confirmar esas dos correcciones en una sola ronda; actualizar las pruebas y las capturas afectadas. Esta revisión no autoriza publicar ni fusionar.

## 2. Evidencia

Revisión del 25 de octubre de 2026 sobre `mejoras-r23`, con `marca/ENCARGO.md` R24, `PRODUCT.md`, `marca/GUIA-DEL-SITIO.md`, las cuatro maquetas elegidas y el piso de calidad de Impeccable como referencia. Se usaron capturas guardadas y lectura de fuente; este revisor no abrió un navegador.

- Revisadas visualmente las cinco láminas `*-final.jpg`: portada, Vision Ops, Labs, Space y Surface Ops. Incluyen computadora, celular de 390 × 844 y celular bajo de 390 × 660. Las láminas muestran la entrada o la sección nueva correspondiente; no constituyen una captura de la página entera.
- Revisadas las diez capturas individuales en inglés de computadora y celular, además de `surface-{contorno,plano}-{computadora,celular}.jpg` y `labs-receta-respuesta-celular.jpg`.
- `medidas.json`: 40 vistas, con 1440 × 900, 390 × 844 y 390 × 660 en español e inglés, más 1024 × 768 y 320 × 568 en español. En 39 consta desborde horizontal 0; Labs a 320 registra 13 px. No registra imágenes rotas. En las vistas de celular no registra botones de menos de 44 px de alto; esta medición de altura no demuestra por sí sola 44 × 44 px ni ausencia de superposiciones.
- `interacciones.json`: nueve comprobaciones registradas de puertas, selección con teclado, receta, reinicio con devolución del foco y estados de Surface. Los estados contorno y plano se ven en las capturas correspondientes. `consola.json` está vacío; se informa como resultado del registro aportado, no como una sesión de consola independiente de este revisor.
- Surface Ops se contrastó con `surface-ops/bache-medidor/docs/ESTADO-ACTUAL.md`, sin modificarlo. La página distingue el estado en pruebas, el contorno automático falible, la escala necesaria, la descarga previa de modelos para uso sin conexión y la profundidad experimental sin comparación real en campo. Describe oficina, mapa, PDF/DXF/Excel, públicos propuestos y cierre a WhatsApp. Las capturas de la app y la imagen nueva tienen notas de ilustración o muestra.
- El único detector guardado es `detector.json`: 54 avisos. Se leyó el resultado existente; no se volvió a ejecutar.

Los avisos repetidos de transición de ancho (5), desfiles (5), rejilla (5), brillo/sombra (5), recorte (6), texto diminuto (7), separación (3), tarjetas anidadas (1) y rayado (1) proceden de reglas o secciones ya existentes en `landing.css`, `amanecer.css`, `subpagina.css`, `visionops.css` y `labs-3d.css`. Por ejemplo: `.nav-pill`, `.logos-lista`, `.floor`, `.cortina-malla`, `.vo-correo`, `.vo-rotulo` y los elementos `about`/`viz` de la portada. El detector lee también estilos compartidos que no prueban que una pieza esté visible en cada página. No deben motivar una sustitución del mundo aprobado.

Los 16 avisos de contraste requieren la misma cautela: doce se atribuyen a Vision Ops, dos a Labs y dos a Surface. El registro sólo da colores, sin selector ni estado exacto; no permite afirmar que todos sean nuevos o falsos positivos. Los de blanco sobre blanco en Surface se contrastaron con los temas y botones compartidos y no son visibles en las capturas de la entrada revisadas. El informe no certifica AA en todas las secciones y estados. Los nuevos textos y controles vistos usan la paleta aprobada y no muestran una pérdida de contraste evidente.

## 3. Fallos materiales concretos

| Prioridad | Dónde y efecto | Causa y corrección delimitada | Confirmación necesaria |
|---|---|---|---|
| P1 | Surface Ops, escena del contorno y plano a 390 × 844: «Saltar esta parte» se convierte en una pastilla vertical que ocupa casi todo el alto y se superpone a imagen y lectura. | `subpagina.css:559` asigna `top` en celular; `ronda24.css` vuelve a fijar `bottom` sin anular `top`. En la regla local de Surface, establecer `top: auto` y conservar un alto de control normal, mínimo 44 px. No modificar el botón de las otras escenas. | Volver a capturar contorno y plano en celular; medir el rectángulo del botón y confirmar que no cubra el contenido ni las opciones. Comprobar que todavía salta a oficina. |
| P2 | Labs, ancho de 320 px: el configurador modular desborda 13 px y puede recortar el último contenido de los clips. | `labs-3d.css:30` conserva `1fr` con mínimo automático y `:179–180` mantiene dos columnas y la columna interna `44px 1fr`. Permitir contracción con `minmax(0, 1fr)`, `min-width: 0` en los hijos necesarios y envoltura del texto; si no cabe, apilar los clips sólo en el ancho estrecho. | Repetir la vista de 320 px y revisar texto/controles del configurador: desborde 0, sin cortar palabras o iconos, conservando al menos 44 px de alto. Confirmar también inglés estrecho, aunque no estaba en las 40 vistas originales. |

El segundo defecto procede de componentes anteriores a R24; se incluye porque la guía exige 320 px y el registro actual lo detecta. El primero es una colisión nueva de la extensión de Surface con la regla compartida. Ambos admiten arreglo local sin tocar Órbita ni la conducta de UNBLIND.

## 4. Fortalezas

- **Portada:** las tres decisiones se entienden por su utilidad —acompañar, entender una operación, orientarse en el espacio— y ofrecen una ruta concreta. La entrada conserva la voz, el ojo y la amplitud de la marca.
- **Vision Ops:** el hallazgo de 41 segundos cuenta un caso comprensible desde la entrada. La imagen declara que es una recreación y la llamada lleva al reporte de ejemplo. La nota sobre reconocimiento facial queda visible.
- **Labs:** la receta sustituye a «Entre ver y crear» y funciona como selección manual, contexto y pregunta. El estado inicial deshabilitado tiene sentido; el reinicio devuelve el foco. Las notas evitan presentar una demostración escrita como IA real.
- **Space:** el instrumento aparece dentro de un CubeSat, con tres funciones escogibles y lenguaje de diseño. «Todavía no ha volado» y la ilustración de integración distinguen con claridad la intención de una misión real.
- **Surface Ops:** fotografía ilustrada, contorno y plano construyen una secuencia reconocible y propia del producto. El contenido expone las limitaciones donde importan y mantiene una llamada útil para probarlo. El conjunto usa Hanken Grotesk, la paleta y la composición abierta de las otras páginas.

## 5. Límites

- «Menos movimiento» se revisó **sólo en código**, tal como pidió Max. En las piezas nuevas, las puertas, la receta y la selección de misión son manuales; Surface detiene el avance por desplazamiento y muestra explicación corrida, y su salto usa desplazamiento inmediato cuando corresponde. No se afirma prueba visual de esa modalidad ni de su cambio con la página abierta.
- Se excluyen expresamente `surface-oficina-*` y cualquier `surface-sin-senal-*` como prueba visual: su encuadre no es válido. Para esas partes de la página se revisó fuente y contenido. Las capturas válidas de contorno/plano sí respaldan la interacción descrita.
- No se ejecutaron en esta revisión lector de pantalla, teléfono físico, zoom al 200 %, medición completa de contraste, pruebas de velocidad o una segunda sesión de navegador. Los resultados automáticos son los archivos aportados.
- La generación de inglés se reconoce por la fuente y las capturas; el cierre del generador, la revisión de enlaces/archivos, el commit, la subida y el PR en borrador corresponden al cierre del agente principal. El archivo generado de Órbita no muestra cambio textual en el diff leído; no se tomó como autorización para modificar su producto.
- La puntuación y disposición definitiva quedan pendientes de confirmar el lote de dos correcciones y su evidencia actualizada. No hay base para declarar ahora toda la ronda lista para publicar.
