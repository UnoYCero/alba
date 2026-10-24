// Vision Ops: la operación vista desde arriba, guiada por el avance de la sección (0 → 1).
// Sobre la escena se encienden capas, una tras otra: lo que se detecta, los recorridos, las zonas
// y sus tiempos, el mapa de calor, el hallazgo y el tablero (el tablero es HTML, en visionops.js).
// Las tres escenas (restaurante, almacén, línea de producción) son provisionales y van en código,
// con la misma estructura que se le pidió a Codex en la ronda 13 de marca: piezas, zonas, caminos
// y lo que se mueve. Cuando lleguen sus modelos, sólo cambia de dónde salen.
// Las personas son siempre puntos anónimos: nunca caras.

import * as THREE from "three";

const limitar = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const tramo = (p, a, b) => limitar((p - a) / (b - a));
const suave = (x) => x * x * (3 - 2 * x);

// Las etapas, en el avance de la sección (las mismas que el texto de visionops.js)
export const ETAPAS = ["inicio", "detecta", "recorridos", "zonas", "patrones", "hallazgo", "tablero"];
const etapaEn = (p) => Math.min(ETAPAS.length - 1, Math.floor(p * ETAPAS.length));

// ── Las escenas. Piso de 20 × 12 m (x de −10 a 10, z de −6 a 6), y hacia arriba ──
// piezas: [x, z, ancho, fondo, alto, tono]   (tono: "equipo", "acento", "mueble")
// zonas: { clave: [x1, z1, x2, z2] }
// caminos: { tipo, velocidad (m/s), puntos: [[x, z, espera en s], …], cuantos, color }
const ESCENAS = {
  restaurante: {
    piezas: [
      [-6, -5.1, 4, 0.9, 0.95, "equipo"], [-1, -5.1, 4, 0.9, 0.95, "mueble"], [4, -5.1, 4, 0.9, 0.95, "mueble"], // plancha · preparación · emplatado
      [3, -1.4, 10, 0.7, 1.05, "mueble"], [7.4, -0.95, 0.8, 0.5, 1.35, "acento"], // barra y caja
      ...[-8.5, -5.5, -2.5].flatMap((x) => [[x, 2, 1.1, 1.1, 0.75, "mueble"], [x, 4.4, 1.1, 1.1, 0.75, "mueble"]]), // mesas
    ],
    zonas: { fila: [3.2, -0.6, 9.6, 2.4], plancha: [-8.2, -6, -3.8, -4.2], mesas: [-9.6, 1, -1.4, 5.6], entrada: [5.6, 4.6, 8.8, 6] },
    caminos: [
      { tipo: "persona", velocidad: 1.1, cuantos: 4, puntos: [[7, 6.2], [7, 4], [8.8, 2], [8.8, 0.2, 5], [7.4, -0.3, 3], [4, 1], [-2.5, 3.2, 8], [1, 5], [7, 6.2]] },
      { tipo: "persona", velocidad: 1, cuantos: 3, puntos: [[6.4, 6.2], [6.4, 4], [6.2, 2], [6.2, 0.4, 4], [4.6, 0.6], [-5.5, 3.2, 9], [-2, 5.4], [6.4, 6.2]] },
      { tipo: "persona", velocidad: 0.9, cuantos: 1, abandona: true, puntos: [[8, 6.2], [8, 4], [9.2, 2.2, 6], [8.4, 4.6], [8, 6.2]] },
      { tipo: "personal", velocidad: 0.8, cuantos: 3, puntos: [[-7, -4.2, 3], [-2, -4.2, 2], [3, -4.2, 2], [5, -4.2, 1], [3, -4.2], [-7, -4.2]] },
      { tipo: "carga", velocidad: 1.2, cuantos: 2, puntos: [[4, -4.4, 2], [4, -2.2], [-1, 0.6], [-5.5, 2, 2], [-1, 0.6], [4, -2.2], [4, -4.4]] },
    ],
    calor: "fila",
  },
  almacen: {
    piezas: [
      ...[-4.2, -1.4, 1.4, 4.2].map((z) => [-1.5, z, 11, 1.1, 2.4, "mueble"]), // racks
      [9.6, -5.2, 0.3, 1.6, 2.6, "equipo"], [9.6, -2.8, 0.3, 1.6, 2.6, "equipo"], // cortinas del muelle
      [-8.4, 3, 2.2, 1, 0.9, "mueble"], [-8.4, 5, 2.2, 1, 0.9, "mueble"], // mesas de empaque
      [6.6, -0.8, 1.2, 1.2, 0.5, "acento"], [6.6, 0.8, 1.2, 1.2, 0.5, "acento"], // tarimas recibidas
    ],
    zonas: { muelle: [8.4, -6, 10, -2], recepcion: [5.4, -1.8, 7.8, 1.8], pasillo: [-7, -0.6, 4, 0.6], empaque: [-10, 2, -7, 6] },
    caminos: [
      { tipo: "carga", velocidad: 1.6, cuantos: 2, puntos: [[8, -4, 3], [5, -2.8], [5, 0], [-2, 0, 3], [-6, 0], [-6, 2.8], [-1, 2.8, 2], [5, 2.8], [5, 0], [8, -2.4, 3]] },
      { tipo: "carga", velocidad: 1.4, cuantos: 1, puntos: [[8, -2.4, 4], [5, -2.8], [5, -2.8], [-4, -2.8, 3], [-6.5, -2.8], [-6.5, 0], [0, 0, 2], [5, 0], [8, -4, 3]] },
      { tipo: "persona", velocidad: 1, cuantos: 4, puntos: [[-6.8, 0], [-6.8, -2.8, 4], [2, -2.8], [2, 0, 6], [-3, 0], [-6.8, 2.8, 4], [-8.4, 4, 6], [-6.8, 0]] },
      { tipo: "personal", velocidad: 0.9, cuantos: 2, puntos: [[7.2, -5, 4], [7.2, -1.8, 3], [6.2, -3.4, 2], [7.2, -5]] },
    ],
    calor: "pasillo",
  },
  linea: {
    piezas: [
      [0, 0, 17, 0.8, 0.8, "equipo"], // banda
      ...[-6, -3, 0, 3, 6].map((x) => [x, -1.3, 1.6, 0.9, 1, "mueble"]), // estaciones
      [9, 0, 1.4, 1.4, 1.6, "acento"], // inspección
      [8.6, 3.6, 1.2, 1.2, 0.6, "mueble"], [8.6, 5.1, 1.2, 1.2, 0.6, "mueble"], // producto terminado
      [-9, 3.4, 1.4, 1.4, 1.2, "mueble"], // material
    ],
    zonas: { estacion3: [-1.2, -2.4, 1.2, 0.6], inspeccion: [8, -1, 10, 1], terminado: [7.6, 2.6, 10, 6], material: [-10, 2.4, -7.6, 4.6] },
    caminos: [
      { tipo: "pieza", velocidad: 1.2, cuantos: 7, puntos: [[-8.5, 0], [-6, 0, 1.5], [-3, 0, 1.5], [0, 0, 4], [3, 0, 1.5], [6, 0, 1.5], [9, 0, 1.2], [9, 2.6], [8.6, 4.2, 1]] },
      ...[-6, -3, 0, 3, 6].map((x) => ({ tipo: "personal", velocidad: 0.4, cuantos: 1, puntos: [[x - 0.3, -2.2, 2], [x + 0.3, -2.2, 2], [x - 0.3, -2.2]] })),
      { tipo: "persona", velocidad: 1, cuantos: 2, puntos: [[-9, 4.6, 3], [-9, 1.4], [-8.6, 1, 2], [-6.8, 4.4], [-9, 4.6]] },
    ],
    calor: "estacion3",
  },
};
export const ESCENAS_NOMBRES = Object.keys(ESCENAS);

const TONOS = { equipo: 0x0b1f3b, acento: 0x2563eb, mueble: 0xc9d3e3 };

// Un camino con esperas → una función del tiempo que da la posición (y si está esperando)
function recorrido(c) {
  const tramos = [];
  let total = 0;
  for (let i = 0; i < c.puntos.length - 1; i++) {
    const [x1, z1, espera = 0] = c.puntos[i], [x2, z2] = c.puntos[i + 1];
    if (espera) { tramos.push({ a: [x1, z1], b: [x1, z1], t0: total, d: espera, quieto: true }); total += espera; }
    const d = Math.hypot(x2 - x1, z2 - z1) / c.velocidad;
    if (d > 0) { tramos.push({ a: [x1, z1], b: [x2, z2], t0: total, d }); total += d; }
  }
  return { total, en(t) {
    t = ((t % total) + total) % total;
    const s = tramos.find((q) => t < q.t0 + q.d) || tramos[tramos.length - 1];
    const k = suave(limitar((t - s.t0) / s.d));
    return { x: s.a[0] + (s.b[0] - s.a[0]) * k, z: s.a[1] + (s.b[1] - s.a[1]) * k, quieto: !!s.quieto };
  } };
}

// El mapa de calor: densidad de todos los caminos, pintada en un lienzo (más tiempo, más calor)
function mapaDeCalor(esc) {
  const W = 400, H = 240, c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  const aPx = (x, z) => [((x + 10) / 20) * W, ((z + 6) / 12) * H];
  g.globalCompositeOperation = "lighter";
  for (const cam of esc.caminos) {
    if (cam.tipo === "personal") continue;
    const r = recorrido(cam);
    for (let t = 0; t < r.total; t += 0.25) {
      const p = r.en(t), [x, y] = aPx(p.x, p.z);
      const d = g.createRadialGradient(x, y, 0, x, y, 16);
      d.addColorStop(0, "rgba(37,99,235,.05)"); d.addColorStop(1, "rgba(37,99,235,0)");
      g.fillStyle = d; g.fillRect(x - 16, y - 16, 32, 32);
    }
  }
  return new THREE.CanvasTexture(c);
}

export function montarOperacion({ escena: contenedor, lienzo, alAvance, reducir = false }) {
  const celular = matchMedia("(max-width: 760px)").matches;
  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0xdfe6f2, 1.6));
  const sol = new THREE.DirectionalLight(0xffffff, 2.2);
  sol.position.set(-8, 16, 10); sol.castShadow = true;
  sol.shadow.mapSize.set(celular ? 1024 : 2048, celular ? 1024 : 2048);
  Object.assign(sol.shadow.camera, { left: -13, right: 13, top: 10, bottom: -10, near: 1, far: 40 });
  sol.shadow.radius = 4; sol.shadow.bias = -0.0006;
  scene.add(sol);
  const camara = new THREE.PerspectiveCamera(30, 1, 0.5, 120);

  // El piso y las paredes bajas son de todas las escenas
  const piso = new THREE.Mesh(new THREE.BoxGeometry(20.6, 0.2, 12.6), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }));
  piso.position.y = -0.1; piso.receiveShadow = true; scene.add(piso);
  const pared = new THREE.MeshStandardMaterial({ color: 0xe3e9f3, roughness: 0.8 });
  for (const [x, z, w, d] of [[0, -6.3, 20.6, 0.2], [-10.3, 0, 0.2, 12.6], [10.3, 0, 0.2, 12.6]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.5, d), pared); m.position.set(x, 0.25, z); m.castShadow = m.receiveShadow = true; scene.add(m);
  }

  const MAX_AGENTES = 24, RASTRO = 70;
  let actual = null, avance = 0, objetivo = 0, cuadro = 0, visible = true, t0 = performance.now();

  function construir(nombre) {
    if (actual) { scene.remove(actual.grupo); actual.grupo.traverse((o) => { o.geometry?.dispose(); if (o.material && o.material !== pared) o.material.dispose?.(); }); }
    const esc = ESCENAS[nombre];
    const grupo = new THREE.Group();
    for (const [x, z, w, d, h, tono] of esc.piezas) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: TONOS[tono], roughness: tono === "equipo" ? 0.5 : 0.75 }));
      m.position.set(x, h / 2, z); m.castShadow = m.receiveShadow = true; grupo.add(m);
    }
    // Zonas: un plano apenas sobre el piso, que se enciende
    const zonas = {};
    for (const [clave, [x1, z1, x2, z2]] of Object.entries(esc.zonas)) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(x2 - x1, z2 - z1), new THREE.MeshBasicMaterial({ color: 0x2563eb, transparent: true, opacity: 0, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.set((x1 + x2) / 2, 0.02, (z1 + z2) / 2); grupo.add(m);
      const borde = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(x2 - x1, z2 - z1)), new THREE.LineBasicMaterial({ color: 0x2563eb, transparent: true, opacity: 0 }));
      borde.rotation.x = -Math.PI / 2; borde.position.copy(m.position).setY(0.03); grupo.add(borde);
      zonas[clave] = { m, borde, centro: new THREE.Vector3((x1 + x2) / 2, 0, (z1 + z2) / 2) };
    }
    // Calor
    const calor = new THREE.Mesh(new THREE.PlaneGeometry(20, 12), new THREE.MeshBasicMaterial({ map: mapaDeCalor(esc), transparent: true, opacity: 0, depthWrite: false }));
    calor.rotation.x = -Math.PI / 2; calor.position.y = 0.015; grupo.add(calor);
    // Lo que se mueve: puntos para personas, cajitas para la carga y las piezas
    const agentes = [];
    for (const cam of esc.caminos) {
      const r = recorrido(cam);
      for (let i = 0; i < cam.cuantos && agentes.length < MAX_AGENTES; i++) {
        const esCaja = cam.tipo === "carga" || cam.tipo === "pieza";
        const geo = esCaja ? new THREE.BoxGeometry(cam.tipo === "pieza" ? 0.32 : 0.7, cam.tipo === "pieza" ? 0.24 : 0.5, cam.tipo === "pieza" ? 0.32 : 0.5) : new THREE.CylinderGeometry(0.26, 0.26, 0.12, 20);
        const color = cam.tipo === "personal" ? 0x0b1f3b : esCaja ? 0x8fb2ff : 0x2563eb;
        const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.4, transparent: true, opacity: 0 }));
        m.castShadow = true; grupo.add(m);
        const anillo = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 32), new THREE.MeshBasicMaterial({ color: 0x2563eb, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
        anillo.rotation.x = -Math.PI / 2; grupo.add(anillo);
        const rastroGeo = new THREE.BufferGeometry();
        rastroGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(RASTRO * 3), 3));
        const rastro = new THREE.Line(rastroGeo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0 }));
        grupo.add(rastro);
        agentes.push({ r, m, anillo, rastro, historia: [], desfase: (i / cam.cuantos) * r.total, alto: esCaja ? (cam.tipo === "pieza" ? 0.92 : 0.25) : 0.06, abandona: !!cam.abandona, caja: esCaja });
      }
    }
    scene.add(grupo);
    actual = { nombre, esc, grupo, zonas, calor, agentes };
    pintar();
  }

  function ajustar() {
    const { clientWidth: w, clientHeight: h } = contenedor;
    if (!w || !h) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, w < 700 ? 1.6 : 1.75));
    renderer.setSize(w, h, false);
    camara.aspect = w / h; camara.updateProjectionMatrix();
    encuadrar();
  }

  // La distancia a la que cabe todo el piso (con lo alto de las piezas), dejando arriba lugar para
  // el tablero y abajo para los botones. Se calcula al cambiar de tamaño, no en cada cuadro.
  const ESQUINAS = [-10.3, 10.3].flatMap((x) => [-6.3, 6.3].flatMap((z) => [0, 2.6].map((y) => new THREE.Vector3(x, y, z))));
  let distanciaBase = 40;
  const colocarCamara = (mira, dist, giro) => {
    camara.position.set(mira.x + Math.sin(giro) * dist * 0.62, dist * 0.78, mira.z + Math.cos(giro) * dist * 0.62);
    camara.lookAt(mira);
    camara.updateMatrixWorld();
  };
  function encuadrar() {
    const centro = new THREE.Vector3();
    for (let d = 18; d < 120; d += 1) {
      colocarCamara(centro, d, -0.5);
      const cabe = ESQUINAS.every((v) => { const p = v.clone().project(camara); return Math.abs(p.x) < 0.94 && p.y < 0.7 && p.y > -0.78; });
      if (cabe) { distanciaBase = d; return; }
    }
  }

  const proyectar = (v) => { const p = v.clone().project(camara); return { x: (p.x * 0.5 + 0.5) * contenedor.clientWidth, y: (-p.y * 0.5 + 0.5) * contenedor.clientHeight }; };

  function pintar() {
    if (!actual) return;
    const p = avance, s = (performance.now() - t0) / 1000;
    const n = ETAPAS.length, en = (i) => tramo(p, i / n, (i + 0.35) / n);
    const detecta = en(1), recorridos = en(2) * (1 - 0.7 * en(4)), zonas = en(3), patrones = en(4), hallazgo = en(5);
    // La cámara: desde arriba a 3/4, a la distancia en que cabe todo; un poco más cerca del hallazgo
    const foco = actual.zonas[actual.esc.calor].centro;
    const mira = new THREE.Vector3().lerp(foco, 0.3 * suave(hallazgo));
    const giro = -0.5 + (reducir ? 0 : Math.sin(s * 0.12) * 0.04);
    colocarCamara(mira, distanciaBase * (1 - 0.12 * suave(hallazgo)), giro);
    // Agentes
    for (const a of actual.agentes) {
      const q = a.r.en(s + a.desfase);
      a.m.position.set(q.x, a.alto, q.z);
      a.m.material.opacity = detecta;
      a.anillo.position.set(q.x, 0.03, q.z);
      a.anillo.material.opacity = a.caja ? 0 : detecta * (1 - zonas) * (0.55 + 0.45 * Math.sin(s * 4 + a.desfase));
      a.historia.push(q.x, 0.04, q.z);
      if (a.historia.length > RASTRO * 3) a.historia.splice(0, 3);
      const pos = a.rastro.geometry.attributes.position;
      pos.array.set(a.historia); pos.needsUpdate = true;
      a.rastro.geometry.setDrawRange(0, a.historia.length / 3);
      a.rastro.material.opacity = recorridos * 0.55;
    }
    // Zonas: todas tenues; la del hallazgo late
    for (const [clave, z] of Object.entries(actual.zonas)) {
      const esHallazgo = clave === actual.esc.calor;
      const latido = esHallazgo ? hallazgo * (0.5 + 0.5 * Math.sin(s * 3)) : 0;
      z.m.material.opacity = zonas * 0.08 + latido * 0.14;
      z.borde.material.opacity = zonas * 0.5 + latido * 0.4;
    }
    actual.calor.material.opacity = patrones * 0.95;
    renderer.render(scene, camara);
    const anclas = Object.fromEntries(Object.entries(actual.zonas).map(([k, z]) => [k, proyectar(z.centro)]));
    alAvance?.({ p, etapa: ETAPAS[etapaEn(p)], escena: actual.nombre, anclas, zonas, hallazgo });
  }

  function bucle() {
    cuadro = 0;
    avance = reducir ? objetivo : avance + (objetivo - avance) * 0.12;
    pintar();
    if (visible) cuadro = requestAnimationFrame(bucle);
  }
  const pedir = () => { if (!cuadro && visible) cuadro = requestAnimationFrame(bucle); };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) pedir(); }, { rootMargin: "100px" }).observe(contenedor);
  addEventListener("resize", () => { ajustar(); pintar(); });
  ajustar();
  construir("restaurante");
  pedir();

  return {
    avanzar(p) { objetivo = limitar(p); pedir(); },
    cambiar(nombre) { if (ESCENAS[nombre] && nombre !== actual?.nombre) construir(nombre); },
  };
}
