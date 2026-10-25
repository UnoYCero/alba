// Alba Labs: el concepto modular en 3D. Una base de lentes y siete clips; al elegir uno, el que
// estaba se retira y el nuevo entra por un lado hasta acoplarse en la patilla derecha.
// El modelo es la ronda 17 de marca (Codex): assets/labs/labs-modular.glb, en grafito. La
// escena 0 trae la base; las escenas 1 a 7, la base con un clip cada una (extras.clip).
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

export function montarModular({ contenedor, lienzo, url, reducir = false }) {
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
  sol.position.set(-0.3, 1, 0.5); sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024); sol.shadow.radius = 6; sol.shadow.bias = -0.0004;
  Object.assign(sol.shadow.camera, { left: -0.25, right: 0.25, top: 0.25, bottom: -0.25, near: 0.05, far: 3 });
  scene.add(sol, sol.target);
  scene.add(new THREE.DirectionalLight(0xdfe8ff, 0.6).translateX(0.6).translateY(0.3).translateZ(0.7));
  const piso = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShadowMaterial({ opacity: 0.1 }));
  piso.rotation.x = -Math.PI / 2; piso.receiveShadow = true; scene.add(piso);
  const camara = new THREE.PerspectiveCamera(26, 1, 0.005, 10);

  const clips = new Map();
  let base = null, centro = new THREE.Vector3(), radio = 0.12;
  let actual = null, saliendo = null, t = 1, tSale = 1, cuadro = 0, visible = true, giro = 0, arrastre = null;
  const t0 = performance.now();

  function ajustar() {
    const { clientWidth: w, clientHeight: h } = contenedor;
    if (!w || !h) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, w < 700 ? 1.6 : 1.75));
    renderer.setSize(w, h, false);
    camara.aspect = w / h; camara.updateProjectionMatrix();
  }
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
    const foco = centro.clone().lerp(DESTINO, 0.55);
    const fov = THREE.MathUtils.degToRad(camara.fov) / 2;
    const dist = (radio / Math.sin(Math.min(fov, Math.atan(Math.tan(fov) * camara.aspect)))) * 0.66;
    const az = 0.95 + giro + (reducir ? 0 : Math.sin(s * 0.22) * 0.1), el = 0.38;
    camara.position.set(foco.x + Math.sin(az) * Math.cos(el) * dist, foco.y + Math.sin(el) * dist, foco.z + Math.cos(az) * Math.cos(el) * dist);
    camara.lookAt(foco);
    renderer.render(scene, camara);
  }
  function bucle() {
    cuadro = 0;
    pintar();
    if (visible) cuadro = requestAnimationFrame(bucle);
  }
  const pedir = () => { if (!cuadro && visible) cuadro = requestAnimationFrame(bucle); };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) pedir(); }, { rootMargin: "100px" }).observe(contenedor);
  // Se mide cada vez que cambia el contenedor, también al pasar de oculto a visible
  new ResizeObserver(() => { ajustar(); pintar(); }).observe(contenedor);

  lienzo.style.touchAction = "pan-y";
  lienzo.addEventListener("pointerdown", (e) => { arrastre = { x: e.clientX, giro }; lienzo.setPointerCapture(e.pointerId); });
  lienzo.addEventListener("pointermove", (e) => { if (arrastre) { giro = arrastre.giro + (e.clientX - arrastre.x) / 160; pedir(); } });
  const soltar = () => { arrastre = null; };
  lienzo.addEventListener("pointerup", soltar);
  lienzo.addEventListener("pointercancel", soltar);

  ajustar();
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
