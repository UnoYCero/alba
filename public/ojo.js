// El ojo de Alba al desplazarse. Parte de la muestra de Codex
// (marca/propuestas/2026-10-15-ojo-scroll/ojo.js) con cuatro ajustes:
//   1. Trazos suaves (trazos-suaves.js): sin escalones, con los cortes rectos.
//   2. Volumen más delgado y acabado satinado: menos «letra 3D».
//   3. La estrella se enciende al bajar: la luz que prende la página.
//   4. Three.js por el mapa de importación, la misma copia que usa el cielo.
import * as THREE from "three";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";
import { partes } from "./trazos-suaves.js";

const limitar = (n, a = 0, b = 1) => Math.min(b, Math.max(a, n));
const mezcla = THREE.MathUtils.lerp;
const suavizar = (n) => n * n * (3 - 2 * n);

function texturaBrillo() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, "rgba(255,255,255,1)");
  r.addColorStop(0.18, "rgba(200,220,255,.7)");
  r.addColorStop(1, "rgba(143,178,255,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export function montarOjo({ host = document.querySelector("[data-ojo]"), hero = document.querySelector(".hero"), origen = document.querySelector(".origen") } = {}) {
  if (!host || !hero || !origen) return null;
  const canvas = host.querySelector("canvas");
  const preferencia = matchMedia("(prefers-reduced-motion: reduce)");
  const fino = matchMedia("(pointer: fine)");
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "default" });
  } catch (error) {
    host.dataset.error = "sin-webgl";
    console.warn("Se muestra el símbolo estático: no se pudo iniciar el relieve.", error);
    return null;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.setClearColor(0x000000, 0);
  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camara.position.set(0, 0, 22);

  escena.add(new THREE.HemisphereLight(0xe8f0ff, 0x0b1f3b, 2.4));
  const luzPrincipal = new THREE.DirectionalLight(0xf4f6fa, 3.2);
  luzPrincipal.position.set(-5, 7, 9);
  escena.add(luzPrincipal);
  const borde = new THREE.DirectionalLight(0x8fb2ff, 3.4);
  borde.position.set(7, -1, 3);
  escena.add(borde);

  // Satinado: menos espejo que la muestra original, para que se lea como objeto y no como letra 3D
  const materialFrente = new THREE.MeshStandardMaterial({ color: 0xe9effa, metalness: 0.25, roughness: 0.42 });
  const materialLado = new THREE.MeshStandardMaterial({ color: 0x3d64a6, metalness: 0.35, roughness: 0.5 });
  const materialEstrella = new THREE.MeshStandardMaterial({ color: 0xb9cfff, metalness: 0.1, roughness: 0.3, emissive: 0x8fb2ff, emissiveIntensity: 0.2 });
  const materiales = [materialFrente, materialLado, materialEstrella];

  const modelo = new THREE.Group();
  const conjuntos = {};
  const geometria = [];
  const lector = new SVGLoader();
  for (const parte of partes) {
    const grupo = new THREE.Group();
    for (const d of parte.trazos) {
      const lectura = lector.parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${d}" fill="#ffffff"/></svg>`);
      for (const trayecto of lectura.paths) {
        for (const forma of SVGLoader.createShapes(trayecto)) {
          const cuerpo = new THREE.ExtrudeGeometry(forma, { depth: 2.2, bevelEnabled: true, bevelSize: 0.16, bevelThickness: 0.2, bevelSegments: 3, steps: 1, curveSegments: 6 });
          cuerpo.translate(-100, -100, -1.1);
          cuerpo.scale(0.052, 0.052, 0.052);
          const m = new THREE.Mesh(cuerpo, [parte.parte === "estrella" ? materialEstrella : materialFrente, materialLado]);
          m.scale.y = -1;
          grupo.add(m);
          geometria.push(cuerpo);
        }
      }
    }
    conjuntos[parte.parte] = grupo;
    modelo.add(grupo);
  }
  // El brillo de la estrella: crece mientras se enciende la página
  const brillo = new THREE.Sprite(new THREE.SpriteMaterial({ map: texturaBrillo(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  brillo.scale.setScalar(1.2);
  conjuntos.estrella.add(brillo);
  escena.add(modelo);

  // Recorrido de Codex: frente → tres cuartos → relieve → recogida
  const claves = [
    { p: 0, rx: 0.06, ry: -0.12, rz: -0.035, fondo: 0, ancho: 0.44, x: 0.75, y: 0.3 },
    { p: 0.24, rx: 0.19, ry: -0.6, rz: 0.015, fondo: 0.6, ancho: 0.4, x: 0.78, y: 0.26 },
    { p: 0.48, rx: -0.12, ry: -1.02, rz: 0.035, fondo: 1, ancho: 0.31, x: 0.81, y: 0.2 },
    { p: 0.7, rx: -0.04, ry: -0.22, rz: 0, fondo: 0.2, ancho: 0.19, x: 0.83, y: 0.16 },
    { p: 1, rx: 0, ry: 0.12, rz: 0, fondo: 0, ancho: 0.12, x: 0.83, y: 0.12 },
  ];
  let ancho = 1, alto = 1, fin = 1, avance = 0, objetivo = 0;
  let cuadroPendiente = 0, perdido = false, apertura = 1;
  let puntero = { x: 0, y: 0 };
  const quieto = () => preferencia.matches;
  const estado = (p) => {
    const j = Math.max(0, claves.findIndex((c, i) => i < claves.length - 1 && p >= c.p && p <= claves[i + 1].p));
    const a = claves[j], b = claves[j + 1];
    const f = suavizar(limitar((p - a.p) / (b.p - a.p)));
    return Object.fromEntries(Object.keys(a).map((k) => [k, mezcla(a[k], b[k], f)]));
  };
  function pintar() {
    if (perdido || document.hidden) return;
    const mobile = ancho <= 760;
    const p = quieto() ? 0 : avance;
    const e = estado(p);
    const alturaMundo = 2 * 22 * Math.tan(THREE.MathUtils.degToRad(16));
    const anchuraMundo = (alturaMundo * ancho) / alto;
    let x = e.x, y = e.y, fraccion = e.ancho;
    if (mobile) {
      x = 0.5;
      y = mezcla(0.16, 0.11, suavizar(limitar(p / 0.62)));
      fraccion = mezcla(0.62, 0.34, suavizar(limitar(p / 0.7)));
    }
    const escala = (anchuraMundo * fraccion) / 9.07;
    // Al abrir la página el ojo «despierta»: crece un poco y se endereza
    const despierta = suavizar(apertura);
    modelo.scale.set(escala * mezcla(0.9, 1, despierta), escala * mezcla(0.55, 1, despierta), escala);
    modelo.position.set((x - 0.5) * anchuraMundo, (0.5 - y) * alturaMundo, 0);
    modelo.rotation.set(e.rx + (quieto() ? 0 : puntero.y * 0.025), e.ry + (quieto() ? 0 : puntero.x * 0.045), e.rz);
    conjuntos.cintas.position.z = -e.fondo * 0.3;
    conjuntos.mira.position.z = e.fondo * 0.7;
    conjuntos.estrella.position.z = e.fondo * 1.5 + 0.1;
    borde.position.x = mezcla(7, -4, p);
    // La luz: la estrella pasa de apagada a encendida entre la portada y el final del origen
    const luz = quieto() ? 0.7 : suavizar(limitar(p / 0.75)) * despierta;
    materialEstrella.emissiveIntensity = mezcla(0.15, 1.6, luz);
    brillo.material.opacity = mezcla(0.05, 0.9, luz);
    brillo.scale.setScalar(mezcla(1, 3.6, luz));
    const desaparicion = quieto()
      ? 1 - suavizar(limitar(scrollY / Math.max(alto, hero.offsetHeight)))
      : 1 - suavizar(limitar((objetivo - 0.77) / 0.23));
    host.style.opacity = String(desaparicion);
    host.style.visibility = desaparicion > 0.005 ? "visible" : "hidden";
    renderer.render(escena, camara);
    host.dataset.listo = "true";
  }
  function paso() {
    cuadroPendiente = 0;
    if (perdido || document.hidden) return;
    avance = quieto() ? objetivo : mezcla(avance, objetivo, 0.22);
    if (Math.abs(avance - objetivo) < 0.0003) avance = objetivo;
    pintar();
    if (!quieto() && avance !== objetivo) pedir();
  }
  function pedir() {
    if (!cuadroPendiente && !document.hidden) cuadroPendiente = requestAnimationFrame(paso);
  }
  function alBajar() { objetivo = limitar(scrollY / fin); pedir(); }
  function ajustar() {
    ancho = host.clientWidth;
    alto = host.clientHeight;
    if (!ancho || !alto) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, ancho <= 760 ? 1.25 : 1.5));
    renderer.setSize(ancho, alto, false);
    camara.aspect = ancho / alto;
    camara.updateProjectionMatrix();
    fin = Math.max(alto, origen.offsetTop + origen.offsetHeight - alto);
    alBajar();
  }
  function alPuntero(e) {
    if (!fino.matches || quieto() || objetivo >= 1) return;
    puntero = { x: (e.clientX / ancho) * 2 - 1, y: (e.clientY / alto) * 2 - 1 };
    pedir();
  }
  new ResizeObserver(ajustar).observe(host);
  addEventListener("scroll", alBajar, { passive: true });
  addEventListener("resize", ajustar, { passive: true });
  addEventListener("pointermove", alPuntero, { passive: true });
  preferencia.addEventListener("change", () => { avance = objetivo; pedir(); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { avance = objetivo; pedir(); } });
  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); perdido = true; host.dataset.listo = "false"; });
  canvas.addEventListener("webglcontextrestored", () => { perdido = false; ajustar(); });
  document.fonts?.ready.then(ajustar);
  ajustar();

  return {
    // La apertura de ojos de la portada mueve este valor de 0 a 1
    despertar(duracion = 1600) {
      if (quieto()) { apertura = 1; pedir(); return; }
      apertura = 0;
      const t0 = performance.now();
      const tic = (ahora) => {
        apertura = limitar((ahora - t0) / duracion);
        pintar();
        if (apertura < 1) requestAnimationFrame(tic);
      };
      requestAnimationFrame(tic);
    },
  };
}
