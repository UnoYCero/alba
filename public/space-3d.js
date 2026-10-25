// Alba Space: el Star Tracker Ark Light 1 en 3D, en dos lugares de la página.
// 1) «Por dentro»: guiado por el avance de la sección, se abre en sus piezas y resalta una a una.
// 2) El baffle: se despliega y se pliega con su botón, con las guías, los resortes y los bujes.
// El modelo es la propuesta de diseño de la ronda 14 de marca (Codex): una ilustración, no CAD
// ni medidas del instrumento. assets/space/star-tracker.glb trae los 12 conjuntos con
// extras.pieza; star-tracker-animacion.json, el despiece y el despliegue en mm.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const limitar = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const tramo = (p, a, b) => limitar((p - a) / (b - a));
const suave = (x) => x * x * (3 - 2 * x);

// El modelo se pide una sola vez para las dos escenas
let pedido = null;
const cargar = (base) => (pedido ||= (() => {
  const cargador = new GLTFLoader();
  cargador.setMeshoptDecoder(MeshoptDecoder);
  return Promise.all([cargador.loadAsync(`${base}star-tracker.glb`), fetch(`${base}star-tracker-animacion.json`).then((r) => r.json())]);
})());

// El control de los estados es el que entregó Codex (integracion.js): parte siempre del armado,
// así que el despiece y el despliegue nunca se suman.
function controlar(raiz, conf) {
  const piezas = {}, auxiliares = [], iniciales = new Map();
  raiz.traverse((o) => {
    iniciales.set(o, { posicion: o.position.clone(), escala: o.scale.clone(), visible: o.visible });
    if (o.userData.pieza) piezas[o.userData.pieza] = o;
    if (o.userData.animacion_tipo) auxiliares.push(o);
  });
  function estado(modo = "armado", progreso = 1) {
    const t = limitar(progreso);
    for (const [o, a] of iniciales) { o.position.copy(a.posicion); o.scale.copy(a.escala); o.visible = a.visible; }
    const tabla = modo === "despiece" ? conf.despiece_mm : modo === "desplegado" ? conf.baffle_despliegue_mm : {};
    for (const [n, mm] of Object.entries(tabla)) {
      const o = piezas[n];
      if (o) { o.position.x += mm[0] * 0.001 * t; o.position.y += mm[1] * 0.001 * t; o.position.z += mm[2] * 0.001 * t; }
    }
    if (modo === "desplegado") for (const o of auxiliares) {
      const u = o.userData;
      if (u.animacion_tipo === "seguir") o.position.y += u.delta_y_mm * 0.001 * t;
      else if (u.animacion_tipo === "estirar") o.scale.y *= 1 + (t * u.delta_y_mm) / u.altura_inicial_mm;
      else if (u.animacion_tipo === "ocultar") o.visible = t <= 0.1;
    }
    raiz.updateMatrixWorld(true);
  }
  return { piezas, estado };
}

// Lo que resalta cada paso de «Por dentro» (los demás quedan tenues)
const RESALTA = {
  computadora: ["computadora"], sensor: ["sensor"], optica: ["optica"],
  baffle: ["baffle-1", "baffle-2", "baffle-3", "baffle-4"], liberacion: ["liberacion"], bujes: ["bujes"],
};

export function montarStarTracker({ contenedor, lienzo, base, modo, pasos = [], alPaso, reducir = false }) {
  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  const scene = new THREE.Scene();
  // Sobre el cielo de noche: un estudio tenue para los reflejos, luz principal fría y una luz
  // de contorno azul que separa el marino del fondo
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  scene.add(new THREE.HemisphereLight(0xcfdcff, 0x050d1c, 0.8));
  const principal = new THREE.DirectionalLight(0xffffff, 2.4); principal.position.set(-0.4, 0.9, 0.6); scene.add(principal);
  const contorno = new THREE.DirectionalLight(0x8fb2ff, 3.2); contorno.position.set(0.5, 0.4, -0.9); scene.add(contorno);
  const camara = new THREE.PerspectiveCamera(28, 1, 0.005, 10);

  let raiz = null, control = null, materiales = {}, cajaArmado = null, cajaAbierta = null;
  let objetivo = 0, avance = 0, cuadro = 0, visible = true, giro = 0, arrastre = null;
  let despliegue = 0, metaDespliegue = 0;
  let centroVisto = null, distVista = 0; // la cámara llega suave a cada encuadre
  const t0 = performance.now();

  function ajustar() {
    const { clientWidth: w, clientHeight: h } = contenedor;
    if (!w || !h) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, w < 700 ? 1.6 : 1.75));
    renderer.setSize(w, h, false);
    camara.aspect = w / h; camara.updateProjectionMatrix();
  }
  // La distancia a la que cabe una caja, según el campo de visión y la forma de la pantalla
  const distanciaPara = (caja) => {
    const r = caja.getSize(new THREE.Vector3()).length() / 2;
    const fov = THREE.MathUtils.degToRad(camara.fov) / 2;
    return (r / Math.sin(Math.min(fov, Math.atan(Math.tan(fov) * camara.aspect)))) * 1.04;
  };

  function pintar() {
    if (!control) return;
    const s = (performance.now() - t0) / 1000;
    let centro, dist;
    if (modo === "despiece") {
      const n = Math.max(pasos.length, 1);
      const abre = suave(tramo(avance, 1 / n, 2 / n));
      control.estado("despiece", abre);
      const indice = Math.min(n - 1, Math.floor(avance * n));
      const resalta = RESALTA[pasos[indice]];
      for (const [nombre, lista] of Object.entries(materiales)) {
        const tenue = resalta && !resalta.includes(nombre);
        for (const m of lista) {
          m.opacity += ((tenue ? 0.26 : 1) - m.opacity) * 0.15;
          m.depthWrite = m.opacity > 0.9;
        }
      }
      alPaso?.(pasos[indice]);
      centro = cajaArmado.getCenter(new THREE.Vector3()).lerp(cajaAbierta.getCenter(new THREE.Vector3()), abre);
      dist = THREE.MathUtils.lerp(distanciaPara(cajaArmado), distanciaPara(cajaAbierta), abre);
      // La pieza que se explica: la cámara se acerca a ella, sin perder de vista el resto
      if (resalta) {
        const caja = new THREE.Box3();
        resalta.forEach((nombre) => control.piezas[nombre] && caja.expandByObject(control.piezas[nombre]));
        if (!caja.isEmpty()) {
          centro = centro.clone().lerp(caja.getCenter(new THREE.Vector3()), 0.7);
          dist = Math.max(distanciaPara(caja) * 1.5, dist * 0.42);
        }
      }
    } else {
      despliegue += (metaDespliegue - despliegue) * (reducir ? 1 : 0.06);
      control.estado("desplegado", suave(despliegue));
      centro = cajaArmado.getCenter(new THREE.Vector3()).lerp(cajaAbierta.getCenter(new THREE.Vector3()), suave(despliegue));
      dist = distanciaPara(cajaAbierta) * 0.92;
    }
    if (!centroVisto) { centroVisto = centro.clone(); distVista = dist; }
    centroVisto.lerp(centro, reducir ? 1 : 0.08);
    distVista += (dist - distVista) * (reducir ? 1 : 0.08);
    centro = centroVisto; dist = distVista;
    // Se mira a 3/4, un poco desde arriba, con una vuelta lenta; se puede girar arrastrando
    const az = 0.75 + giro + (reducir ? 0 : Math.sin(s * 0.2) * 0.12);
    const el = 0.42;
    camara.position.set(centro.x + Math.sin(az) * Math.cos(el) * dist, centro.y + Math.sin(el) * dist, centro.z + Math.cos(az) * Math.cos(el) * dist);
    camara.lookAt(centro);
    renderer.render(scene, camara);
  }
  function bucle() {
    cuadro = 0;
    avance = reducir ? objetivo : avance + (objetivo - avance) * 0.12;
    pintar();
    if (visible) cuadro = requestAnimationFrame(bucle);
  }
  const pedir = () => { if (!cuadro && visible) cuadro = requestAnimationFrame(bucle); };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) pedir(); }, { rootMargin: "100px" }).observe(contenedor);
  // Se mide cada vez que cambia el contenedor, también cuando pasa de oculto a visible: el
  // baffle arranca con display:none y, medido entonces, se quedaba en un lienzo de 300 × 150
  new ResizeObserver(() => { ajustar(); pintar(); }).observe(contenedor);

  // Girar arrastrando de lado; en celular la página sigue bajando con el dedo
  lienzo.style.touchAction = "pan-y";
  lienzo.addEventListener("pointerdown", (e) => { arrastre = { x: e.clientX, giro }; lienzo.setPointerCapture(e.pointerId); });
  lienzo.addEventListener("pointermove", (e) => { if (arrastre) { giro = arrastre.giro + (e.clientX - arrastre.x) / 160; pedir(); } });
  const soltar = () => { arrastre = null; };
  lienzo.addEventListener("pointerup", soltar);
  lienzo.addEventListener("pointercancel", soltar);

  ajustar();
  const listo = cargar(base).then(([gltf, conf]) => {
    raiz = gltf.scene.clone(true);
    if (modo === "despiece") {
      // Cada pieza con sus propios materiales, para dejar tenues las que no se explican
      for (const [nombre, nodo] of Object.entries(controlar(raiz, conf).piezas)) {
        materiales[nombre] = [];
        nodo.traverse((o) => {
          if (!o.isMesh) return;
          o.material = o.material.clone();
          o.material.transparent = true;
          materiales[nombre].push(o.material);
        });
      }
    }
    scene.add(raiz);
    control = controlar(raiz, conf);
    control.estado(modo === "despiece" ? "despiece" : "desplegado", 1);
    cajaAbierta = new THREE.Box3().setFromObject(raiz);
    control.estado("armado");
    cajaArmado = new THREE.Box3().setFromObject(raiz);
    pedir();
  });

  return {
    listo,
    avanzar(p) { objetivo = limitar(p); pedir(); },
    desplegar(si) { metaDespliegue = si ? 1 : 0; pedir(); },
    // Cuánto está desplegado (0 → 1), para seguir el scroll
    fijar(k) { metaDespliegue = limitar(k); pedir(); },
  };
}
