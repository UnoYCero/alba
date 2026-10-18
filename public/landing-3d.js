// Escena 3D del cielo de Alba Space, hecha sólo con trazos finos.
// Cada escena se pausa cuando no está en pantalla y, si la persona pidió menos
// movimiento, se dibuja una sola vez.
import * as THREE from "three";

const V = THREE.Vector3;
const CLARO = 0x8fb2ff;
const PAPEL = 0xf4f6fa;
const SUMA = THREE.AdditiveBlending;

let texturaPunto;
function puntoRedondo() {
  if (texturaPunto) return texturaPunto;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, "rgba(255,255,255,1)");
  r.addColorStop(0.25, "rgba(255,255,255,.75)");
  r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  texturaPunto = new THREE.CanvasTexture(c);
  return texturaPunto;
}

function base(canvas, { fov = 40, z = 8 } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.01, 200);
  camera.position.z = z;
  const ajustar = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(ajustar).observe(canvas);
  ajustar();
  return { renderer, scene, camera };
}

// Anima sólo mientras el lienzo se ve; con «menos movimiento», un cuadro y ya.
function bucle(canvas, cuadro, reducir) {
  let visible = true, id = 0;
  const t0 = performance.now();
  const paso = (ahora) => {
    // «pausado» lo pone la portada cuando el proyecto de esta escena no está a la vista
    if (!canvas.pausado) cuadro((ahora - t0) / 1000);
    if (visible && !reducir) id = requestAnimationFrame(paso);
  };
  new IntersectionObserver(([e]) => {
    const antes = visible;
    visible = e.isIntersecting;
    if (visible && !antes && !reducir) id = requestAnimationFrame(paso);
    if (!visible) cancelAnimationFrame(id);
  }).observe(canvas);
  id = requestAnimationFrame(paso);
}

// Girar arrastrando, con inercia
function arrastre(canvas) {
  const s = { x: 0, y: 0, vx: 0, vy: 0, activo: false, px: 0, py: 0 };
  canvas.addEventListener("pointerdown", (e) => {
    s.activo = true; s.px = e.clientX; s.py = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!s.activo) return;
    s.vx = (e.clientX - s.px) * 0.008;
    s.vy = (e.clientY - s.py) * 0.006;
    s.px = e.clientX; s.py = e.clientY;
    s.x += s.vx; s.y += s.vy;
  });
  const soltar = () => { s.activo = false; };
  canvas.addEventListener("pointerup", soltar);
  canvas.addEventListener("pointercancel", soltar);
  return s;
}

function linea(puntos, color, opacidad = 1, cerrada = false) {
  const g = new THREE.BufferGeometry().setFromPoints(puntos);
  const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity: opacidad, depthWrite: false });
  return cerrada ? new THREE.LineLoop(g, m) : new THREE.Line(g, m);
}

function arco(r, a0, a1, n = 64, centro = new V()) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * (i / n);
    pts.push(new V(Math.cos(a) * r, Math.sin(a) * r, 0).add(centro));
  }
  return pts;
}

function brillo(color, escala, opacidad) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puntoRedondo(), color, transparent: true, opacity: opacidad, blending: SUMA, depthWrite: false }));
  s.scale.setScalar(escala);
  return s;
}

// ── El cielo de Alba Space ─────────────────────────────────────────────
function cielo(canvas, op) {
  const { renderer, scene, camera } = base(canvas, { fov: 60, z: 0.01 });
  const esfera = new THREE.Group();
  scene.add(esfera);
  const R = 50;
  const dir = () => {
    const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
    return new V(r * Math.cos(a), u, r * Math.sin(a));
  };
  const todas = [];
  const capa = (n, tam, opacidad) => {
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const d = dir();
      todas.push(d);
      pos.set([d.x * R, d.y * R, d.z * R], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: tam, map: puntoRedondo(), color: PAPEL, transparent: true, opacity: opacidad, depthWrite: false, blending: SUMA }));
    esfera.add(pts);
    return pts;
  };
  const pocas = innerWidth < 700;
  capa(pocas ? 1400 : 2600, 0.28, 0.75);
  capa(pocas ? 260 : 420, 0.5, 0.9);
  const brillantes = capa(70, 1.0, 1);

  // Constelaciones ilustrativas: a la derecha (a la izquierda va el texto)
  const constelaciones = [];
  for (let k = 0; k < 6; k++) {
    const ancla = new V(0.15 + Math.random() * 0.55, (Math.random() - 0.5) * 0.6, -1).normalize();
    const cerca = todas.map((d) => ({ d, c: d.dot(ancla) })).filter((o) => o.c > 0.985).sort((a, b) => b.c - a.c).slice(0, 7).map((o) => o.d);
    if (cerca.length < 4) continue;
    // camino por vecino más cercano
    const camino = [cerca.shift()];
    while (cerca.length) {
      const ult = camino[camino.length - 1];
      cerca.sort((a, b) => b.dot(ult) - a.dot(ult));
      camino.push(cerca.shift());
    }
    const l = linea(camino.map((d) => d.clone().multiplyScalar(R * 0.995)), CLARO, 0.85);
    l.geometry.setDrawRange(0, 0);
    l.userData.n = camino.length;
    // un punto de luz en cada estrella de la constelación
    const vert = new THREE.BufferGeometry().setFromPoints(camino.map((d) => d.clone().multiplyScalar(R * 0.99)));
    const luces = new THREE.Points(vert, new THREE.PointsMaterial({ size: 1.6, map: puntoRedondo(), color: CLARO, transparent: true, opacity: 0, depthWrite: false, blending: SUMA }));
    l.userData.luces = luces;
    esfera.add(l, luces);
    constelaciones.push(l);
  }

  // Un CubeSat pequeño que cruza el campo de vista
  const sat = new THREE.Group();
  const aristas = (geo, op2) => new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: PAPEL, transparent: true, opacity: op2 }));
  sat.add(aristas(new THREE.BoxGeometry(0.5, 0.5, 0.75), 0.9));
  for (const sx of [-1, 1]) {
    const panel = aristas(new THREE.PlaneGeometry(0.9, 0.42, 3, 1), 0.6);
    panel.position.x = sx * 0.72;
    sat.add(panel);
  }
  const luzSat = brillo(CLARO, 0.5, 0.8);
  luzSat.position.set(0, 0, 0.4);
  sat.add(luzSat);
  scene.add(sat);

  const hud = document.querySelector("[data-hud]");
  const s = arrastre(canvas);
  let activa = -1;
  bucle(canvas, (t) => {
    if (!s.activo) { s.vx *= 0.95; s.vy *= 0.95; s.x += s.vx; s.y += s.vy; }
    s.y = Math.max(-0.5, Math.min(0.5, s.y));
    esfera.rotation.y = s.x - t * 0.006;
    esfera.rotation.x = s.y;
    brillantes.material.opacity = 0.8 + Math.sin(t * 2.2) * 0.2;

    // Cada constelación se dibuja, se queda un momento y se apaga (6 s cada una)
    if (constelaciones.length) {
      const ciclo = 6;
      const i = Math.floor(t / ciclo) % constelaciones.length;
      const f = (t % ciclo) / ciclo;
      constelaciones.forEach((l, j) => {
        if (j !== i) { l.geometry.setDrawRange(0, 0); l.userData.luces.material.opacity = 0; return; }
        const hasta = Math.max(2, Math.ceil(Math.min(1, f / 0.4) * l.userData.n));
        l.geometry.setDrawRange(0, hasta);
        l.userData.luces.geometry.setDrawRange(0, hasta);
        l.material.opacity = f < 0.8 ? 0.85 : 0.85 * (1 - (f - 0.8) / 0.2);
        l.userData.luces.material.opacity = l.material.opacity;
      });
      if (op.reducir) constelaciones.forEach((l) => { l.geometry.setDrawRange(0, l.userData.n); l.material.opacity = 0.7; l.userData.luces.geometry.setDrawRange(0, l.userData.n); l.userData.luces.material.opacity = 0.7; });
      if (hud && i !== activa) {
        activa = i;
        hud.textContent = document.documentElement.lang === "en" ? `Region ${i + 1} of ${constelaciones.length} · ${constelaciones[i].userData.n} stars` : `Región ${i + 1} de ${constelaciones.length} · ${constelaciones[i].userData.n} estrellas`;
      }
    }

    const ida = ((t * 0.018) % 1);
    sat.position.set(2 + ida * 24, -4 + Math.sin(ida * Math.PI) * 2.6, -22);
    sat.rotation.set(t * 0.2, t * 0.3, t * 0.1);
    renderer.render(scene, camera);
  }, op.reducir);
}

const escenas = { cielo };
export function montar(canvas, tipo, op) {
  const escena = escenas[tipo];
  if (escena) escena(canvas, op);
}
