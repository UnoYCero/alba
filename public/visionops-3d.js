// Vision Ops: la operación vista desde arriba, guiada por el avance de la sección (0 → 1).
// Sobre la escena se encienden capas, una tras otra: lo que se detecta, los recorridos, las zonas
// y sus tiempos, el mapa de calor, el hallazgo y el tablero (el tablero es HTML, en visionops.js).
// Las tres escenas (restaurante, almacén, línea de producción) son de la ronda 13 de marca (Codex):
// assets/visionops/<escena>.glb, con sus zonas (userData.zona), lo que se mueve (userData.movil) y
// sus caminos (<escena>-caminos.json). Las personas son siempre puntos anónimos: nunca caras.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

const limitar = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const tramo = (p, a, b) => limitar((p - a) / (b - a));
const suave = (x) => x * x * (3 - 2 * x);

// Las etapas, en el avance de la sección (las mismas que el texto de visionops.js)
export const ETAPAS = ["inicio", "detecta", "recorridos", "zonas", "patrones", "hallazgo", "tablero"];
const etapaEn = (p) => Math.min(ETAPAS.length - 1, Math.floor(p * ETAPAS.length));

// Lo que pasa en cada escena: la zona del hallazgo, cuántas personas por camino y qué camino
// sigue cada cosa que se mueve. Los caminos son de demostración (los de Codex), no trazas reales.
const ESCENAS = {
  restaurante: { foco: "fila", personas: { "fila-y-caja": 4, "acceso-comedor": 3, "pasillo-cocina": 2 }, moviles: { charola: "traslado-charola" } },
  almacen: { foco: "recepcion", personas: { "recorrido-empaque": 3 }, moviles: { montacargas: "montacargas-pasillo-frontal" } },
  linea: { foco: "estacion-3", personas: { "pasillo-frontal": 2, "pasillo-estaciones": 3, "acceso-estaciones": 2 }, moviles: { pieza: "flujo-banda", carrito: "carritos-salida" } },
};
export const ESCENAS_NOMBRES = Object.keys(ESCENAS);
// Hacia dónde mira cada vehículo en sus propios ejes (montaje.json de la ronda 13)
const FRENTE = { montacargas: "-z", carrito: "+x", pieza: "+x" };

// Una polilínea: posición y dirección según la distancia recorrida
export function linea(puntos) {
  const pts = puntos.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const largos = [0];
  for (let i = 1; i < pts.length; i++) largos.push(largos[i - 1] + pts[i].distanceTo(pts[i - 1]));
  const total = largos[largos.length - 1];
  return { total, en(d) {
    d = limitar(d, 0, total);
    let i = 1;
    while (i < largos.length - 1 && largos[i] < d) i++;
    const k = (d - largos[i - 1]) / ((largos[i] - largos[i - 1]) || 1);
    return { p: pts[i - 1].clone().lerp(pts[i], k), dir: pts[i].clone().sub(pts[i - 1]).normalize() };
  } };
}
// Ida y vuelta con pausa en cada extremo y frenando al llegar: la distancia en el tiempo t
export function idaYVuelta(total, velocidad, pausa, t) {
  const viaje = total / velocidad, ciclo = 2 * (viaje + pausa);
  let s = ((t % ciclo) + ciclo) % ciclo;
  if (s < viaje) return { d: suave(s / viaje) * total, ida: true };
  s -= viaje;
  if (s < pausa) return { d: total, ida: true };
  s -= pausa;
  if (s < viaje) return { d: (1 - suave(s / viaje)) * total, ida: false };
  return { d: 0, ida: false };
}

// El mapa de calor: dónde pasan más tiempo las personas y las cosas (más tiempo, más calor)
function mapaDeCalor(rutas) {
  const W = 400, H = 240, c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  g.globalCompositeOperation = "lighter";
  for (const { l, peso } of rutas) {
    for (let d = 0; d <= l.total; d += 0.12) {
      const { p } = l.en(d), x = ((p.x + 10) / 20) * W, y = ((p.z + 6) / 12) * H;
      const r = 14, grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, `rgba(37,99,235,${0.035 * peso})`); grad.addColorStop(1, "rgba(37,99,235,0)");
      g.fillStyle = grad; g.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function montarOperacion({ escena: contenedor, lienzo, alAvance, reducir = false, base }) {
  const celular = matchMedia("(max-width: 760px)").matches;
  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  // Luz de día suave (cielo claro arriba, piso que rebota) y un sol alto que deja las sombras de
  // contacto: los modelos no traen oclusión horneada
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd9e1ee, 2));
  const sol = new THREE.DirectionalLight(0xffffff, 2.4);
  sol.position.set(-6, 18, 9); sol.castShadow = true;
  sol.shadow.mapSize.set(celular ? 1024 : 2048, celular ? 1024 : 2048);
  Object.assign(sol.shadow.camera, { left: -13, right: 13, top: 10, bottom: -10, near: 1, far: 40 });
  sol.shadow.radius = 5; sol.shadow.bias = -0.0005; sol.shadow.normalBias = 0.02;
  scene.add(sol);

  // La cámara ortográfica del montaje aprobado: desde [19, 32, 26] hacia el centro, 29.8 m de ancho
  // en 3:2. En otros formatos se amplía el campo; nunca se estira el modelo.
  const camara = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
  const POSICION = new THREE.Vector3(19, 32, 26), OBJETIVO = new THREE.Vector3(0, 0.2, 0);
  const ESQUINAS = [-10.3, 10.3].flatMap((x) => [-6.3, 6.3].flatMap((z) => [0, 1.4].map((y) => new THREE.Vector3(x, y, z))));
  let zoomBase = 1;

  const cargador = new GLTFLoader();
  cargador.setMeshoptDecoder(MeshoptDecoder);
  const cache = {};
  const cargar = (nombre) => (cache[nombre] ||= Promise.all([
    cargador.loadAsync(`${base}${nombre}.glb`),
    fetch(`${base}${nombre}-caminos.json`).then((r) => r.json()),
  ]));

  const MAX_AGENTES = 24, RASTRO = 70;
  let actual = null, avance = 0, objetivo = 0, cuadro = 0, visible = true;
  const t0 = performance.now();

  function construir(nombre, [gltf, caminos]) {
    if (actual) scene.remove(actual.grupo);
    const conf = ESCENAS[nombre];
    const grupo = new THREE.Group();
    const modelo = gltf.scene;
    const zonas = {}, moviles = [];
    modelo.traverse((o) => {
      if (o.userData.movil) moviles.push(o);
      if (!o.isMesh) return;
      if (o.userData.zona) {
        // Las zonas vienen invisibles (alfa cero): cada una con su material, para encenderla sola
        if (!o.userData.borde) {
          o.material = o.material.clone();
          Object.assign(o.material, { transparent: true, alphaTest: 0, opacity: 0, depthWrite: false });
          o.material.color.set(0x2563eb);
          o.material.needsUpdate = true;
          const borde = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry), new THREE.LineBasicMaterial({ color: 0x2563eb, transparent: true, opacity: 0 }));
          borde.position.y = 0.004; o.add(borde);
          o.userData.borde = borde;
        }
        o.castShadow = false; o.receiveShadow = false;
        zonas[o.userData.zona] = { m: o, borde: o.userData.borde, centro: o.getWorldPosition(new THREE.Vector3()) };
      } else {
        o.castShadow = true; o.receiveShadow = true;
      }
    });
    grupo.add(modelo);

    // Los caminos por nombre, y quién sigue cada uno
    const rutas = Object.fromEntries(caminos.recorridos.map((r) => [r.id, linea(r.puntos)]));
    const agentes = [], calor = [];
    for (const [id, cuantos] of Object.entries(conf.personas)) {
      const l = rutas[id];
      if (!l) continue;
      calor.push({ l, peso: 1 });
      for (let i = 0; i < cuantos && agentes.length < MAX_AGENTES; i++) {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.1, 20), new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.4, transparent: true, opacity: 0 }));
        m.castShadow = true; grupo.add(m);
        const anillo = new THREE.Mesh(new THREE.RingGeometry(0.38, 0.46, 32), new THREE.MeshBasicMaterial({ color: 0x2563eb, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
        anillo.rotation.x = -Math.PI / 2; grupo.add(anillo);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(RASTRO * 3), 3));
        const rastro = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x2563eb, transparent: true, opacity: 0 }));
        grupo.add(rastro);
        const velocidad = 0.9 + ((i * 37) % 10) / 25;
        agentes.push({ l, m, anillo, rastro, historia: [], velocidad, pausa: 2 + (i % 3) * 1.5, desfase: (i / cuantos) * (2 * l.total / velocidad + 6) });
      }
    }
    // Lo que se mueve: la raíz completa de cada móvil, por su camino, mirando hacia donde va
    const vehiculos = [], porTipo = {};
    for (const raiz of moviles) (porTipo[raiz.userData.movil] ||= []).push(raiz);
    for (const [tipo, id] of Object.entries(conf.moviles)) {
      const l = rutas[id], lista = porTipo[tipo] || [];
      if (!l) continue;
      calor.push({ l, peso: 0.6 });
      lista.forEach((raiz, i) => vehiculos.push({ raiz, l, tipo, ciclo: tipo === "pieza", desfase: i / lista.length, velocidad: tipo === "pieza" ? 0.8 : tipo === "montacargas" ? 1.3 : 0.9 }));
    }
    const mapa = new THREE.Mesh(new THREE.PlaneGeometry(20, 12), new THREE.MeshBasicMaterial({ map: mapaDeCalor(calor), transparent: true, opacity: 0, depthWrite: false }));
    mapa.rotation.x = -Math.PI / 2; mapa.position.y = 0.006; grupo.add(mapa);

    scene.add(grupo);
    actual = { nombre, conf, grupo, zonas, agentes, vehiculos, mapa };
    pintar();
  }

  function encuadrar() {
    const { clientWidth: w, clientHeight: h } = contenedor;
    const aspecto = w / h;
    // 29.8 × 19.87 m en 3:2; si la pantalla es más alta se amplía el alto, si es más ancha, el ancho
    const ancho = aspecto < 1.5 ? 29.8 : 19.8667 * aspecto, alto = ancho / aspecto;
    Object.assign(camara, { left: -ancho / 2, right: ancho / 2, top: alto / 2, bottom: -alto / 2 });
    camara.position.copy(POSICION); camara.lookAt(OBJETIVO);
    // Lo más cerca posible con todo el local adentro, dejando arriba lugar para el tablero y abajo
    // para los botones
    for (let z = 1.6; z > 0.4; z -= 0.02) {
      camara.zoom = z; camara.updateProjectionMatrix(); camara.updateMatrixWorld();
      if (ESQUINAS.every((v) => { const p = v.clone().project(camara); return Math.abs(p.x) < 0.99 && p.y < 0.74 && p.y > -0.8; })) break;
    }
    zoomBase = camara.zoom;
  }
  function ajustar() {
    const { clientWidth: w, clientHeight: h } = contenedor;
    if (!w || !h) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, w < 700 ? 1.6 : 1.75));
    renderer.setSize(w, h, false);
    encuadrar();
  }
  const proyectar = (v) => { const p = v.clone().project(camara); return { x: (p.x * 0.5 + 0.5) * contenedor.clientWidth, y: (-p.y * 0.5 + 0.5) * contenedor.clientHeight }; };
  const giroDe = (tipo, dir) => (FRENTE[tipo] === "-z" ? Math.atan2(-dir.x, -dir.z) : Math.atan2(-dir.z, dir.x));

  function pintar() {
    if (!actual) return;
    const p = avance, s = (performance.now() - t0) / 1000;
    const n = ETAPAS.length, en = (i) => tramo(p, i / n, (i + 0.35) / n);
    const detecta = en(1), recorridos = en(2) * (1 - 0.7 * en(4)), zonas = en(3), patrones = en(4), hallazgo = en(5);
    // La cámara: el encuadre aprobado; en el hallazgo se acerca un poco a su zona
    const foco = actual.zonas[actual.conf.foco]?.centro || OBJETIVO;
    const h = suave(hallazgo);
    const mira = OBJETIVO.clone().lerp(foco, 0.35 * h);
    camara.position.copy(POSICION).add(mira).sub(OBJETIVO);
    camara.lookAt(mira);
    camara.zoom = zoomBase * (1 + 0.16 * h);
    camara.updateProjectionMatrix();
    // Personas: puntos anónimos que van y vuelven por su camino
    for (const a of actual.agentes) {
      const { d } = idaYVuelta(a.l.total, a.velocidad, a.pausa, s + a.desfase);
      const { p: q } = a.l.en(d);
      a.m.position.set(q.x, 0.06, q.z);
      a.m.material.opacity = detecta;
      a.anillo.position.set(q.x, 0.02, q.z);
      a.anillo.material.opacity = detecta * (1 - zonas) * (0.55 + 0.45 * Math.sin(s * 4 + a.desfase));
      a.historia.push(q.x, 0.03, q.z);
      if (a.historia.length > RASTRO * 3) a.historia.splice(0, 3);
      const pos = a.rastro.geometry.attributes.position;
      pos.array.set(a.historia); pos.needsUpdate = true;
      a.rastro.geometry.setDrawRange(0, a.historia.length / 3);
      a.rastro.material.opacity = recorridos * 0.55;
    }
    // Vehículos y piezas: siempre en movimiento (son parte de la operación, no una capa)
    for (const v of actual.vehiculos) {
      let d, dir;
      if (v.ciclo) {
        d = (((s * v.velocidad) / v.l.total + v.desfase) % 1) * v.l.total;
        ({ dir } = v.l.en(d));
      } else {
        const r = idaYVuelta(v.l.total, v.velocidad, 2.5, s + v.desfase * 10);
        d = r.d;
        ({ dir } = v.l.en(d));
        if (!r.ida) dir.negate();
      }
      v.raiz.position.copy(v.l.en(d).p);
      if (FRENTE[v.tipo]) v.raiz.rotation.y = giroDe(v.tipo, dir);
    }
    // Zonas: todas tenues; la del hallazgo late
    for (const [clave, z] of Object.entries(actual.zonas)) {
      const latido = clave === actual.conf.foco ? hallazgo * (0.5 + 0.5 * Math.sin(s * 3)) : 0;
      z.m.material.opacity = zonas * 0.1 + latido * 0.12;
      z.borde.material.opacity = zonas * 0.45 + latido * 0.45;
    }
    actual.mapa.material.opacity = patrones * 0.95;
    renderer.render(scene, camara);
    const anclas = Object.fromEntries(Object.entries(actual.zonas).map(([k, z]) => [k, proyectar(z.centro)]));
    alAvance?.({ p, etapa: ETAPAS[etapaEn(p)], escena: actual.nombre, anclas, zonas, hallazgo });
  }

  function bucle() {
    cuadro = 0;
    avance = reducir ? objetivo : avance + (objetivo - avance) * 0.12;
    pintar();
    if (visible && !contenedor.closest(".corrida") && !matchMedia("(prefers-reduced-motion: reduce)").matches) cuadro = requestAnimationFrame(bucle);
  }
  const pedir = () => { if (!cuadro && visible) cuadro = requestAnimationFrame(bucle); };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) pedir(); }, { rootMargin: "100px" }).observe(contenedor);
  // Se mide cada vez que cambia el contenedor, también al pasar de oculto a visible
  new ResizeObserver(() => { ajustar(); pintar(); }).observe(contenedor);
  ajustar();

  let pedida = "restaurante";
  const listo = cargar("restaurante").then((datos) => {
    construir("restaurante", datos);
    pedir();
  });

  return {
    listo,
    avanzar(p) { objetivo = limitar(p); pedir(); },
    // Las otras escenas sólo se piden cuando alguien va a usarlas (no se bajan de más en el celular)
    precargar(nombre) { if (ESCENAS[nombre]) cargar(nombre).catch(() => {}); },
    cambiar(nombre) {
      if (!ESCENAS[nombre] || nombre === pedida) return Promise.resolve();
      pedida = nombre;
      return cargar(nombre).then((datos) => { if (pedida === nombre) construir(nombre, datos); });
    },
  };
}
