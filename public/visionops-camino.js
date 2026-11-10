// Vision Ops: «De la primera cámara a toda la operación», guiada por el avance de la sección (0 → 1).
// Cuatro pasos sobre el mismo restaurante de la ronda 13: las cámaras que ya tienes se encienden
// (diagnóstico), una mide su zona (piloto), un conector en tu red lee el video (integración) y la
// vista se aleja hasta varias sucursales (escalamiento). Las sucursales lejanas son la ilustración
// aérea del mismo restaurante (restaurante-sucursal.webp), de frente a la cámara: con la cámara
// ortográfica se ve igual que el modelo y cuesta una imagen en lugar de un modelo por sucursal.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { linea, idaYVuelta } from "./visionops-3d.js";

const limitar = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const tramo = (p, a, b) => limitar((p - a) / (b - a));
const suave = (x) => x * x * (3 - 2 * x);
const mezclar = (a, b, k) => a + (b - a) * k;

export const PASOS = ["diagnostico", "piloto", "integracion", "escalamiento"];
const pasoEn = (p) => Math.min(PASOS.length - 1, Math.floor(p * PASOS.length));

// Las cámaras del local (en el techo, sobre las paredes) y hacia dónde miran; la primera es la del
// piloto, la que ve la fila y la caja
const CAMARAS = [
  { pos: [8.6, 0, -5.4], mira: [5.2, 0, 1.6] },
  { pos: [-9.4, 0, -5.4], mira: [-4.2, 0, -3.4] },
  { pos: [-9.4, 0, -1.4], mira: [-4.4, 0, 3.0] },
];
const CONECTOR = [6.4, 0, -5.2];
// Las otras sucursales, en el piso (metros): con la principal son seis, en dos columnas escalonadas
// que en pantalla llenan un recuadro casi cuadrado; la vista alejada mira al centro del conjunto
const SUCURSALES = [[-14.2, -19.5], [14.2, 19.5], [13.9, -25], [28.1, -5.6], [42.3, 13.9]];
const CENTRO_TODAS = new THREE.Vector3(14, 0.2, -2.8);
// La ilustración de la sucursal: el recorte de aerea-transparente.png (2400 × 1600 = 29.8 × 19.87 m)
const SUC_ANCHO = 1866 * (29.8 / 2400), SUC_ALTO = 1298 * (29.8 / 2400);

export function montarCamino({ escena: contenedor, lienzo, alAvance, base }) {
  const celular = matchMedia("(max-width: 760px)").matches;
  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  // La misma luz que la escena de arriba, para que se vea el mismo lugar
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd9e1ee, 2));
  const sol = new THREE.DirectionalLight(0xffffff, 2.4);
  sol.position.set(-6, 18, 9); sol.castShadow = true;
  sol.shadow.mapSize.set(celular ? 1024 : 2048, celular ? 1024 : 2048);
  Object.assign(sol.shadow.camera, { left: -13, right: 13, top: 10, bottom: -10, near: 1, far: 40 });
  sol.shadow.radius = 5; sol.shadow.bias = -0.0005; sol.shadow.normalBias = 0.02;
  scene.add(sol);

  const camara = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
  const POSICION = new THREE.Vector3(19, 32, 26), OBJETIVO = new THREE.Vector3(0, 0.2, 0);
  const DIRECCION = POSICION.clone().sub(OBJETIVO);
  const esquinas = (cx, cz) => [-10.3, 10.3].flatMap((x) => [-6.3, 6.3].flatMap((z) => [0, 1.4].map((y) => new THREE.Vector3(cx + x, y, cz + z))));
  const LOCAL = esquinas(0, 0), TODAS = [[0, 0], ...SUCURSALES].flatMap(([x, z]) => esquinas(x, z));
  let zoomLocal = 1, zoomTodas = 0.3;

  const AZUL = 0x2563eb, TINTA = 0x0b1f3b;
  let datos = null, avance = 0, objetivo = 0, cuadro = 0, visible = true;
  const t0 = performance.now();

  function construir([gltf, caminos, textura]) {
    const modelo = gltf.scene;
    modelo.traverse((o) => {
      if (!o.isMesh) return;
      if (o.userData.zona) { o.visible = o.userData.zona === "fila"; o.castShadow = false; return; }
      o.castShadow = true; o.receiveShadow = true;
    });
    scene.add(modelo);
    // La zona de la fila se enciende en el piloto
    let fila = null;
    modelo.traverse((o) => {
      if (o.isMesh && o.userData.zona === "fila") {
        o.material = o.material.clone();
        Object.assign(o.material, { transparent: true, alphaTest: 0, opacity: 0, depthWrite: false });
        o.material.color.set(AZUL); o.material.needsUpdate = true;
        fila = { m: o, centro: o.getWorldPosition(new THREE.Vector3()) };
      }
    });
    // Las paredes dan la altura del techo: ahí van las cámaras
    const cajaParedes = new THREE.Box3();
    modelo.traverse((o) => { if (o.isMesh && /^pared/.test(o.name)) cajaParedes.expandByObject(o); });
    const techo = cajaParedes.isEmpty() ? 1.4 : cajaParedes.max.y;

    // Cada cámara: el cuerpo, la lente y lo que alcanza a ver, pintado en el piso
    const camaras = CAMARAS.map(({ pos, mira }, i) => {
      const grupo = new THREE.Group();
      const p = new THREE.Vector3(pos[0], techo + 0.12, pos[2]);
      const m = new THREE.Vector3(...mira);
      grupo.position.copy(p);
      grupo.lookAt(m.x, p.y - 1.2, m.z);
      const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.32, 0.72), new THREE.MeshStandardMaterial({ color: TINTA, roughness: 0.5 }));
      cuerpo.castShadow = true; grupo.add(cuerpo);
      const lente = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 20), new THREE.MeshStandardMaterial({ color: AZUL, roughness: 0.3, emissive: AZUL, emissiveIntensity: 0.4 }));
      lente.rotation.x = Math.PI / 2; lente.position.z = 0.38; grupo.add(lente);
      scene.add(grupo);
      // El abanico de lo que ve: desde el pie de la cámara hacia donde mira
      const piso = new THREE.Vector3(p.x, 0, p.z), hacia = m.clone().sub(piso);
      const radio = hacia.length() * 1.25, angulo = Math.atan2(hacia.x, hacia.z), abre = THREE.MathUtils.degToRad(i === 0 ? 46 : 58);
      const forma = new THREE.CircleGeometry(radio, 40, -abre / 2, abre);
      const abanico = new THREE.Mesh(forma, new THREE.MeshBasicMaterial({ color: AZUL, transparent: true, opacity: 0, depthWrite: false }));
      abanico.rotation.order = "YXZ"; abanico.rotation.set(-Math.PI / 2, 0, 0);
      const pivote = new THREE.Group();
      pivote.position.set(p.x, 0.02 + i * 0.002, p.z);
      pivote.rotation.y = angulo - Math.PI / 2;
      pivote.add(abanico);
      const borde = new THREE.LineSegments(new THREE.EdgesGeometry(forma), new THREE.LineBasicMaterial({ color: AZUL, transparent: true, opacity: 0 }));
      borde.rotation.copy(abanico.rotation); pivote.add(borde);
      scene.add(pivote);
      return { grupo, cuerpo, abanico, borde, pos: p };
    });

    // Las personas de la fila: puntos anónimos (como arriba), sólo mientras corre el piloto
    const ruta = linea(caminos.recorridos.find((r) => r.id === "fila-y-caja").puntos);
    const personas = [0, 1, 2, 3].map((i) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.1, 20), new THREE.MeshStandardMaterial({ color: AZUL, roughness: 0.4, transparent: true, opacity: 0 }));
      scene.add(m);
      return { m, desfase: i * 3.2, velocidad: 0.9 + i * 0.12 };
    });

    // El conector: una caja chica en el cuarto de atrás, y el video que viaja de cada cámara hasta él
    const conector = new THREE.Group();
    conector.position.set(CONECTOR[0], 0, CONECTOR[2]);
    const cajaConector = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.6), new THREE.MeshStandardMaterial({ color: TINTA, roughness: 0.45, transparent: true }));
    cajaConector.position.y = 0.25; cajaConector.castShadow = true; conector.add(cajaConector);
    const luz = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.02), new THREE.MeshBasicMaterial({ color: AZUL, transparent: true }));
    luz.position.set(0, 0.32, 0.31); conector.add(luz);
    conector.scale.setScalar(0.001);
    scene.add(conector);
    const destino = new THREE.Vector3(CONECTOR[0], 0.5, CONECTOR[2]);
    const envios = camaras.map((c) => {
      const tramoLinea = new THREE.Line(new THREE.BufferGeometry().setFromPoints([c.pos, destino]), new THREE.LineDashedMaterial({ color: AZUL, dashSize: 0.25, gapSize: 0.18, transparent: true, opacity: 0 }));
      tramoLinea.computeLineDistances(); scene.add(tramoLinea);
      const pulsos = [0, 1, 2].map(() => { const s = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), new THREE.MeshBasicMaterial({ color: AZUL, transparent: true, opacity: 0 })); scene.add(s); return s; });
      return { desde: c.pos, linea: tramoLinea, pulsos };
    });

    // Las otras sucursales: la ilustración de frente a la cámara, debajo de todo lo demás
    textura.colorSpace = THREE.SRGBColorSpace;
    const sucursales = SUCURSALES.map(([x, z]) => {
      const plano = new THREE.Mesh(new THREE.PlaneGeometry(SUC_ANCHO, SUC_ALTO), new THREE.MeshBasicMaterial({ map: textura, transparent: true, opacity: 0, depthTest: false, depthWrite: false }));
      plano.renderOrder = -1;
      plano.position.set(x, 0.2, z);
      scene.add(plano);
      // Su punto encendido: una sucursal más que entra al mismo reporte
      const punto = new THREE.Mesh(new THREE.CircleGeometry(0.9, 28), new THREE.MeshBasicMaterial({ color: AZUL, transparent: true, opacity: 0, depthTest: false, depthWrite: false }));
      punto.renderOrder = 2;
      punto.position.set(x + 5.5, 3.2, z - 1.5);
      scene.add(punto);
      return { plano, punto, centro: new THREE.Vector3(x, 0, z) };
    });

    datos = { camaras, personas, ruta, fila, conector, cajaConector, luz, envios, sucursales, destino };
    encuadrar();
    pintar();
  }

  // El zoom al que cabe un conjunto de esquinas, dejando abajo lugar para los rótulos
  function zoomPara(puntos, mira) {
    camara.position.copy(mira).add(DIRECCION); camara.lookAt(mira);
    for (let z = 1.8; z > 0.05; z *= 0.985) {
      camara.zoom = z; camara.updateProjectionMatrix(); camara.updateMatrixWorld();
      if (puntos.every((v) => { const p = v.clone().project(camara); return Math.abs(p.x) < 0.96 && p.y < 0.9 && p.y > -0.86; })) return z;
    }
    return 0.05;
  }
  function encuadrar() {
    const { clientWidth: w, clientHeight: h } = contenedor;
    const aspecto = w / h;
    const ancho = aspecto < 1.5 ? 29.8 : 19.8667 * aspecto, alto = ancho / aspecto;
    Object.assign(camara, { left: -ancho / 2, right: ancho / 2, top: alto / 2, bottom: -alto / 2 });
    zoomLocal = zoomPara(LOCAL, OBJETIVO);
    zoomTodas = zoomPara(TODAS, CENTRO_TODAS);
  }
  function ajustar() {
    const { clientWidth: w, clientHeight: h } = contenedor;
    if (!w || !h) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, w < 700 ? 1.6 : 1.75));
    renderer.setSize(w, h, false);
    encuadrar();
  }
  const proyectar = (v) => { const p = v.clone().project(camara); return { x: (p.x * 0.5 + 0.5) * contenedor.clientWidth, y: (-p.y * 0.5 + 0.5) * contenedor.clientHeight }; };

  function pintar() {
    if (!datos) return;
    const p = avance, s = (performance.now() - t0) / 1000;
    const n = PASOS.length, en = (i, largo = 0.45) => tramo(p, i / n, (i + largo) / n);
    const diag = en(0, 0.5), piloto = en(1), integra = en(2), escala = en(3, 0.7);
    const enPiloto = piloto * (1 - suave(en(2, 0.3)));

    // La cámara: el local completo; en el piloto se acerca a la fila; al escalar se aleja
    const foco = datos.fila?.centro || OBJETIVO;
    const mira = OBJETIVO.clone().lerp(foco, 0.45 * suave(enPiloto)).lerp(CENTRO_TODAS, suave(escala));
    camara.position.copy(mira).add(DIRECCION); camara.lookAt(mira);
    camara.zoom = mezclar(zoomLocal * (1 + 0.32 * suave(enPiloto)), zoomTodas, suave(escala));
    camara.updateProjectionMatrix();

    // Diagnóstico: las cámaras aparecen una por una; en el piloto manda la primera
    datos.camaras.forEach((c, i) => {
      const k = suave(tramo(diag, i * 0.25, i * 0.25 + 0.5));
      c.grupo.scale.setScalar(Math.max(0.001, k * (1 + 0.25 * Math.sin(k * Math.PI))));
      const principal = i === 0;
      const tenue = principal ? 1 : 1 - 0.65 * enPiloto;
      c.abanico.material.opacity = k * tenue * (0.15 + (principal ? 0.08 * enPiloto : 0)) * (1 - 0.6 * escala);
      c.borde.material.opacity = k * tenue * 0.5 * (1 - 0.6 * escala);
    });
    // Piloto: la fila se enciende y la gente pasa por ella
    if (datos.fila) datos.fila.m.material.opacity = enPiloto * (0.12 + 0.05 * Math.sin(s * 3));
    for (const a of datos.personas) {
      const { d } = idaYVuelta(datos.ruta.total, a.velocidad, 2, s + a.desfase);
      const { p: q } = datos.ruta.en(d);
      a.m.position.set(q.x, 0.06, q.z);
      a.m.material.opacity = piloto * (1 - 0.7 * escala);
    }
    // Integración: el conector aparece y el video viaja en pulsos hasta él
    const kc = suave(tramo(integra, 0, 0.5));
    datos.conector.scale.setScalar(Math.max(0.001, kc * (1 + 0.2 * Math.sin(kc * Math.PI))));
    datos.luz.material.opacity = 0.5 + 0.5 * Math.sin(s * 4);
    const flujo = integra * (1 - 0.8 * escala);
    datos.envios.forEach((e, i) => {
      e.linea.material.opacity = flujo * 0.45;
      e.pulsos.forEach((pulso, j) => {
        const f = (s * 0.45 + j / 3 + i * 0.17) % 1;
        pulso.position.copy(e.desde).lerp(datos.destino, f);
        pulso.material.opacity = flujo * Math.sin(f * Math.PI);
      });
    });
    // Escalamiento: entran las demás sucursales, cada una con su punto encendido
    datos.sucursales.forEach((su, i) => {
      const k = suave(tramo(escala, 0.25 + i * 0.1, 0.55 + i * 0.1));
      su.plano.quaternion.copy(camara.quaternion);
      su.plano.material.opacity = k;
      su.punto.quaternion.copy(camara.quaternion);
      su.punto.material.opacity = k * (0.75 + 0.25 * Math.sin(s * 3 + i));
    });

    renderer.render(scene, camara);
    alAvance?.({
      p, paso: PASOS[pasoEn(p)],
      anclas: { fila: proyectar(foco), conector: proyectar(datos.destino), camara: proyectar(datos.camaras[0].pos), centro: proyectar(new THREE.Vector3(0, 0, -7)) },
      fuerza: { diagnostico: diag * (1 - piloto), piloto: enPiloto, integracion: integra * (1 - escala), escalamiento: tramo(escala, 0.6, 0.9) },
    });
  }

  function bucle() {
    cuadro = 0;
    avance += (objetivo - avance) * 0.1;
    pintar();
    if (visible && !contenedor.closest(".corrida") && !matchMedia("(prefers-reduced-motion: reduce)").matches) cuadro = requestAnimationFrame(bucle);
  }
  const pedir = () => { if (!cuadro && visible) cuadro = requestAnimationFrame(bucle); };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) pedir(); }, { rootMargin: "100px" }).observe(contenedor);
  new ResizeObserver(() => { ajustar(); pintar(); }).observe(contenedor);
  ajustar();

  // El mismo restaurante de la escena de arriba: el navegador ya lo tiene guardado
  const cargador = new GLTFLoader();
  cargador.setMeshoptDecoder(MeshoptDecoder);
  const listo = Promise.all([
    cargador.loadAsync(`${base}restaurante.glb`),
    fetch(`${base}restaurante-caminos.json`).then((r) => r.json()),
    new THREE.TextureLoader().loadAsync(`${base}restaurante-sucursal.webp`),
  ]).then((d) => { construir(d); pedir(); });

  return { listo, avanzar(p) { objetivo = limitar(p); pedir(); } };
}
