> Actualización 26-oct-2026: capturas fuera del historial del sitio, en el [respaldo de marca](https://github.com/maxmerida77/alba-marca/blob/respaldo-plan-integral-2026-10-26/propuestas/2026-10-26-plan-integral/). Este informe conserva sus resultados anteriores; la nueva prueba visual de movimiento reducido sigue pendiente.

disposition: ship

## persistence

Pasa para el lote de cuatro correcciones de la revisión inicial. Este es un pase de veredicto limitado a esa lista; no constituye otra auditoría integral ni una certificación general del sitio. Se preserva el informe inicial íntegro en el historial inferior.

Se abrieron las recapturas sobre los mismos cuatro archivos de entrada a 1024, los menús Surface ES/EN a 320, los cuatro tableros VO y los seis estados manuales Space ES/EN. Se revisaron las reglas correspondientes de `ritmo.css` y `space.js`, `correcciones.json`, las cinco láminas regeneradas y los registros de comprobación. La matriz final tiene 50 entradas únicas, cero desborde horizontal y cero imágenes rotas. El diff consultado sigue vacío para las páginas y dependencias compartidas protegidas. `verificaciones.json` registra doce comandos con código cero; `consola.json` contiene una lista vacía. Estos registros son evidencia proporcionada por el constructor; el revisor no volvió a ejecutar esas pruebas ni utilizó navegador.

## fidelity

| Corrección de la lista inicial | Veredicto | Evidencia del resultado |
|---|---|---|
| 1. Space/Labs en el primer viewport a 1024 × 768 | resolved | Los cuatro originales `matriz-space[-en]-1024x768.jpg` y `matriz-labs[-en]-1024x768.jpg` muestran ahora CubeSat y lentes completos y reconocibles junto a texto, acciones y avisos. La regla entre 761 y 1080 px conserva dos columnas y reduce relleno; las láminas de 1440 y móvil conservan sus composiciones. |
| 2. Menú Surface a 320 × 568 | resolved | `surface-es-320-menu-oscuro.jpg` y `surface-en-320-menu-oscuro.jpg` muestran firma/cerrar separados del primer enlace de idioma. El contenido continúa por desplazamiento vertical. CSS reserva el alto de cabecera y evita que los elementos se encojan; el registro sitúa el primer enlace en y=92, después del final de cabecera en y=69.6. |
| 3. Persistencia manual de Space | resolved | Los seis originales `space-{es,en}-1440-manual-{basura,acoplamiento,aplicacion}.jpg` muestran algoritmo elegido, rango en cero con foco y observación terrestre elegida. `correcciones.json` registra retención tras ida/vuelta y espera de 75.931 s en ES y 49.990 s en EN. El código bloquea `CONTROL.basura` después del clic, conserva aplicaciones tras clic/foco/puntero y reconoce foco/puntero/teclado del rango aunque Home no cambie el valor. Las capturas acreditan el estado; la duración se sustenta en el registro y la fuente. |
| 4. Rótulos sobre las métricas del tablero VO | resolved | Las recapturas ES/EN de 1440 y 390 muestran Visitantes, Espera típica y Abandonos legibles, sin Plancha/Entrega detrás. La regla oculta `.vo-rotulos` únicamente cuando `.vo-tablero.visible` está presente; no retira rótulos de los demás estados. |

## ceiling

Las cuatro correcciones alcanzan el resultado que pedían los hallazgos. No se observan regresiones atribuibles al lote en las recapturas examinadas. Este pase no abre una búsqueda de defectos ni amplía el dictamen al resto de los estados.

## material_fixes

Ninguna pendiente de la lista de cuatro: todas están `resolved`. No hay hallazgos parciales o sin resolver en ese alcance.

## keep

Conservar personalidad de portada, Hanken 300 e itálica, avisos honestos, modelos/fotos, contorno único de Surface y formulario sin envío automático. Permanecen los límites: ventanas simuladas, espacio de teclado simulado, movimiento reducido revisado sólo en código y ausencia de prueba con GPU físicamente desactivada; no se certifica accesibilidad global ni teléfono físico.

<details>
<summary>Historial: revisión completa inicial y lista de correcciones, anterior a este lote</summary>

disposition: fix

## persistence

Pasa en el alcance de esta revisión. Existe `PRODUCT.md`. La autoridad es el plan escrito, la portada existente y el kit oficial de Surface; es una extensión mediante código, sin composición aprobada ni QUALITY BAR externa. No corresponde exigir una ronda de conceptos o una semilla para esta intervención precisamente delimitada. No existe `DESIGN.md`; la documentación posterior al dictamen sigue siendo trabajo del constructor.

Se leyeron el plan y objetivo, el producto, las reglas del kit, el piso de calidad, código principal y el diff respecto de `87e8c10`. Las páginas protegidas y las dependencias compartidas registradas en `archivos.json` no figuran modificadas en el diff examinado. `ritmo.css` e `integral.js` se incorporan únicamente en las cinco páginas autorizadas y sus traducciones.

La matriz contiene las 50 combinaciones exigidas, todos sus archivos existen y registra cero desborde horizontal e imágenes rotas. Se abrieron las cinco láminas de la matriz, láminas móviles y originales de estados y recorridos, incluidos los estados ingleses. La recaptura de `portada-es-1440-espacio.jpg` ya muestra texto, navegación, acciones y aviso completos. Se respetaron las exclusiones del paquete; las láminas que reúnen también imágenes obsoletas no se usaron para aprobar esos estados. `controles-finales.json` acredita 44 × 44 en el menú de portada ES/EN a 320; `fuentes-finales.json` registra el recálculo con fuentes pendientes y cargadas, sin desborde.

Límite: revisión de archivos y capturas, sin navegador; celular significa ventana simulada. «Menos movimiento» se revisó en código, sin prueba visual. No se certifica accesibilidad global, comportamiento en teléfono físico, rendimiento ni conversión. No se ejecutó un segundo detector ni se cambió implementación.

## fidelity

| Elemento o promesa | Estado | Evidencia y juicio |
|---|---|---|
| TYPE | match | Hanken Grotesk 300, itálica y jerarquía ligera conservadas en CSS y capturas ES/EN; las firmas usan los vectores existentes. |
| MATERIAL | match | Fotos, recreaciones y modelos existentes siguen siendo protagonistas; las nuevas líneas explican recorrido, óptica o medida. No sustituyen el objeto por decoración. |
| GROUND | match | Los valores de papel `#F4F6FA`, marino `#0B1F3B`, azul `#2563EB` y claro `#8FB2FF` continúan en fuente; el cielo oscuro y cambio de luz siguen el mundo existente. No hay composición externa para una comparación de píxeles. |
| Portada: ojo, luz y tres puertas | match | Entrada y puertas de operación/espacio conservan titular, ojo, imágenes y acciones; la recaptura espacial corrige la evidencia anterior. |
| Texto visible y ritmo | adaptation | `ritmo.css` retira los estados ocultos del flujo en operación/despiece; `integral.js` mide el contenido y separa altura del pin y presupuesto de avance. La lectura corrida móvil/baja responde a las decisiones expresas del plan. No persiste la reserva del primer titular en «El tablero». |
| VO: 0–41 y hallazgo | match | Estados 0/41, aviso de recreación, control manual y código de reproducción breve de 5.2 s; el hallazgo permanece diferenciado del fotograma auténtico. |
| VO: formulario | match | Tarjeta centrada y hoja móvil con tres campos, error nativo, resumen, edición y WhatsApp preparado. `dialog`, bloqueo del fondo, recorrido de foco, Escape nativo, regreso de foco y conservación de valores constan en código. La captura de espacio de teclado es una simulación, como declara su nombre. |
| VO: tablero y sus rótulos | contradicted | En `visionops-es-390-tablero.jpg`, Plancha/Entrega quedan detrás de las tarjetas Visitantes/Espera típica; en 1440 también se solapan rótulos y métricas. La composición no cumple la legibilidad sin superposiciones del plan. |
| Space: entrada a 1440 y móvil | adaptation | CubeSat, acercamiento al modelo y funciones aparecen en los originales; mover los controles junto a la imagen en móvil responde al plan de adaptación y conserva la relación conceptual. |
| Space y Labs: entrada a 1024 × 768 | contradicted | `matriz-space[-en]-1024x768.jpg` no muestra CubeSat ni instrumento. `matriz-labs[-en]-1024x768.jpg` apenas muestra el borde de los lentes bajo una gran zona vacía. Se pierde la demostración inmediata prometida. Las reglas de una columna desde 1080 px en `subpagina.css` explican el desplazamiento; la corrección debe quedar en estilos propios de este alcance. |
| Space: selección manual | contradicted | `CONTROL.basura` sobreescribe `vista` al avanzar la galería, aunque se haya pulsado un botón. Aplicaciones reanuda el ciclo 15 s después de un clic; el manejador vuelve a asignar `tocado = performance.now()`. Acoplamiento sólo se considera manual tras `input`, por lo que foco y Home en el extremo sin cambio no detienen el avance. Contradice «Los cambios manuales conservarán la elección del visitante». |
| Labs: objeto → fragmento → contexto → pregunta | match | El fragmento deriva de la misma imagen; estados inicial/contexto/pregunta ES/EN, continuar y reinicio tienen correspondencia entre captura y código. Los avisos de concepto y ausencia de IA funcionando siguen visibles. |
| Surface: foto → contorno → medidas → plano | match | El mismo trazado aparece en la foto y el plano, con corte y cotas 1.20 × 0.55 m coherentes; las cotas laterales son desplegables. Escala, revisión humana y profundidad experimental conservan sus avisos. |
| Surface: identidad | contradicted | Firma, variantes, iconos y piezas de compartir usan el kit y mantienen proporciones; las dos piezas para compartir se abrieron. Pero `surface-es-320-menu-oscuro.jpg` muestra «English version» encima de la firma. El menú de altura corta no deja sitio a su cabecera. |
| Verdad del producto y versión quieta | match | Se conservan desarrollo/pruebas, conceptos y recreaciones. CSS/JS proporcionan lectura corrida y respaldos sin WebGL, además de anular transiciones bajo movimiento reducido. Este juicio de la versión quieta es únicamente de código. |

## ceiling

No hay un mundo nuevo que expandir ni autoridad para rediseñar. Las piezas propias están construidas: recorrido anónimo, acercamiento óptico, recorte del manual y continuidad geométrica del bache. El techo de este encargo queda pendiente por la pérdida de los objetos protagonistas a 1024, el menú superpuesto, las selecciones que se revierten y los rótulos del tablero.

Se juzgaron los 54 avisos del detector existente contra las imágenes y la fuente; no equivalen a 54 defectos confirmados. Marcos de controles, tarjetas funcionales y efectos heredados de la portada no justifican sustituir el sistema. El range 1 × 1 de la cortina no se considera un objetivo táctil fallido: la figura completa recibe puntero, el tirador mide 44 px y el control oculto conserva teclado y foco visible. No se deriva de ello una aprobación general de contraste.

## material_fixes

1. **Primer viewport y ritmo:** resolver la composición de Space y Labs a 1024 × 768 en ES/EN para mostrar el CubeSat y los lentes reconocibles junto al texto y acción iniciales; eliminar la reserva vacía que los desplaza. Conservar los activos, la tipografía y el comportamiento móvil. Confirmar sobre los cuatro archivos `matriz-space[-en]-1024x768.jpg` y `matriz-labs[-en]-1024x768.jpg` y comprobar que 1440/móvil mantienen su composición.
2. **Identidad de Surface y pantallas bajas:** separar el contenido del menú de su cabecera fija y permitir recorrerlo cuando no quepa; «English version», firma y cerrar deben verse y poder activarse sin superposición a 320 × 568, también en EN. Limitar la regla a las páginas autorizadas, sin modificar los estilos compartidos de UNBLIND/Órbita. Confirmar `surface-es-320-menu-oscuro.jpg` y el equivalente EN.
3. **Interacción manual de Space:** mantener la elección del visitante en basura y aplicaciones hasta otra elección suya; el avance o reloj no deben sustituirla. En acoplamiento, detener el control automático al comenzar a manejar el rango con puntero o teclado, incluso si Home/End no cambia aún el valor. Confirmar selección, desplazamiento de ida/vuelta y espera superior a 15 s; registrar el valor antes/después y capturas de los mismos estados ES/EN.
4. **Legibilidad del tablero de VO:** impedir que las métricas tapen los rótulos de estaciones; reubicar o retirar los rótulos redundantes en ese estado sin perder Visitantes, Espera típica y Abandonos. Confirmar sobre `visionops-es-1440-tablero.jpg`, `visionops-es-390-tablero.jpg` y equivalente EN; conservar hallazgo y zonas en sus respectivos estados.

## keep

Conservar la portada y su luz, Hanken 300 e itálica, composición abierta, modelos y fotos protagonistas, avisos honestos, contorno único de Surface y formulario de tres campos sin envío automático; UNBLIND, Órbita y dependencias compartidas permanecen protegidas.

</details>
