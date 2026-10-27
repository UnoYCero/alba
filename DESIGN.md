---
name: Alba Vision
description: Sistema existente del amanecer y extensión de ritmo en cinco páginas
colors:
  marino: "#0b1f3b"
  azul: "#2563eb"
  azul-claro: "#8fb2ff"
  papel: "#f4f6fa"
  noche: "#03081a"
  profundo: "#050d1c"
  tinta: "#071427"
  texto-secundario-noche: "rgba(222,231,248,.8)"
  texto-terciario-noche: "rgba(222,231,248,.62)"
  linea-noche: "rgba(143,178,255,.16)"
typography:
  display:
    fontFamily: "Hanken Grotesk, Segoe UI, Helvetica, Arial, sans-serif"
    fontSize: "clamp(44px, 5.3vw, 76px)"
    fontWeight: 300
    lineHeight: 1
    letterSpacing: "-.035em"
  headline:
    fontFamily: "Hanken Grotesk, Segoe UI, Helvetica, Arial, sans-serif"
    fontSize: "clamp(32px, 4vw, 56px)"
    fontWeight: 300
    lineHeight: 1.05
    letterSpacing: "-.03em"
  body:
    fontFamily: "Hanken Grotesk, Segoe UI, Helvetica, Arial, sans-serif"
    fontSize: "17px"
    fontWeight: 300
    lineHeight: 1.6
  label-piloto:
    fontFamily: "Hanken Grotesk, Segoe UI, Helvetica, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 300
rounded:
  recto: "0"
  superficie: "16px"
  pastilla: "999px"
spacing:
  s2: "8px"
  s3: "12px"
  s4: "16px"
  s5: "24px"
  s6: "32px"
  s7: "48px"
  s8: "64px"
  s9: "96px"
  s10: "128px"
  ritmo-capitulo: "clamp(40px, 5vw, 72px)"
  ritmo-grupo: "clamp(20px, 3vw, 36px)"
components:
  boton-solido-dia:
    backgroundColor: "{colors.marino}"
    textColor: "{colors.papel}"
    rounded: "{rounded.pastilla}"
    padding: "0 26px"
    height: "48px"
  boton-solido-noche:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.marino}"
    rounded: "{rounded.pastilla}"
    padding: "0 26px"
    height: "48px"
  dialogo-piloto:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.marino}"
    rounded: "{rounded.superficie}"
    padding: "44px"
    width: "min(620px, calc(100% - 40px))"
  campo-piloto:
    textColor: "{colors.marino}"
    rounded: "{rounded.recto}"
    padding: "8px 0"
---

# Design System: Alba Vision

## Overview

**Creative North Star: "El amanecer de Alba"**

La portada existente es la referencia: ojo, cambio de luz y puertas hacia los proyectos. Hanken ligera, papel, marino y azules sostienen una composición abierta en la que la fotografía, el instrumento y la demostración explican el trabajo. El nombre del mundo recoge el amanecer ya descrito por la guía y el código; no introduce una identidad nueva.

Registro extraído el 26-oct-2026 de la implementación. Su alcance normativo es la portada, Vision Ops, Alba Space, Alba Labs y Surface Ops, incluidas sus versiones generadas en inglés. La extensión aprobada cambia el ritmo y añade una tarjeta funcional para el piloto; conserva el mundo visual. No autoriza cambios en UNBLIND, Órbita ni sus dependencias compartidas. La estrategia de cada página y las comprobaciones de esta entrega están en [DISENO.md](docs/plan-integral/DISENO.md).

**Key Characteristics:**

- Composición abierta con el objeto y la evidencia como protagonistas.
- Voz ligera y énfasis en itálica verdadera.
- Luz de día, amanecer y noche dentro de la misma familia.
- Movimiento que explica una relación y conserva una alternativa quieta completa.

## Colors

La paleta combina el papel frío con marino y un solo acento azul, más claro sobre noche. Los valores normativos están en el encabezado; los nombres corresponden a los colores existentes, no a una paleta añadida.

### Primary

- **Azul:** enlaces, selección y énfasis sobre papel.
- **Azul claro:** énfasis y trazos explicativos sobre noche.

### Neutral

- **Papel:** fondo de día, texto y superficies de lectura sobre noche.
- **Marino:** texto de día, botón sólido de día y texto del diálogo.
- **Noche, profundo y tinta:** capas del cielo existente y fondos oscuros.
- **Texto secundario, terciario y línea de noche:** apoyos y contornos discretos del tema oscuro. Los temas de día redefinen estas variables; no usar los valores de noche sobre papel.

**The Luz Rule.** Conservar la relación papel/marino y azul/azul claro de cada tema; los cambios de luz pertenecen al mundo existente, no son permiso para añadir degradados decorativos de otros colores.

## Typography

Hanken Grotesk se sirve desde archivos locales normales e itálicos, con sustitutos Segoe UI, Helvetica y Arial. La voz aprobada es el peso ligero (300); el énfasis se hace con itálica verdadera. Los nombres vectoriales de las marcas conservan su propio dibujo.

El encabezado registra el titular actual de portada en escritorio, el título de capítulo compartido, el cuerpo y la etiqueta del piloto. No es una escala que obligue a igualar todos los titulares: cada entrada conserva su tamaño fluido. Vision Ops, Space y Surface tienen ajustes propios en `ronda24.css`; operación/despiece se compactan en `ritmo.css`. En celular la portada y las subpáginas usan sus reglas específicas. Los párrafos iniciales suelen limitarse a 36–46 caracteres; las notas admiten hasta 60.

**The Voz Rule.** Mantener Hanken 300 e itálica en la extensión; Construcción Alba se limita a la firma vectorial de Surface y no se convierte en letra de interfaz.

Hay pesos 400 heredados en algunos botones y detalles del código. Se registran como deriva respecto de la guía, sin convertirlos en nuevos tokens ni corregirlos dentro de este trabajo documental.

## Layout

El contenedor existente tiene un máximo interior de 1240 px y margen lateral fluido (`clamp(20px,4.5vw,64px)`). La escala de base cuatro permanece disponible; los capítulos de esta extensión usan `ritmo-capitulo` y las relaciones internas `ritmo-grupo`. No sumar margen, relleno y recorrido de animación como reservas independientes sin comprobar su efecto visible.

**The Altura Visible Rule.** El texto activo determina la altura de la composición. Los estados ocultos de operación/despiece salen del flujo y del teclado. El presupuesto de avance se calcula aparte; si el contenido no cabe en el espacio disponible, la sección pasa a lectura natural y no vuelve a fijarse durante esa lectura.

En los anchos de 761–1080 px, las entradas de Space y Labs conservan dos columnas iguales con separación de 32 px; en celular se reorganizan según la relación entre objeto, controles y explicación. La navegación colapsada aparece hasta 1080 px: su panel empieza debajo de la cabecera, permite desplazamiento vertical y no comprime sus enlaces. Las escenas de reporte, crecimiento y galería pasan a lectura corrida en anchos de hasta 760 px o alturas de hasta 699 px. Las restantes salidas dependen además de la medición del contenido, los estilos de cada página y la preferencia de movimiento reducido.

La tarjeta del piloto es una excepción funcional a la composición abierta. En computadora se centra; hasta 760 px se ancla abajo, ocupa el ancho y limita su altura con `100dvh`, desplazamiento interior y margen de seguridad inferior. No extender esta forma al resto de los capítulos.

## Elevation & Depth

La página abierta se articula con luz, objetos, imágenes y escala; no necesita una caja con sombra por sección. La portada conserva transparencias, velos y profundidad ya construidos. La navegación al bajar usa desenfoque y una sombra difusa; el diálogo del piloto usa una sombra propia y un fondo oscurecido para separar una tarea modal. Estas excepciones tienen una función y no establecen una regla de tarjetas generales. Los valores de sombra y movimiento se conservan en el archivo complementario.

## Shapes

Botones y navegación usan pastillas; campos y controles de capítulo tienen líneas y extremos rectos. Las imágenes de las piezas iniciales de esta entrega tienen bordes rectos, mientras otras fotografías y maquetas heredadas conservan radios suaves. El diálogo usa el radio de superficie; su hoja móvil redondea sólo las esquinas superiores. No imponer un único radio a fotografías, instrumentos, firmas y controles.

## Components

### Buttons

El botón sólido invierte papel y marino según el tema. Conserva la forma de pastilla, altura base de 48 px y respuesta breve al activar. Los enlaces de texto son discretos y mantienen foco visible; no dependen sólo del cursor. El formulario y la receta fijan explícitamente el peso ligero. Los controles manuales de paso tienen una superficie mínima de 44 px, texto y subrayado del estado activo.

### Inputs / Fields

Los campos del piloto conservan etiqueta permanente, línea inferior y fondo transparente sobre papel. Tienen altura mínima de 44 px. El foco refuerza la línea azul; el diálogo añade un contorno visible al resto de sus controles. La validación usa las restricciones nativas y ayuda persistente, con cámaras entre 1 y 50.

### Cards / Containers

La tarjeta funcional del piloto contiene tres campos, resumen y regreso a edición. Es un `dialog` con cierre, Escape, bloqueo del fondo, recorrido del foco y regreso al botón de apertura. Conserva lo escrito al reabrir durante la visita. El vínculo final prepara WhatsApp; el envío lo decide la persona. No hay un sistema general de tarjetas de contenido derivado de esta pieza.

### Navigation

La pastilla flotante se compacta al bajar y cambia con la luz. Firma hija, regreso a Alba Vision, idioma y menú comparten cabecera. En el panel móvil los enlaces empiezan debajo de ella y se pueden recorrer aunque la ventana sea baja. Surface usa el menú oficial sin sello a 40 px, reducido a 32 px hasta 360 px de ancho, con variantes de claro/oscuro y nombre accesible «Surface Ops». Su firma completa y sello se rigen por el kit, no por los tamaños de la interfaz.

### Demostraciones propias

La familia comparte la manera de explicar, no una animación repetida: puertas y luz en portada; recorrido anónimo → espera → hallazgo en Vision Ops; CubeSat → instrumento → función en Space; manual → fragmento → contexto → pregunta en Labs; foto → contorno → medidas → plano en Surface. Conservar avisos de recreación, concepto, ejemplo e ilustración junto a la pieza.

El movimiento nuevo es breve y finito, con reproducción, pausa o selección manual donde corresponde. El cambio manual conserva la elección. La versión quieta ofrece el contenido completo, controles y respaldos de imagen; en esta entrega su comprobación se limita al código. Los detalles de cada mecanismo son contratos de superficie en `docs/plan-integral/DISENO.md`, no prohibiciones globales para otros productos.

## Do's and Don'ts

### Do:

- **Do** conservar la portada y sus cambios de luz como referencia del mundo existente.
- **Do** aplicar ritmo y altura visible sólo a las cinco páginas autorizadas y sus traducciones.
- **Do** mostrar el objeto, su relación con el dato y el estado real del producto.
- **Do** conservar texto completo, foco visible, selección manual y alternativa quieta.
- **Do** respetar las proporciones y variantes originales de las firmas de marca.

### Don't:

- **Don't** convertir la excepción funcional del formulario en una sucesión de cajas para los capítulos.
- **Don't** redibujar la firma de Surface ni usar Construcción Alba en textos de interfaz.
- **Don't** heredar reservas de altura de estados ocultos ni forzar una escena fija que no cabe.
- **Don't** presentar conceptos, recreaciones o medidas ilustrativas como evidencia validada en campo.
- **Don't** usar este registro como autorización para modificar UNBLIND, Órbita o sus dependencias.
