// UNBLIND por dentro: los lentes en 3D, guiados por el avance de la sección (0 → 1).
// Primero se separan en sus piezas, luego se recorre cada una, se vuelven a armar y un pulso
// de luz cuenta cómo funcionan: la cámara ve → el procesador entiende → la conducción ósea lo dice.
// El modelo (assets/unblind/lentes.glb) viene de la ronda 11 de marca, aligerado para la web;
// cada malla trae en extras.pieza el conjunto al que pertenece.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const limitar = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const tramo = (p, a, b) => limitar((p - a) / (b - a));
const suave = (x) => x * x * (3 - 2 * x);
const mezcla = (a, b, t) => a + (b - a) * t;

// Coordenadas del modelo de Blender (mm, Z arriba) → glTF (m, Y arriba)
const b2g = (x, y, z) => new THREE.Vector3(x / 1000, z / 1000, -y / 1000);

// Separación de cada conjunto en el despiece: los mismos desplazamientos que usó la ronda 11
// para su imagen (generar.py), con la cámara y el LiDAR un poco más arriba para que se lean.
const SEPARACION = {
  camara: b2g(-6, -42, 34), lidar: b2g(10, -42, 34), procesador: b2g(28, 0, 35),
  "patilla-derecha": b2g(26, 20, 0), "tapa-derecha": b2g(58, 20, 5), "conduccion-derecha": b2g(-15, 20, -20), "bateria-derecha": b2g(26, 20, 36),
  "patilla-izquierda": b2g(-26, 20, 0), "tapa-izquierda": b2g(-58, 20, 5), "conduccion-izquierda": b2g(15, 20, -20), "bateria-izquierda": b2g(-26, 20, 36),
};
// Qué conjuntos se iluminan con cada pieza de la lista
const GRUPOS = {
  camara: ["camara"], lidar: ["lidar"], procesador: ["procesador"],
  conduccion: ["conduccion-derecha", "conduccion-izquierda"], bateria: ["bateria-derecha", "bateria-izquierda"],
};
const ORDEN = ["camara", "lidar", "procesador", "conduccion", "bateria"];

// Tiempos de la sección (avance 0 → 1)
const T = {
  separa: [0.08, 0.2],
  piezas: [0.22, 0.6],
  arma: [0.61, 0.68],
  ve: [0.69, 0.77], entiende: [0.77, 0.84], dice: [0.84, 0.95],
};

export function montarDespiece({ escena, lienzo, urlModelo, alAvance, reducir = false }) {
  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  const clave = new THREE.DirectionalLight(0xffffff, 1.6); clave.position.set(-0.4, 0.8, 0.6); scene.add(clave);
  const contra = new THREE.DirectionalLight(0xdbe6ff, 0.9); contra.position.set(0.5, 0.4, -0.8); scene.add(contra);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xc9d6ea, 0.6));
  const camara = new THREE.PerspectiveCamera(28, 1, 0.005, 5);

  const piezas = {}; // conjunto → [{ obj, base, mats }]
  let modelo = null, centro = new THREE.Vector3(), radio = 0.12;
  let avance = 0, objetivoAvance = 0, listo = false, visible = true, cuadro = 0, t0 = performance.now();
  let puntero = 0, arrastre = 0, arrastrando = false, xInicio = 0, arrastreInicio = 0;

  // ── El pulso: tres caminos (cámara → procesador; procesador → oído derecho; procesador → oído izquierdo) ──
  const CAMINOS = [
    [b2g(-7, -10, 51), b2g(20, -9, 58), b2g(62, -2, 54), b2g(70, 24, 47), b2g(71, 52, 43)],
    [b2g(71, 52, 43), b2g(70, 96, 45), b2g(64, 124, 43), b2g(61.6, 130, 41)],
    [b2g(71, 52, 43), b2g(66, 6, 54), b2g(34, -8, 62), b2g(-34, -8, 62), b2g(-66, 6, 54), b2g(-70, 96, 46), b2g(-64, 124, 43), b2g(-61.6, 130, 41)],
  ];
  const luzPulso = new THREE.MeshBasicMaterial({ color: 0x8fb2ff, transparent: true, opacity: 0.95, depthTest: false, blending: THREE.AdditiveBlending });
  const caminos = CAMINOS.map((pts) => {
    const curva = new THREE.CatmullRomCurve3(pts, false, "centripetal");
    const geo = new THREE.TubeGeometry(curva, 120, 0.0011, 8, false);
    const tubo = new THREE.Mesh(geo, luzPulso); tubo.renderOrder = 10; tubo.visible = false;
    const cabeza = new THREE.Mesh(new THREE.SphereGeometry(0.0032, 16, 12), luzPulso); cabeza.renderOrder = 11; cabeza.visible = false;
    scene.add(tubo, cabeza);
    return { curva, tubo, cabeza, total: geo.index.count };
  });
  // Halo suave (una textura de canvas) para la cabeza del pulso y el procesador
  const halo = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d");
    const d = g.createRadialGradient(32, 32, 0, 32, 32, 32); d.addColorStop(0, "rgba(143,178,255,1)"); d.addColorStop(1, "rgba(143,178,255,0)");
    g.fillStyle = d; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
  })();
  const brillo = () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, transparent: true, depthTest: false, blending: THREE.AdditiveBlending })); s.renderOrder = 12; s.visible = false; scene.add(s); return s; };
  const brillos = caminos.map(() => brillo());
  const brilloProcesador = brillo();
  // Ondas de sonido en cada transductor
  const ondas = [b2g(61.6, 130, 41), b2g(-61.6, 130, 41)].map((p) => {
    const anillos = [0, 1, 2].map(() => {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.0085, 0.0095, 48), new THREE.MeshBasicMaterial({ color: 0x8fb2ff, transparent: true, depthTest: false, side: THREE.DoubleSide }));
      m.renderOrder = 9; m.visible = false; m.position.copy(p); scene.add(m); return m;
    });
    return { p, anillos };
  });

  // ── Cargar el modelo ──
  const cargador = new GLTFLoader(); cargador.setMeshoptDecoder(MeshoptDecoder);
  const promesa = new Promise((resolver, fallar) => {
    cargador.load(urlModelo, (gltf) => {
      modelo = gltf.scene;
      modelo.traverse((o) => {
        if (!o.isMesh) return;
        const pieza = o.userData.pieza || o.parent?.userData?.pieza || "armazon";
        // Cada malla con su propio material, para poder atenuarla o iluminarla sola
        o.material = o.material.clone();
        o.material.transparent = true;
        if (o.material.emissive) o.material.userData.emisivo = o.material.emissive.clone();
        (piezas[pieza] ||= []).push({ obj: o, base: o.position.clone(), mat: o.material });
      });
      scene.add(modelo);
      const caja = new THREE.Box3().setFromObject(modelo);
      caja.getCenter(centro);
      radio = caja.getSize(new THREE.Vector3()).length() / 2;
      listo = true;
      ajustar(); pintar();
      resolver();
    }, undefined, fallar);
  });

  // Centro de un conjunto en su posición actual (para la etiqueta y el foco)
  const centroDe = (nombres) => {
    const caja = new THREE.Box3();
    nombres.forEach((n) => (piezas[n] || []).forEach(({ obj }) => caja.expandByObject(obj)));
    return caja.isEmpty() ? centro.clone() : caja.getCenter(new THREE.Vector3());
  };

  function ajustar() {
    const { width, height } = lienzo.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, width < 700 ? 1.6 : 1.75));
    renderer.setSize(width, height, false);
    camara.aspect = width / height;
    camara.updateProjectionMatrix();
  }

  // Estado de la escena para un avance dado
  function estado(p) {
    const e = suave(tramo(p, ...T.separa)) * (1 - suave(tramo(p, ...T.arma)));
    // Pieza en foco durante el recorrido
    let foco = -1, enFoco = 0;
    if (p >= T.piezas[0] && p < T.piezas[1]) {
      const f = tramo(p, ...T.piezas) * ORDEN.length;
      foco = Math.min(ORDEN.length - 1, Math.floor(f));
      const dentro = f - foco;
      enFoco = suave(tramo(dentro, 0, 0.25)) * (1 - suave(tramo(dentro, 0.8, 1)));
    }
    const pulso = {
      ve: tramo(p, ...T.ve), entiende: tramo(p, ...T.entiende), dice: tramo(p, ...T.dice),
    };
    return { e, foco, enFoco, pulso };
  }

  function pintar() {
    if (!listo) return;
    const p = reducir ? 0.4 : avance;
    const { e, foco, enFoco, pulso } = estado(p);
    const t = (performance.now() - t0) / 1000;

    // Piezas: separación y atenuación (las que no están en foco se aclaran)
    const enFocoNombres = foco >= 0 ? GRUPOS[ORDEN[foco]] : [];
    const enPulso = p >= T.ve[0] - 0.01;
    for (const [nombre, lista] of Object.entries(piezas)) {
      const sep = SEPARACION[nombre];
      const resaltada = enFocoNombres.includes(nombre);
      const opacidad = foco >= 0 && !resaltada ? mezcla(1, 0.16, enFoco) : enPulso ? 0.55 + 0.45 * (1 - tramo(p, T.ve[0], T.ve[0] + 0.03)) : 1;
      for (const { obj, base, mat } of lista) {
        obj.position.copy(base);
        if (sep) obj.position.addScaledVector(sep, e);
        mat.opacity = opacidad;
        mat.depthWrite = opacidad > 0.9;
        if (mat.emissive) mat.emissive.setRGB(0.32, 0.46, 0.85).multiplyScalar(resaltada ? 0.55 * enFoco : 0);
      }
    }

    // Cámara: gira de un 3/4 abierto al 3/4 de la imagen de la ronda 11, se acerca a la pieza en foco
    const azimut = mezcla(0.95, 0.6, suave(tramo(p, 0, T.separa[1]))) + mezcla(0, -0.18, suave(tramo(p, T.arma[0], T.ve[0]))) + (reducir ? 0 : Math.sin(t * 0.25) * 0.04) + arrastre;
    const elevacion = mezcla(0.32, 0.42, e) + puntero * 0.03;
    const objetivo = centro.clone();
    let distancia = radio * (1 + 0.8 * e) / Math.sin(THREE.MathUtils.degToRad(camara.fov / 2));
    // Que los lentes llenen la escena (en pantallas angostas, un poco más lejos para que quepan)
    distancia *= camara.aspect < 1 ? 0.92 / Math.max(0.55, camara.aspect * 1.05) : 0.8;
    // Durante el pulso los lentes bajan y se corren a la derecha: arriba a la izquierda va «lo que ve»
    const haciaPulso = suave(tramo(p, T.arma[0], T.ve[0]));
    objetivo.x -= Math.cos(azimut) * radio * 0.28 * haciaPulso;
    objetivo.z += Math.sin(azimut) * radio * 0.28 * haciaPulso;
    objetivo.y += radio * 0.22 * haciaPulso;
    distancia *= mezcla(1, 1.38, haciaPulso);
    if (foco >= 0) {
      objetivo.lerp(centroDe(enFocoNombres), 0.3 * enFoco);
      distancia *= mezcla(1, 0.84, enFoco);
    }
    camara.position.set(
      objetivo.x + distancia * Math.cos(elevacion) * Math.sin(azimut),
      objetivo.y + distancia * Math.sin(elevacion),
      objetivo.z + distancia * Math.cos(elevacion) * Math.cos(azimut),
    );
    camara.lookAt(objetivo);

    // El pulso
    const tramos = [pulso.ve, pulso.dice, pulso.dice];
    caminos.forEach((c, i) => {
      const f = suave(tramos[i]);
      const activo = f > 0 && p < 0.995;
      c.tubo.visible = activo; c.cabeza.visible = activo && f < 1; brillos[i].visible = c.cabeza.visible;
      if (!activo) return;
      c.tubo.geometry.setDrawRange(0, Math.floor(c.total * f / 3) * 3);
      const punto = c.curva.getPointAt(Math.min(0.999, f));
      c.cabeza.position.copy(punto); brillos[i].position.copy(punto); brillos[i].scale.setScalar(0.022);
    });
    const proc = suave(pulso.entiende) * (1 - 0.5 * pulso.dice);
    brilloProcesador.visible = proc > 0.01;
    if (brilloProcesador.visible) {
      brilloProcesador.position.copy(b2g(71, 52, 43));
      brilloProcesador.scale.setScalar(0.03 + 0.012 * Math.sin(t * 4) * proc);
      brilloProcesador.material.opacity = proc;
    }
    // Ondas cuando el pulso llega a cada oído
    const sonando = pulso.dice > 0.85 && p < 0.995;
    ondas.forEach(({ anillos }) => anillos.forEach((m, k) => {
      m.visible = sonando;
      if (!sonando) return;
      const fase = ((t * 0.8 + k / 3) % 1);
      m.scale.setScalar(0.6 + fase * 2.2);
      m.material.opacity = (1 - fase) * 0.8;
      m.quaternion.copy(camara.quaternion);
    }));

    renderer.render(scene, camara);

    // La etiqueta de la pieza en foco, en su lugar en pantalla
    if (alAvance) {
      let ancla = null;
      if (foco >= 0) {
        const v = centroDe(enFocoNombres).project(camara);
        const r = lienzo.getBoundingClientRect();
        ancla = { x: (v.x + 1) / 2 * r.width, y: (1 - v.y) / 2 * r.height, opacidad: enFoco };
      }
      alAvance({ p, foco: foco >= 0 ? ORDEN[foco] : null, enFoco, pulso, ancla, separacion: e });
    }
  }

  function bucle() {
    cuadro = 0;
    if (!visible || document.hidden) return;
    avance = reducir ? objetivoAvance : mezcla(avance, objetivoAvance, 0.16);
    if (Math.abs(avance - objetivoAvance) < 0.0004) avance = objetivoAvance;
    pintar();
    cuadro = requestAnimationFrame(bucle);
  }
  const pedir = () => { if (!cuadro && !reducir) cuadro = requestAnimationFrame(bucle); else if (reducir) pintar(); };

  // Girar con el dedo o el mouse (un poco: es una vista guiada, no un visor libre)
  lienzo.addEventListener("pointerdown", (e) => { arrastrando = true; xInicio = e.clientX; arrastreInicio = arrastre; });
  addEventListener("pointerup", () => { arrastrando = false; });
  addEventListener("pointermove", (e) => {
    if (arrastrando) arrastre = limitar(arrastreInicio + (e.clientX - xInicio) / 260, -0.9, 0.9);
    else if (e.pointerType === "mouse") puntero = (e.clientY / innerHeight) * 2 - 1;
    pedir();
  }, { passive: true });

  new ResizeObserver(() => { ajustar(); pintar(); }).observe(lienzo);
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) pedir(); }, { rootMargin: "100px" }).observe(escena);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) pedir(); });
  lienzo.addEventListener("webglcontextlost", (e) => { e.preventDefault(); listo = false; escena.classList.remove("con-3d"); });

  return {
    listo: promesa,
    avanzar(p) { objetivoAvance = limitar(p); pedir(); },
  };
}
