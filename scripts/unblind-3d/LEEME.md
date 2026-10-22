# El modelo 3D de UNBLIND en la web

`public/assets/unblind/lentes.glb` es el modelo de los lentes UNBLIND que se ve en la sección
«Por dentro» de `/unblind/` (código en `public/unblind-3d.js` y `public/unblind-3d.css`).

## De dónde sale

De la ronda 11 de marca (Codex, 22-oct-2026), única versión vigente:
`marca/propuestas/2026-10-21-unblind-lentes/diseno-elegido/fase-b/unblind.glb`
(repo privado `maxmerida77/alba-marca`). Es una **propuesta de diseño**: en el sitio va
marcada como «Ilustración».

El original pesa 15 MB (628 690 triángulos, casi todos en los aros). Para la web se aligeró
a 674 KB sin cambios visibles (comparado con la misma cámara, de 3/4 y de frente) y
conservando los nombres de las 80 mallas y su `extras.pieza` (12 conjuntos), que usa el despiece:

```bash
npx @gltf-transform/cli@4.1.1 weld unblind.glb 1-soldado.glb
npx @gltf-transform/cli@4.1.1 simplify 1-soldado.glb 2-simple.glb --ratio 0.1 --error 0.0003
npx @gltf-transform/cli@4.1.1 meshopt 2-simple.glb lentes.glb --level medium
```

El resultado usa `EXT_meshopt_compression`: en la página se carga con el `MeshoptDecoder` de
Three.js (0.160.0, por importmap).

## Las imágenes de respaldo

`lentes-armados.webp` (mientras carga el 3D o si el teléfono no puede con él) y
`lentes-despiece.webp` (con «menos movimiento» o sin JavaScript) son `armado-34.png` y
`despiece.png` de la misma entrega, reducidas a 1400 px de ancho en WebP.

## El despiece

Los desplazamientos de cada conjunto (`SEPARACION` en `unblind-3d.js`) son los mismos que usó
`generar.py` de la ronda 11 para su imagen `despiece.png` (en mm, ejes de Blender, convertidos
a los de glTF), con la cámara y el LiDAR un poco más arriba para que se lean.
