# Capturas fuera del historial del PR 49

26-oct-2026. Se trasladaron 270 imágenes (17640798 bytes) desde este directorio a `marca/propuestas/2026-10-26-plan-integral/`, preservando sus bytes y verificando SHA-256 antes y después. El [inventario](https://github.com/maxmerida77/alba-marca/blob/respaldo-plan-integral-2026-10-26/propuestas/2026-10-26-plan-integral/traslado.json) y las imágenes están en el respaldo privado de marca, rama `respaldo-plan-integral-2026-10-26`. Su visualización requiere acceso a ese repositorio.

El informe del sitio sólo conserva Markdown y JSON. Las dos herramientas auxiliares pasan a `scripts/plan-integral/`. La regla de exclusión del informe pasa al `.gitignore` de la raíz. Sus enlaces de imágenes apuntan al respaldo o se retiraron de la descripción del PR.

Los commits de `ritmo-movimiento-integral` se reconstruyen desde `87e8c10` con el mismo contenido de `public/` de `dd03321`, sin incluir imágenes del informe. El envío forzado se limita a `fork:refs/heads/ritmo-movimiento-integral`, con comprobación de su cabeza anterior. No se modifican las ramas `main`, no se hace merge y no se publica.

## Revisión visual pendiente

La petición actual sustituye la restricción anterior de comprobar movimiento reducido sólo en código. La emulación y el recorrido visual de las cinco páginas a 1440×900 y 390×844 siguen pendientes: el control de UI se detuvo porque no pudo verificar con suficiente confianza la URL de la ventana de Brave. No se utilizó otro mecanismo para eludir ese bloqueo y no se aplicaron correcciones visuales sin poder comprobarlas.

Inglés, recursos/IDs/h1 y compilación volvieron a pasar tras mover las herramientas. Eso acredita la limpieza del informe; no acredita la nueva prueba visual de `prefers-reduced-motion`.
