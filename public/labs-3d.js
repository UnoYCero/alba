// Alba Labs: el concepto modular en 3D (ronda 17 de marca, Codex, en grafito).
// · montarModular: una base de lentes y siete clips; al elegir uno, el que estaba se retira y el
//   nuevo entra por un lado hasta acoplarse en la patilla derecha. Lo usan la portada (con los
//   lentes completos a la vista) y «Una base. Muchos módulos.». assets/labs/labs-modular.glb: la
//   escena 0 trae la base; las escenas 1 a 7, la base con un clip cada una (extras.clip).
// · montarConfigurador: las cinco configuraciones de tres módulos. assets/labs/labs-configuraciones.glb
//   son las escenas 17 a 21 de labs-biblioteca-15.glb, aligeradas: cada una trae la base de dos
//   acoples, el adaptador doble y sus tres clips (extras.clip y extras.puesto).
// Es un concepto: no un producto ni un funcionamiento probado.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const limitar = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const suave = (x) => x * x * (3 - 2 * x);

// El acople derecho y desde dónde llega cada clip (acoples.json de la ronda 15)
const DESTINO = new THREE.Vector3(0.0784, 0.043459, -0.038);
const ENTRADA = new THREE.Vector3(0.06, 0, 0);

// La luz de estudio: un sol casi cenital deja la sombra justo debajo de los lentes, para que no
// la corte la orilla del lienzo (se veía como un recuadro)
function estudio(lienzo) {
  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.8;
  const sol = new THREE.DirectionalLight(0xffffff, 2.2);
  sol.position.set(-0.12, 1, 0.18); sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024); sol.shadow.radius = 8; sol.shadow.bias = -0.0004;
  Object.assign(sol.shadow.camera, { left: -0.25, right: 0.25, top: 0.25, bottom: -0.25, near: 0.05, far: 3 });
  scene.add(sol, sol.target);
  scene.add(new THREE.DirectionalLight(0xdfe8ff, 0.6).translateX(0.6).translateY(0.3).translateZ(0.7));
  const piso = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShadowMaterial({ opacity: 0.08 }));
  piso.rotation.x = -Math.PI / 2; piso.receiveShadow = true; scene.add(piso);
  const camara = new THREE.PerspectiveCamera(26, 1, 0.005, 10);
  return { renderer, scene, sol, piso, camara };
}

// Mide el lienzo, dibuja sólo mientras se ve y deja girar arrastrando de lado (en celular la
// página sigue bajando con el dedo). Devuelve pedir() y el giro acumulado.
function visor({ contenedor, lienzo, renderer, camara, pintar }) {
  let cuadro = 0, visible = true, arrastre = null;
  const estado = { giro: 0 };
  const ajustar = () => {
    const { clientWidth: w, clientHeight: h } = contenedor;
    if (!w || !h) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, w < 700 ? 1.6 : 1.75));
    renderer.setSize(w, h, false);
    camara.aspect = w / h; camara.updateProjectionMatrix();
  };
  const bucle = () => { cuadro = 0; pintar(); if (visible) cuadro = requestAnimationFrame(bucle); };
  const pedir = () => { if (!cuadro && visible) cuadro = requestAnimationFrame(bucle); };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) pedir(); }, { rootMargin: "100px" }).observe(contenedor);
  // Se mide cada vez que cambia el contenedor, también al pasar de oculto a visible
  new ResizeObserver(() => { ajustar(); pintar(); }).observe(contenedor);
  lienzo.style.touchAction = "pan-y";
  lienzo.addEventListener("pointerdown", (e) => { arrastre = { x: e.clientX, giro: estado.giro }; lienzo.setPointerCapture(e.pointerId); });
  lienzo.addEventListener("pointermove", (e) => { if (arrastre) { estado.giro = arrastre.giro + (e.clientX - arrastre.x) / 160; pedir(); } });
  const soltar = () => { arrastre = null; };
  lienzo.addEventListener("pointerup", soltar);
  lienzo.addEventListener("pointercancel", soltar);
  ajustar();
  return { pedir, estado };
}

// cerca: a 3/4 y junto al acople (para ver entrar el clip); si no, los lentes completos
export function montarModular({ contenedor, lienzo, url, reducir = false, cerca = true }) {
  const { renderer, scene, sol, piso, camara } = estudio(lienzo);

  const clips = new Map();
  let base = null, centro = new THREE.Vector3(), radio = 0.12;
  let actual = null, saliendo = null, t = 1, tSale = 1;
  const t0 = performance.now();

  function pintar() {
    if (!base) return;
    const s = (performance.now() - t0) / 1000;
    // El clip que entra viene desde un lado y frena al acoplarse; el anterior sale por donde entró
    t = reducir ? 1 : Math.min(1, t + 0.035);
    tSale = reducir ? 1 : Math.min(1, tSale + 0.05);
    if (actual) actual.position.copy(DESTINO).addScaledVector(ENTRADA, 1 - suave(t));
    if (saliendo) {
      saliendo.position.copy(DESTINO).addScaledVector(ENTRADA, suave(tSale));
      if (tSale >= 1) { saliendo.visible = false; saliendo = null; }
    }
    // A 3/4, más cerca del acople cuando un clip está entrando; se puede girar arrastrando
    const foco = cerca ? centro.clone().lerp(DESTINO, 0.55) : centro.clone();
    const fov = THREE.MathUtils.degToRad(camara.fov) / 2;
    // En lienzos angostos (celular) un poco más lejos, para que quepan los lentes completos
    const angosto = camara.aspect < 1.1;
    const dist = (radio / Math.sin(Math.min(fov, Math.atan(Math.tan(fov) * camara.aspect)))) * (cerca ? (angosto ? 0.8 : 0.66) : (angosto ? 0.9 : 0.62));
    const az = (cerca ? 0.95 : 0.7) + giro.giro + (reducir ? 0 : Math.sin(s * 0.22) * 0.1), el = cerca ? 0.38 : 0.32;
    camara.position.set(foco.x + Math.sin(az) * Math.cos(el) * dist, foco.y + Math.sin(el) * dist, foco.z + Math.cos(az) * Math.cos(el) * dist);
    camara.lookAt(foco);
    renderer.render(scene, camara);
  }
  const { pedir, estado: giro } = visor({ contenedor, lienzo, renderer, camara, pintar });

  const cargador = new GLTFLoader();
  cargador.setMeshoptDecoder(MeshoptDecoder);
  const listo = cargador.loadAsync(url).then((gltf) => {
    const conjunto = new THREE.Group();
    base = gltf.scenes[0].children.find((o) => o.userData.pieza === "base") || gltf.scenes[0].children[0];
    conjunto.add(base);
    // Una sola copia de cada clip, de las escenas 1 a 7
    for (const escena of gltf.scenes.slice(1)) {
      const clip = escena.children.find((o) => o.userData.clip);
      if (!clip || clips.has(clip.userData.clip)) continue;
      clip.visible = false;
      clips.set(clip.userData.clip, clip);
      conjunto.add(clip);
    }
    conjunto.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(conjunto);
    const caja = new THREE.Box3().setFromObject(base);
    caja.getCenter(centro);
    radio = caja.getSize(new THREE.Vector3()).length() / 2;
    piso.position.set(centro.x, caja.min.y - 0.002, centro.z);
    sol.target.position.copy(centro);
    pedir();
  });

  return {
    listo,
    ids: () => [...clips.keys()],
    poner(id) {
      const clip = clips.get(id);
      if (!clip || clip === actual) return;
      if (actual) { if (saliendo) saliendo.visible = false; saliendo = actual; tSale = 0; }
      actual = clip; t = 0;
      clip.position.copy(DESTINO).add(ENTRADA);
      clip.visible = true;
      pedir();
    },
  };
}

// Las cinco configuraciones: la base de dos acoples con el adaptador se queda; al elegir otra, los
// tres módulos que estaban salen por su lado y los nuevos entran escalonados hasta acoplarse.
export function montarConfigurador({ contenedor, lienzo, url, reducir = false }) {
  const { renderer, scene, sol, piso, camara } = estudio(lienzo);
  const configuraciones = new Map();
  let base = null, centro = new THREE.Vector3(), radio = 0.14;
  let actuales = [], saliendo = [], t = 1, tSale = 1;
  const t0 = performance.now();
  // Los de la derecha (frontal y posterior) entran desde +X; el de la izquierda, desde −X
  const desplazar = (m, k) => m.obj.position.copy(m.fin).add(new THREE.Vector3(m.lado * 0.06 * k, 0, 0));

  function pintar() {
    if (!base) return;
    const s = (performance.now() - t0) / 1000;
    t = reducir ? 1 : Math.min(1, t + 0.022);
    tSale = reducir ? 1 : Math.min(1, tSale + 0.045);
    actuales.forEach((m, i) => desplazar(m, 1 - suave(limitar((t - i * 0.18) / 0.64))));
    saliendo.forEach((m) => { desplazar(m, suave(tSale)); if (tSale >= 1) m.obj.visible = false; });
    if (tSale >= 1) saliendo = [];
    // Un poco desde arriba y al frente, para ver las dos patillas; se puede girar arrastrando
    const fov = THREE.MathUtils.degToRad(camara.fov) / 2;
    // Los módulos sobresalen de la base: en lienzos angostos (celular) más lejos para que quepan
    const dist = (radio / Math.sin(Math.min(fov, Math.atan(Math.tan(fov) * camara.aspect)))) * (camara.aspect < 1.1 ? 1.12 : 0.88);
    const az = 0.55 + giro.giro + (reducir ? 0 : Math.sin(s * 0.2) * 0.22), el = 0.42;
    camara.position.set(centro.x + Math.sin(az) * Math.cos(el) * dist, centro.y + Math.sin(el) * dist, centro.z + Math.cos(az) * Math.cos(el) * dist);
    camara.lookAt(centro);
    renderer.render(scene, camara);
  }
  const { pedir, estado: giro } = visor({ contenedor, lienzo, renderer, camara, pintar });

  const cargador = new GLTFLoader();
  cargador.setMeshoptDecoder(MeshoptDecoder);
  const listo = cargador.loadAsync(url).then((gltf) => {
    // La base y el adaptador salen de la primera configuración; de cada una, sólo sus tres clips
    gltf.scenes.forEach((escena, i) => {
      const raiz = escena.children[0];
      const id = raiz.userData.configuracion;
      const modulos = raiz.children.filter((o) => o.userData.clip).map((obj) => ({
        obj, fin: obj.position.clone(), lado: obj.userData.puesto === "izquierda" ? -1 : 1,
      }));
      if (i === 0) base = raiz;
      modulos.forEach((m) => { m.obj.visible = false; base.add(m.obj); });
      configuraciones.set(id, modulos);
    });
    base.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(base);
    const caja = new THREE.Box3().setFromObject(base);
    caja.getCenter(centro);
    radio = caja.getSize(new THREE.Vector3()).length() / 2;
    piso.position.set(centro.x, caja.min.y - 0.002, centro.z);
    sol.target.position.copy(centro);
    pedir();
  });

  return {
    listo,
    ids: () => [...configuraciones.keys()],
    poner(id) {
      const nuevos = configuraciones.get(id);
      if (!nuevos || nuevos === actuales) return;
      saliendo.forEach((m) => { m.obj.visible = false; });
      saliendo = actuales; tSale = 0;
      actuales = nuevos; t = 0;
      actuales.forEach((m) => { desplazar(m, 1); m.obj.visible = true; });
      pedir();
    },
  };
}

