Implementa las cuatro mejoras elegidas de la ronda 23 y añade Surface Ops. El sitio orienta antes hacia cada producto, Vision Ops abre con un hallazgo y Labs permite recorrer un ejemplo completo.

Parte de `labs-pro` (#47, `fe14e11`) y continúa la cadena de cambios anterior hacia `main`. Este PR se entrega en borrador.

## Cambios de esta ronda

- **Vision Ops 1:** el hallazgo real de los 41 segundos desde la entrada, con recreación identificada y acceso al reporte.
- **Portada 1:** tres puertas por propósito, con imagen, estado y enlace a cada frente.
- **Labs 1:** manual → contexto → pregunta de ejemplo; reemplaza «Entre ver y crear». No ejecuta IA ni reconocimiento en vivo.
- **Space 1:** Ark Light 1 dentro de un CubeSat y tres funciones seleccionables, con estado de laboratorio y sin vuelo.
- **Surface Ops:** página ES/EN, escena foto → contorno → medidas → plano, oficina, uso sin señal, destinatarios y contacto por WhatsApp. Ilustración original, capturas de la app y dos imágenes para compartir. Requiere marcador o cinta; profundidad con IA experimental, sin comparación real de campo, pilotos ni clientes.

Se agrega Surface Ops a navegación, catálogo y sitemap. `public/orbita/` y su inglés no tienen diferencias con `labs-pro`. En UNBLIND sólo cambian enlaces; se conservan sus scripts y los compartidos.

## Verificación

Español e inglés: 1440 × 900, 390 × 844 y 390 × 660. Además, 1024 × 768 y 320 × 568 en español; el ajuste estrecho de Labs también se confirmó en inglés. Sin desborde ni imágenes rotas; botones medidos de celular de al menos 44 px y consola sin errores. Se probaron selección, teclado, receta y capas de Surface.

Pasan `npm run build`, la comprobación de sintaxis y `extraer.py` → `generar_en.py` → `revisar_en.py`. El verificador incluye Vision Ops y Surface y devuelve fallo si encuentra español.

**Menos movimiento:** revisión de código, por preferencia expresa de Max. No se acredita prueba visual de esa modalidad. Celular se comprobó con medidas de navegador, no en teléfono físico. No se enviaron mensajes ni se midió el producto en campo.

El revisor independiente dio por resueltos los dos hallazgos del lote: «Saltar» de Surface y configurador de Labs a 320 px. [Documentación y evidencia](https://github.com/maxmerida77/alba/blob/mejoras-r23/docs/ronda24/LEEME.md).

## Capturas

| Cambio | Computadora | Celular |
|---|---|---|
| Portada | ![Portada en computadora](https://raw.githubusercontent.com/maxmerida77/alba/mejoras-r23/docs/ronda24/capturas/portada-computadora.jpg) | ![Portada en celular](https://raw.githubusercontent.com/maxmerida77/alba/mejoras-r23/docs/ronda24/capturas/portada-celular.jpg) |
| Vision Ops | ![Vision Ops en computadora](https://raw.githubusercontent.com/maxmerida77/alba/mejoras-r23/docs/ronda24/capturas/visionops-computadora.jpg) | ![Vision Ops en celular](https://raw.githubusercontent.com/maxmerida77/alba/mejoras-r23/docs/ronda24/capturas/visionops-celular.jpg) |
| Labs: sección nueva | ![Receta en computadora](https://raw.githubusercontent.com/maxmerida77/alba/mejoras-r23/docs/ronda24/capturas/labs-computadora.jpg) | ![Receta en celular](https://raw.githubusercontent.com/maxmerida77/alba/mejoras-r23/docs/ronda24/capturas/labs-celular.jpg) |
| Alba Space | ![Space en computadora](https://raw.githubusercontent.com/maxmerida77/alba/mejoras-r23/docs/ronda24/capturas/space-computadora.jpg) | ![Space en celular](https://raw.githubusercontent.com/maxmerida77/alba/mejoras-r23/docs/ronda24/capturas/space-celular.jpg) |
| Surface Ops | ![Surface Ops en computadora](https://raw.githubusercontent.com/maxmerida77/alba/mejoras-r23/docs/ronda24/capturas/surfaceops-computadora.jpg) | ![Surface Ops en celular](https://raw.githubusercontent.com/maxmerida77/alba/mejoras-r23/docs/ronda24/capturas/surfaceops-celular.jpg) |

Las vistas inglesas, el teléfono bajo y las confirmaciones del revisor están en `docs/ronda24/capturas/`.
