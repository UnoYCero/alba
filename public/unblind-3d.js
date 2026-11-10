// UNBLIND por dentro: los lentes en 3D, guiados por el avance de la sección (0 → 1).
// 1) Presentación: una vuelta completa.  2) Se desarman en orden de taller: tornillos, tapas,
// procesador, baterías (antes, rayos X en las puntas), transductores, patillas, cámara y LiDAR.
// 3) Súper zoom en cada pieza.  4) Se vuelven a armar.  5) Un pulso de luz cuenta cómo
// funcionan: la cámara ve → el procesador entiende → la conducción ósea lo dice.
// Aparte, «Explorar en 3D» abre los lentes en pantalla completa para girarlos en cualquier
// dirección, acercarse y tocar cada pieza.
// El modelo (assets/unblind/lentes.glb) viene de la ronda 11 de marca, aligerado para la web.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const limitar = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const tramo = (p, a, b) => limitar((p - a) / (b - a));
const suave = (x) => x * x * (3 - 2 * x);
const muySuave = (x) => x * x * x * (x * (x * 6 - 15) + 10);
// Llega con un pequeño rebote, como una pieza real que se detiene
const rebote = (x) => { if (x <= 0) return 0; if (x >= 1) return 1; const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const mezcla = (a, b, t) => a + (b - a) * t;

// Coordenadas del modelo de Blender (mm, Z arriba) → glTF (m, Y arriba)
const b2g = (x, y, z) => new THREE.Vector3(x / 1000, z / 1000, -y / 1000);

// ── El desarmado, en orden de taller. Cada etapa mueve unos grupos; los desplazamientos son
// los del despiece de la ronda 11 (generar.py) ──
const ETAPAS = [
  { de: 0.075, a: 0.105, mueve: { "tornillos-tapa-derecha": b2g(14, 0, 0), "tornillos-tapa-izquierda": b2g(-14, 0, 0) } },
  { de: 0.1, a: 0.135, mueve: { "tapa-derecha": b2g(58, 20, 5), "tornillos-tapa-derecha": b2g(58, 20, 5), "tapa-izquierda": b2g(-58, 20, 5), "tornillos-tapa-izquierda": b2g(-58, 20, 5) } },
  { de: 0.135, a: 0.165, mueve: { procesador: b2g(28, 0, 35) } },
  { de: 0.185, a: 0.215, mueve: { "bateria-derecha": b2g(26, 20, 36), "bateria-izquierda": b2g(-26, 20, 36) } },
  { de: 0.215, a: 0.24, mueve: { "conduccion-derecha": b2g(-15, 20, -20), "conduccion-izquierda": b2g(15, 20, -20) } },
  { de: 0.24, a: 0.275, mueve: { "patilla-derecha": b2g(26, 20, 0), "punta-derecha": b2g(26, 20, 0), "patilla-izquierda": b2g(-26, 20, 0), "punta-izquierda": b2g(-26, 20, 0), camara: b2g(-6, -42, 34), lidar: b2g(10, -42, 34) } },
];
const RAYOS_X = [0.16, 0.185]; // las puntas se vuelven translúcidas y se ven las baterías
const T = {
  vuelta: [0, 0.075],
  zoom: [0.29, 0.7],
  arma: [0.7, 0.77],
  ve: [0.78, 0.84], entiende: [0.84, 0.89], dice: [0.89, 0.965],
};
// Las piezas que se recorren con súper zoom (la de la derecha cuando hay dos)
const ORDEN = ["camara", "lidar", "procesador", "conduccion", "bateria"];
const FOCO = { camara: ["camara"], lidar: ["lidar"], procesador: ["procesador"], conduccion: ["conduccion-derecha"], bateria: ["bateria-derecha"] };
const PAREJA = { conduccion: "conduccion-izquierda", bateria: "bateria-izquierda" };
// Al tocar una malla en «Explorar», a qué pieza de la lista pertenece
const PIEZA_DE = { camara: "camara", lidar: "lidar", procesador: "procesador", "conduccion-derecha": "conduccion", "conduccion-izquierda": "conduccion", "bateria-derecha": "bateria", "bateria-izquierda": "bateria" };

// Cada malla a su grupo: los tornillos de las tapas y las puntas portabatería por separado
function grupoDe(pieza, nombre) {
  const lado = pieza.endsWith("izquierda") ? "izquierda" : "derecha";
  if (pieza.startsWith("tapa-") && nombre.startsWith("Tornillo")) return `tornillos-tapa-${lado}`;
  if (pieza.startsWith("patilla-") && /^(Punta portabatería|Tapa de punta|Tornillo de punta)/.test(nombre)) return `punta-${lado}`;
  return pieza;
}

// ── El estudio: un fondo claro de foto de producto con cajas de luz (arriba, a un lado y unas tiras), como en
// una sesión de foto de producto. No se ve: sólo da los reflejos largos y suaves del plástico,
// el brillo de los tornillos y el de la óptica ──
function estudio(renderer) {
  const s = new THREE.Scene();
  const cuarto = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshBasicMaterial({ color: 0x5f6d8a, side: THREE.BackSide }));
  s.add(cuarto);
  const caja = (ancho, alto, intensidad, x, y, z, color = 0xffffff) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(ancho, alto), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    m.material.color.multiplyScalar(intensidad);
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    s.add(m);
  };
  caja(3.4, 3.4, 4, 0, 4.6, 0.4); // la grande, arriba
  caja(1.4, 3.4, 7, -4.2, 1.2, 2.2); // la principal, adelante a la izquierda
  caja(0.5, 4, 4.5, 4.4, 0.8, -1.2, 0xdfe8ff); // tira a la derecha, un poco atrás: dibuja el borde
  caja(4.2, 0.45, 3, 0, 1.4, -4.6, 0xcfdcff); // tira atrás, fría
  caja(7, 7, 1.1, 0, -4.8, 0); // el piso claro, rebota luz desde abajo
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(s, 0.02).texture;
  pm.dispose();
  return tex;
}

// ── Los acabados: el modelo trae colores lisos; aquí cada material toma su acabado de producto ──
function acabado(original) {
  const n = original.name || "";
  const base = { color: original.color, map: original.map, alphaMap: original.alphaMap, name: n, side: original.side, alphaTest: original.alphaTest };
  // El nylon: el acabado comercial de la ronda 18 (más satinado; la forma no cambia), para que
  // los reflejos del estudio corran largos y suaves
  if (n.startsWith("Nylon impreso") || n.startsWith("Tapa impresa")) {
    return new THREE.MeshStandardMaterial({ ...base, roughness: n.startsWith("Tapa") ? 0.46 : 0.42, metalness: 0, envMapIntensity: 0.7 });
  }
  // La óptica de la cámara y la ventana del LiDAR: vidrio negro con barniz, que refleja el estudio
  if (n.startsWith("Óptica")) {
    return new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.08, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6 });
  }
  if (n.startsWith("Tornillos")) return new THREE.MeshStandardMaterial({ ...base, roughness: 0.32, metalness: 0.85, envMapIntensity: 1.3 });
  if (n.startsWith("LED")) {
    const m = new THREE.MeshStandardMaterial({ ...base, roughness: 0.3, emissive: 0x8fb2ff, emissiveIntensity: 1.4 });
    m.userData.emisionBase = m.emissive.clone().multiplyScalar(m.emissiveIntensity);
    return m;
  }
  const m = original.clone();
  if (n.startsWith("Encapsulado")) { m.roughness = 0.4; }
  if (n.startsWith("Baterías")) { m.roughness = 0.45; m.metalness = 0.5; }
  return m;
}

export function montarDespiece({ escena, lienzo, urlModelo, alAvance, reducir = false }) {
  const celular = matchMedia("(max-width: 760px)").matches;
  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.environment = estudio(renderer);
  scene.environmentIntensity = 1;

  // Luz de estudio: principal (con sombra), relleno frío y una luz trasera que dibuja el contorno
  const principal = new THREE.DirectionalLight(0xffffff, 2.6);
  principal.position.set(-0.35, 0.9, 0.5);
  principal.castShadow = true;
  principal.shadow.mapSize.set(celular ? 1024 : 2048, celular ? 1024 : 2048);
  principal.shadow.radius = 6;
  principal.shadow.bias = -0.0004;
  Object.assign(principal.shadow.camera, { left: -0.25, right: 0.25, top: 0.25, bottom: -0.25, near: 0.05, far: 2.5 });
  scene.add(principal, principal.target);
  const relleno = new THREE.DirectionalLight(0xdfe8ff, 0.35); relleno.position.set(0.6, 0.3, 0.7); scene.add(relleno);
  const contorno = new THREE.DirectionalLight(0x9fbcff, 2.2); contorno.position.set(0.2, 0.55, -0.9); scene.add(contorno);
  // El piso que recibe la sombra (sólo la sombra; el fondo es el papel de la página)
  const piso = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShadowMaterial({ opacity: 0.1 }));
  piso.rotation.x = -Math.PI / 2; piso.receiveShadow = true; scene.add(piso);

  const camara = new THREE.PerspectiveCamera(28, 1, 0.002, 5);

  const grupos = {}; // grupo → [{ obj, base, mat, opacidad }]
  let modelo = null, centro = new THREE.Vector3(), radio = 0.12, sueloY = 0;
  let avance = 0, objetivoAvance = 0, listo = false, visible = true, cuadro = 0;
  const t0 = performance.now();
  let giro = 0, giroInicio = 0, arrastrando = false, xInicio = 0, puntero = 0;

  // ── El pulso: cámara → procesador; procesador → oído derecho; procesador → oído izquierdo ──
  const CAMINOS = [
    [b2g(-7, -10, 51), b2g(20, -9, 58), b2g(62, -2, 54), b2g(70, 24, 47), b2g(71, 52, 43)],
    [b2g(71, 52, 43), b2g(70, 96, 45), b2g(64, 124, 43), b2g(61.6, 130, 41)],
    [b2g(71, 52, 43), b2g(66, 6, 54), b2g(34, -8, 62), b2g(-34, -8, 62), b2g(-66, 6, 54), b2g(-70, 96, 46), b2g(-64, 124, 43), b2g(-61.6, 130, 41)],
  ];
  const luzPulso = new THREE.MeshBasicMaterial({ color: 0x9fbcff, transparent: true, opacity: 0.95, depthTest: false, blending: THREE.AdditiveBlending });
  const caminos = CAMINOS.map((pts) => {
    const curva = new THREE.CatmullRomCurve3(pts, false, "centripetal");
    const geo = new THREE.TubeGeometry(curva, 160, 0.0011, 8, false);
    const tubo = new THREE.Mesh(geo, luzPulso); tubo.renderOrder = 10; tubo.visible = false;
    const cabeza = new THREE.Mesh(new THREE.SphereGeometry(0.0032, 16, 12), luzPulso); cabeza.renderOrder = 11; cabeza.visible = false;
    scene.add(tubo, cabeza);
    return { curva, tubo, cabeza, total: geo.index.count };
  });
  // Resplandor (textura de canvas) para la luz del pulso, el procesador y las baterías
  const halo = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
    const d = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    d.addColorStop(0, "rgba(190,210,255,1)"); d.addColorStop(0.25, "rgba(143,178,255,.55)"); d.addColorStop(1, "rgba(143,178,255,0)");
    g.fillStyle = d; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
  })();
  const resplandor = () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, transparent: true, depthTest: false, blending: THREE.AdditiveBlending })); s.renderOrder = 12; s.visible = false; scene.add(s); return s; };
  const brillos = caminos.map(() => resplandor());
  const brilloProcesador = resplandor();
  const brillosBateria = [resplandor(), resplandor()];
  const ondas = [b2g(61.6, 130, 41), b2g(-61.6, 130, 41)].map((p) => [0, 1, 2].map(() => {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.0085, 0.0098, 64), new THREE.MeshBasicMaterial({ color: 0x8fb2ff, transparent: true, depthTest: false, side: THREE.DoubleSide }));
    m.renderOrder = 9; m.visible = false; m.position.copy(p); scene.add(m); return m;
  }));

  // ── Cargar el modelo ──
  const cargador = new GLTFLoader(); cargador.setMeshoptDecoder(MeshoptDecoder);
  const promesa = new Promise((resolver, fallar) => {
    cargador.load(urlModelo, (gltf) => {
      modelo = gltf.scene;
      modelo.traverse((o) => {
        if (!o.isMesh) return;
        const pieza = o.userData.pieza || o.parent?.userData?.pieza || "armazon";
        const grupo = grupoDe(pieza, o.name || "");
        o.material = acabado(o.material);
        o.material.transparent = true;
        o.castShadow = true;
        o.userData.grupo = grupo;
        (grupos[grupo] ||= []).push({ obj: o, base: o.position.clone(), mat: o.material });
      });
      scene.add(modelo);
      const caja = new THREE.Box3().setFromObject(modelo);
      caja.getCenter(centro);
      radio = caja.getSize(new THREE.Vector3()).length() / 2;
      sueloY = caja.min.y - 0.012;
      piso.position.set(centro.x, sueloY, centro.z);
      principal.target.position.copy(centro);
      principal.position.copy(centro).add(new THREE.Vector3(-0.12, 1, 0.18));
      listo = true;
      ajustar(); pintar();
      resolver();
    }, undefined, fallar);
  });

  // La pieza en foco se ilumina apenas de azul; el LED conserva su luz propia
  const resaltar = (mat, k) => {
    mat.emissive.setRGB(0.3, 0.45, 0.9).multiplyScalar(k);
    if (mat.userData.emisionBase) { mat.emissive.add(mat.userData.emisionBase); mat.emissiveIntensity = 1; }
  };

  const centroDe = (nombres) => {
    const caja = new THREE.Box3();
    nombres.forEach((n) => (grupos[n] || []).forEach(({ obj }) => caja.expandByObject(obj)));
    return caja.isEmpty() ? { c: centro.clone(), r: radio } : { c: caja.getCenter(new THREE.Vector3()), r: caja.getSize(new THREE.Vector3()).length() / 2 };
  };

  function ajustar() {
    const { width, height } = lienzo.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, width < 700 ? 1.6 : 1.75));
    renderer.setSize(width, height, false);
    camara.aspect = width / height;
    camara.updateProjectionMatrix();
  }

  // ── Dónde está cada grupo para un avance dado ──
  function colocar(p, separar = null) {
    const armar = 1 - muySuave(tramo(p, ...T.arma));
    const desplazado = {};
    for (const etapa of ETAPAS) {
      const f = separar !== null ? separar : rebote(tramo(p, etapa.de, etapa.a)) * armar;
      for (const [g, v] of Object.entries(etapa.mueve)) (desplazado[g] ||= new THREE.Vector3()).addScaledVector(v, f);
    }
    for (const [g, lista] of Object.entries(grupos)) for (const { obj, base } of lista) {
      obj.position.copy(base);
      if (desplazado[g]) obj.position.add(desplazado[g]);
    }
  }

  // Encuadre del súper zoom: qué pieza y cuánto se acerca (0 → 1 → 0 dentro de su turno)
  function zoom(p) {
    if (p < T.zoom[0] || p >= T.zoom[1]) return { pieza: null, k: 0, orbita: 0 };
    const f = tramo(p, ...T.zoom) * ORDEN.length;
    const i = Math.min(ORDEN.length - 1, Math.floor(f));
    const dentro = f - i;
    const k = muySuave(tramo(dentro, 0, 0.24)) * (1 - muySuave(tramo(dentro, 0.8, 1)));
    return { pieza: ORDEN[i], k, orbita: mezcla(-0.5, 0.5, tramo(dentro, 0.15, 0.85)) };
  }

  // ── Modo guiado ──
  function pintar() {
    if (!listo || libre.activo) return;
    const p = reducir ? 0.5 : avance;
    const t = (performance.now() - t0) / 1000;
    colocar(p);
    const z = zoom(p);
    const enfocadas = z.pieza ? FOCO[z.pieza] : [];
    const rayosX = suave(tramo(p, ...RAYOS_X)) * (1 - suave(tramo(p, ETAPAS[3].a, ETAPAS[3].a + 0.02)));
    const enPulso = tramo(p, T.ve[0] - 0.01, T.ve[0] + 0.02);
    for (const [g, lista] of Object.entries(grupos)) {
      const resaltada = enfocadas.includes(g) || (z.pieza && PAREJA[z.pieza] === g);
      let op = 1;
      if (z.pieza && !resaltada) op = mezcla(1, 0.1, z.k);
      if (g.startsWith("punta-")) op = Math.min(op, mezcla(1, 0.2, rayosX));
      op = Math.min(op, mezcla(1, 0.5, enPulso * (1 - tramo(p, 0.985, 1))));
      for (const { obj, mat } of lista) {
        mat.opacity = op; mat.depthWrite = op > 0.95; obj.castShadow = op > 0.5;
        if (mat.emissive) resaltar(mat, resaltada ? 0.12 * z.k : 0);
      }
    }
    // Las baterías brillan cuando se ven a través de las puntas
    ["bateria-derecha", "bateria-izquierda"].forEach((g, i) => {
      const s = brillosBateria[i]; s.visible = rayosX > 0.02;
      if (s.visible) { s.position.copy(centroDe([g]).c); s.scale.setScalar(0.05); s.material.opacity = rayosX * 0.9; }
    });

    // Cámara: una vuelta completa al entrar, luego el 3/4 del despiece, súper zoom en cada pieza
    // y, durante el pulso, un poco más lejos y corrida (arriba a la izquierda va «lo que ve»)
    const sep = rebote(tramo(p, ETAPAS[0].de, ETAPAS[5].a)) * (1 - muySuave(tramo(p, ...T.arma)));
    const haciaPulso = muySuave(tramo(p, T.arma[0], T.ve[0]));
    let azimut = 0.95 + Math.PI * 2 * muySuave(tramo(p, ...T.vuelta)) - 0.35 * suave(tramo(p, T.vuelta[1], ETAPAS[5].a)) - 0.18 * haciaPulso;
    azimut += (reducir ? 0 : Math.sin(t * 0.25) * 0.035) + giro;
    let elevacion = mezcla(0.3, 0.45, sep) + puntero * 0.03;
    const objetivo = centro.clone();
    let distancia = radio * (1 + 0.8 * sep) / Math.sin(THREE.MathUtils.degToRad(camara.fov / 2));
    distancia *= camara.aspect < 1 ? 0.92 / Math.max(0.55, camara.aspect * 1.05) : 0.8;
    objetivo.x -= Math.cos(azimut) * radio * 0.28 * haciaPulso;
    objetivo.z += Math.sin(azimut) * radio * 0.28 * haciaPulso;
    objetivo.y += radio * 0.22 * haciaPulso;
    distancia *= mezcla(1, 1.38, haciaPulso);
    if (z.pieza) {
      const { c, r } = centroDe(FOCO[z.pieza]);
      const cerca = Math.max(0.045, r * 7.5) / Math.max(0.7, Math.min(1, camara.aspect));
      objetivo.lerp(c, z.k);
      distancia = mezcla(distancia, cerca, z.k);
      azimut += z.orbita * z.k;
      elevacion = mezcla(elevacion, 0.32, z.k);
    }
    camara.position.set(
      objetivo.x + distancia * Math.cos(elevacion) * Math.sin(azimut),
      objetivo.y + distancia * Math.sin(elevacion),
      objetivo.z + distancia * Math.cos(elevacion) * Math.cos(azimut),
    );
    camara.lookAt(objetivo);

    // El pulso
    const pulso = { ve: tramo(p, ...T.ve), entiende: tramo(p, ...T.entiende), dice: tramo(p, ...T.dice) };
    [pulso.ve, pulso.dice, pulso.dice].forEach((v, i) => {
      const c = caminos[i], f = muySuave(v);
      const activo = f > 0 && p < 0.995;
      c.tubo.visible = activo; c.cabeza.visible = activo && f < 1; brillos[i].visible = c.cabeza.visible;
      if (!activo) return;
      c.tubo.geometry.setDrawRange(0, Math.floor(c.total * f / 3) * 3);
      const punto = c.curva.getPointAt(Math.min(0.999, f));
      c.cabeza.position.copy(punto); brillos[i].position.copy(punto); brillos[i].scale.setScalar(0.03);
    });
    const proc = suave(pulso.entiende) * (1 - 0.5 * pulso.dice);
    brilloProcesador.visible = proc > 0.01;
    if (brilloProcesador.visible) {
      brilloProcesador.position.copy(b2g(71, 52, 43));
      brilloProcesador.scale.setScalar(0.045 + 0.015 * Math.sin(t * 4) * proc);
      brilloProcesador.material.opacity = proc;
    }
    const sonando = pulso.dice > 0.85 && p < 0.995;
    ondas.forEach((anillos) => anillos.forEach((m, k) => {
      m.visible = sonando;
      if (!sonando) return;
      const fase = ((t * 0.8 + k / 3) % 1);
      m.scale.setScalar(0.6 + fase * 2.4);
      m.material.opacity = (1 - fase) * 0.85;
      m.quaternion.copy(camara.quaternion);
    }));

    renderer.render(scene, camara);

    if (alAvance) {
      let anclas = null;
      if (z.pieza && z.k > 0.05) {
        const r = lienzo.getBoundingClientRect();
        const proyectar = (nombres) => { const v = centroDe(nombres).c.project(camara); return { x: (v.x + 1) / 2 * r.width, y: (1 - v.y) / 2 * r.height }; };
        anclas = [proyectar(FOCO[z.pieza])];
        if (PAREJA[z.pieza]) anclas.push(proyectar([PAREJA[z.pieza]]));
      }
      alAvance({ p, foco: z.pieza, enFoco: z.k, pulso, anclas, separacion: sep });
    }
  }

  function bucle() {
    cuadro = 0;
    if (document.hidden) return;
    if (libre.activo) { libre.paso(); cuadro = requestAnimationFrame(bucle); return; }
    if (!visible) return;
    avance = reducir ? objetivoAvance : mezcla(avance, objetivoAvance, 0.14);
    if (Math.abs(avance - objetivoAvance) < 0.0004) avance = objetivoAvance;
    pintar();
    cuadro = requestAnimationFrame(bucle);
  }
  const pedir = () => { if (!cuadro && !reducir) cuadro = requestAnimationFrame(bucle); else if (reducir) pintar(); };

  // Girar con el dedo o el mouse, de lado a lado y sin tope (una vuelta completa si quieres).
  // Sólo horizontal: el movimiento vertical sigue bajando la página.
  lienzo.addEventListener("pointerdown", (e) => { if (libre.activo) return; arrastrando = true; xInicio = e.clientX; giroInicio = giro; });
  addEventListener("pointerup", () => { arrastrando = false; });
  addEventListener("pointermove", (e) => {
    if (libre.activo) return;
    if (arrastrando) giro = giroInicio + (e.clientX - xInicio) / 180;
    else if (e.pointerType === "mouse") puntero = (e.clientY / innerHeight) * 2 - 1;
    pedir();
  }, { passive: true });

  // ── «Explorar en 3D»: girar en cualquier dirección, acercarse y tocar cada pieza ──
  const libre = {
    activo: false, controles: null, separado: 0, objetivoSeparado: 0, vuelo: null, alTocar: null,
    abrir(alTocar) {
      this.activo = true; this.alTocar = alTocar;
      ajustar(); // el lienzo ya está en la capa a pantalla completa: medir su forma antes de encuadrar
      colocar(0, 0); this.separado = this.objetivoSeparado = 0;
      for (const lista of Object.values(grupos)) for (const { obj, mat } of lista) { mat.opacity = 1; mat.depthWrite = true; obj.castShadow = true; if (mat.emissive) resaltar(mat, 0); }
      [...caminos.flatMap((c) => [c.tubo, c.cabeza]), ...brillos, brilloProcesador, ...brillosBateria, ...ondas.flat()].forEach((o) => { o.visible = false; });
      if (!this.controles) {
        this.controles = new OrbitControls(camara, lienzo);
        Object.assign(this.controles, { enableDamping: true, dampingFactor: 0.08, enablePan: false, rotateSpeed: 0.9, minPolarAngle: 0, maxPolarAngle: Math.PI });
        lienzo.addEventListener("pointerdown", (e) => { this.toque = { x: e.clientX, y: e.clientY }; });
        lienzo.addEventListener("pointerup", (e) => {
          if (!this.activo || !this.toque || Math.hypot(e.clientX - this.toque.x, e.clientY - this.toque.y) > 6) return;
          this.tocar(e);
        });
      }
      this.controles.enabled = true;
      this.controles.minDistance = radio * 0.35;
      this.controles.maxDistance = this.distanciaQueCabe(3);
      this.controles.target.copy(centro);
      camara.position.copy(centro).add(new THREE.Vector3(Math.sin(0.7), 0.42, Math.cos(0.7)).normalize().multiplyScalar(this.distanciaQueCabe(1)));
      this.controles.update();
      pedir();
    },
    cerrar() {
      this.activo = false; this.vuelo = null;
      if (this.controles) this.controles.enabled = false;
      pedir();
    },
    // Distancia para que quepa todo (en pantallas verticales, más lejos); separado ocupa más
    distanciaQueCabe(factor) {
      const base = radio / Math.sin(THREE.MathUtils.degToRad(camara.fov / 2));
      return base * factor * (camara.aspect < 1 ? 1.08 / Math.max(0.45, camara.aspect) : 0.95);
    },
    separar(si) {
      this.objetivoSeparado = si ? 1 : 0;
      // La cámara se aleja (o se acerca) para que todas las piezas sigan a la vista
      const dir = camara.position.clone().sub(this.controles.target).normalize();
      const hacia = centro.clone().addScaledVector(dir, this.distanciaQueCabe(si ? 1.65 : 1));
      this.vuelo = { desdeT: this.controles.target.clone(), haciaT: centro.clone(), desdeP: camara.position.clone(), haciaP: hacia, t: 0 };
      this.controles.maxDistance = this.distanciaQueCabe(3);
    },
    tocar(e) {
      const r = lienzo.getBoundingClientRect();
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camara);
      const golpe = ray.intersectObject(modelo, true)[0];
      const pieza = golpe && PIEZA_DE[golpe.object.userData.grupo];
      if (!pieza) { this.alTocar?.(null); return; }
      const { c, r: rr } = centroDe([golpe.object.userData.grupo]);
      const dir = camara.position.clone().sub(this.controles.target).normalize();
      this.vuelo = { desdeT: this.controles.target.clone(), haciaT: c, desdeP: camara.position.clone(), haciaP: c.clone().addScaledVector(dir, Math.max(0.05, rr * 7)), t: 0 };
      this.alTocar?.(pieza);
    },
    paso() {
      this.separado = mezcla(this.separado, this.objetivoSeparado, 0.08);
      colocar(0, rebote(this.separado));
      if (this.vuelo) {
        const v = this.vuelo; v.t = Math.min(1, v.t + 0.035); const f = muySuave(v.t);
        this.controles.target.lerpVectors(v.desdeT, v.haciaT, f);
        camara.position.lerpVectors(v.desdeP, v.haciaP, f);
        if (v.t >= 1) this.vuelo = null;
      }
      this.controles.update();
      renderer.render(scene, camara);
    },
  };

  new ResizeObserver(() => { ajustar(); if (libre.activo) pedir(); else pintar(); }).observe(lienzo);
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) pedir(); }, { rootMargin: "100px" }).observe(escena);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) pedir(); });
  lienzo.addEventListener("webglcontextlost", (e) => { e.preventDefault(); listo = false; escena.classList.remove("con-3d"); });

  return {
    listo: promesa,
    avanzar(p) { objetivoAvance = limitar(p); pedir(); },
    explorar: {
      abrir: (alTocar) => libre.abrir(alTocar),
      cerrar: () => libre.cerrar(),
      separar: (si) => libre.separar(si),
    },
  };
}
