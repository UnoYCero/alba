// La misma página sirve en español y en inglés (public/en/): el idioma sale de <html lang>.
const EN = document.documentElement.lang === "en";
const tr = (es, en) => (EN ? en : es);
// Alba Space: las simulaciones del Star Tracker 3 en 1.
// Parten de las que hizo Alan para alba-space.com (orientación, basura espacial,
// campo de visión y baffle), con la paleta y la letra de Alba y en español.
// Cada lienzo dibuja sólo mientras se ve; con «menos movimiento» dibuja un cuadro y ya.

const reducir = matchMedia("(prefers-reduced-motion: reduce)").matches;
const tiene3D = () => { if (document.documentElement.dataset.webgl === "off") return false; try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; } };
const LETRA = '"Hanken Grotesk", "Segoe UI", sans-serif';
const C = { fondo: "#040a17", estrella: "220,232,255", claro: "143,178,255", azul: "37,99,235", papel: "244,246,250", tenue: "143,178,255" };
// Lo que la galería de misiones mueve con el scroll: cada simulación recibe su avance (0 → 1)
const CONTROL = {};

function azar(semilla) {
  return function () {
    semilla |= 0; semilla = semilla + 0x6D2B79F5 | 0;
    let t = Math.imul(semilla ^ semilla >>> 15, 1 | semilla);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Prepara un lienzo nítido de 680 × 460 unidades lógicas (u otras), del ancho que tenga en la página
function lienzo(canvas, W = 680, H = 460) {
  const ajustar = () => {
    const d = Math.min(devicePixelRatio || 1, 2);
    canvas.width = W * d; canvas.height = H * d;
    canvas.getContext("2d").setTransform(d, 0, 0, d, 0, 0);
  };
  ajustar();
  return { x: canvas.getContext("2d"), W, H };
}

// Corre el dibujo mientras el lienzo está a la vista; con «menos movimiento», un cuadro al pedirlo
function bucle(canvas, dibujar) {
  if (reducir) { dibujar(9000); return () => dibujar(9000); }
  let corriendo = false, id = 0;
  const paso = (t) => { dibujar(t); id = requestAnimationFrame(paso); };
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !corriendo) { corriendo = true; id = requestAnimationFrame(paso); }
    else if (!e.isIntersecting && corriendo) { corriendo = false; cancelAnimationFrame(id); }
  }, { threshold: 0.05 }).observe(canvas);
  return () => {};
}

function fondo(x, W, H) {
  x.fillStyle = C.fondo; x.fillRect(0, 0, W, H);
}
// En lienzos angostos (celular) el texto crece para que se siga leyendo
const escalaTexto = (x) => Math.min(1.9, Math.max(1, 510 / (x.canvas.clientWidth || 680)));
function rotulo(x, texto, px, py, color = `rgba(${C.tenue},.85)`, tam = 13) {
  x.font = `400 ${Math.round(tam * escalaTexto(x))}px ${LETRA}`; x.fillStyle = color;
  const ancho = x.measureText(texto).width, limite = x.canvas.width / (x.getTransform().a || 1) - 8;
  x.fillText(texto, Math.max(8, Math.min(px, limite - ancho)), py);
}

// ── Misión 1 · Orientarse: las cuatro etapas del algoritmo ──
(function orientacion() {
  const canvas = document.getElementById("simOrientacion");
  if (!canvas) return;
  const { x, W, H } = lienzo(canvas);
  const r = azar(42);
  const campo = Array.from({ length: 46 }, () => ({ x: 30 + r() * (W - 60), y: 30 + r() * (H - 60), m: r() }));
  const brillantes = campo.map((s, i) => ({ ...s, i })).sort((a, b) => b.m - a.m).slice(0, 7);
  const NOMBRES = ["HIP 24436", "HIP 27989", "HIP 25336", "HIP 26311", "HIP 25930", "HIP 26727", "HIP 28614"];
  const ETAPA_MS = 3400;
  const ESTADO = EN ? ["Exposing the frame", "Finding the centroids", "Matching the catalog", "Orientation calculated"] : ["Exponiendo el fotograma", "Encontrando los centros", "Comparando con el catálogo", "Orientación calculada"];
  const pasos = [...document.querySelectorAll("[data-etapa]")];
  let manual = -1, manualDesde = 0, guiado = null;
  const etapaAhora = (t) => {
    if (reducir) return { p: manual >= 0 ? manual : 3, f: 1 };
    if (manual >= 0) return { p: manual, f: Math.min(1, (t - manualDesde) / 1200) };
    manual = -1;
    if (guiado) return guiado;
    const total = t % (4 * ETAPA_MS);
    return { p: Math.floor(total / ETAPA_MS), f: (total % ETAPA_MS) / ETAPA_MS };
  };
  const redibujar = bucle(canvas, (t) => {
    const { p, f } = etapaAhora(t);
    pasos.forEach((b) => b.setAttribute("aria-current", +b.dataset.etapa === p ? "step" : "false"));
    fondo(x, W, H);
    if (p === 0 && !reducir) {
      for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(${C.claro},${Math.random() * 0.14})`; x.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5); }
    }
    for (const s of campo) {
      const rad = 0.8 + s.m * 2.2, a = 0.35 + s.m * 0.6;
      const g = x.createRadialGradient(s.x, s.y, 0, s.x, s.y, rad * 3);
      g.addColorStop(0, `rgba(${C.estrella},${a})`); g.addColorStop(1, `rgba(${C.estrella},0)`);
      x.fillStyle = g; x.beginPath(); x.arc(s.x, s.y, rad * 3, 0, Math.PI * 2); x.fill();
    }
    if (p >= 1) {
      const n = p === 1 ? Math.ceil(f * brillantes.length) : brillantes.length;
      for (let i = 0; i < n; i++) {
        const s = brillantes[i];
        const lado = 14 + (p === 1 ? (1 - Math.min(1, f * 3)) * 26 : 0);
        x.strokeStyle = `rgba(${C.claro},.9)`; x.lineWidth = 1;
        x.beginPath(); x.arc(s.x, s.y, lado / 2, 0, Math.PI * 2); x.stroke();
        if (p === 1) rotulo(x, `${s.x.toFixed(2)}, ${s.y.toFixed(2)}`, s.x + 12, s.y - 10, `rgba(${C.claro},.85)`, 11);
      }
    }
    if (p >= 2) {
      const tri = [[0, 1, 2], [1, 3, 4], [2, 4, 5], [0, 5, 6]];
      const nT = p === 2 ? Math.ceil(f * tri.length) : tri.length;
      x.strokeStyle = `rgba(${C.claro},.45)`; x.lineWidth = 1;
      for (let i = 0; i < nT; i++) {
        const [a, b, c] = tri[i];
        x.beginPath(); x.moveTo(brillantes[a].x, brillantes[a].y); x.lineTo(brillantes[b].x, brillantes[b].y); x.lineTo(brillantes[c].x, brillantes[c].y); x.closePath(); x.stroke();
      }
      const nN = p === 2 ? Math.ceil(f * brillantes.length) : brillantes.length;
      for (let i = 0; i < nN; i++) rotulo(x, NOMBRES[i], brillantes[i].x + 12, brillantes[i].y + 18, `rgba(${C.papel},.8)`, 11);
    }
    if (p === 3) {
      const ang = t / 1400;
      const q = [Math.cos(ang / 2), 0.02 * Math.sin(t / 900), 0.13 * Math.sin(ang / 2), 0.99 * Math.sin(ang / 2)];
      const norma = Math.hypot(...q);
      const k = escalaTexto(x), alto = 76 * k;
      x.fillStyle = "rgba(4,10,23,.85)"; x.fillRect(16, H - alto - 16, Math.min(W - 32, 300 * k), alto);
      rotulo(x, tr("Hacia dónde apunta", "Where it points"), 28, H - alto + 8 * k, `rgba(${C.papel},1)`, 14);
      rotulo(x, `q = [${q.map((v) => (v / norma).toFixed(3)).join(", ")}]`, 28, H - alto + 30 * k, `rgba(${C.claro},.95)`, 12);
      rotulo(x, `${(1 + 4 * (0.5 + 0.5 * Math.sin(t / 2000))).toFixed(1)} ${tr("veces por segundo", "times per second")}`, 28, H - alto + 50 * k, `rgba(${C.claro},.8)`, 12);
      const gx = W - 90, gy = 90, L = 46;
      [[ang, "X", 1], [ang + Math.PI / 2, "Y", 1], [ang + Math.PI / 4, "Z", 0.55]].forEach(([a, n, k]) => {
        const ex = gx + Math.cos(a) * L * k, ey = gy + Math.sin(a) * L * k;
        x.strokeStyle = `rgba(${C.claro},.95)`; x.lineWidth = 1.5;
        x.beginPath(); x.moveTo(gx, gy); x.lineTo(ex, ey); x.stroke();
        rotulo(x, n, ex + 4, ey, `rgba(${C.papel},.9)`, 12);
      });
    }
    rotulo(x, ESTADO[p], 18, 26, `rgba(${C.papel},.9)`, 14);
  });
  pasos.forEach((b) => b.addEventListener("click", () => { manual = +b.dataset.etapa; manualDesde = performance.now(); redibujar(); }));
  // En la galería, cada etapa ocupa una cuarta parte del avance y termina de dibujarse antes de la siguiente
  CONTROL.orientacion = (k) => { const v = Math.min(3.999, k * 4); guiado = { p: Math.floor(v), f: Math.min(1, (v % 1) * 1.6) }; };
})();

// ── Misión 2 · Basura espacial: lo que ve el sensor y lo que ve el algoritmo ──
(function basura() {
  const canvas = document.getElementById("simBasura");
  if (!canvas) return;
  const { x, W, H } = lienzo(canvas);
  const r = azar(7);
  const campo = Array.from({ length: 60 }, () => ({ x: r() * W, y: r() * H, m: r() }));
  const botones = [...document.querySelectorAll("[data-vista]")];
  const bitacora = document.getElementById("bitacoraBasura");
  let vista = "sensor", ultimo = 0, lineas = [], manual = false;
  const objetos = [
    { sp: 0.000105, y0: 0.28, amp: 40, id: tr("Objeto 042", "Object 042"), ph: 0 },
    { sp: 0.000075, y0: 0.62, amp: -60, id: tr("Objeto 117", "Object 117"), ph: 2.1 },
  ];
  const redibujar = bucle(canvas, (t) => {
    fondo(x, W, H);
    const algoritmo = vista === "algoritmo";
    if (!algoritmo) {
      for (const s of campo) { x.fillStyle = `rgba(${C.estrella},${0.3 + s.m * 0.55})`; x.beginPath(); x.arc(s.x, s.y, 0.6 + s.m * 1.8, 0, Math.PI * 2); x.fill(); }
    } else if (!reducir) {
      x.fillStyle = `rgba(${C.claro},.06)`;
      for (let i = 0; i < 40; i++) x.fillRect(Math.random() * W, Math.random() * H, 1, 1);
    }
    for (const o of objetos) {
      const prog = ((t * o.sp + o.ph) % 1.3) - 0.15;
      const ox = prog * W, oy = H * o.y0 + Math.sin(prog * 4) * o.amp;
      const dy = Math.cos(prog * 4) * 4 * o.amp * o.sp * 90;
      const col = algoritmo ? C.claro : C.papel;
      const g = x.createLinearGradient(ox - 34, oy - dy * 6, ox, oy);
      g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(1, `rgba(${col},.95)`);
      x.strokeStyle = g; x.lineWidth = algoritmo ? 2.5 : 2;
      x.beginPath(); x.moveTo(ox - 34, oy - dy * 3); x.lineTo(ox, oy); x.stroke();
      if (ox > 0 && ox < W && algoritmo) {
        x.strokeStyle = `rgba(${C.claro},.9)`; x.lineWidth = 1;
        x.beginPath(); x.arc(ox, oy, 18, 0, Math.PI * 2); x.stroke();
        x.beginPath(); x.moveTo(ox, oy); x.lineTo(ox + 44, oy + dy * 2); x.stroke();
        rotulo(x, o.id, ox - 18, oy - 28, `rgba(${C.papel},.9)`, 12);
      }
    }
    rotulo(x, algoritmo ? tr("Fotograma actual menos el anterior: sólo queda lo que se mueve", "Current frame minus the previous one: only what moves remains") : tr("Lo que ve el sensor", "What the sensor sees"), 18, 26, `rgba(${C.papel},.9)`, 14);
    if (bitacora && !reducir && t - ultimo > 1600) {
      ultimo = t;
      const o = objetos[Math.floor(Math.random() * objetos.length)];
      lineas.push(EN ? `${o.id}: heading ${(Math.random() * 360).toFixed(0)}°, trajectory reported` : `${o.id}: rumbo ${(Math.random() * 360).toFixed(0)}°, trayectoria reportada`);
      if (lineas.length > 3) lineas.shift();
      bitacora.textContent = lineas.join("\n");
    }
  });
  botones.forEach((b) => b.addEventListener("click", () => {
    manual = true;
    vista = b.dataset.vista;
    botones.forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
    redibujar();
  }));
  // En la galería: la primera mitad, lo que ve el sensor; la segunda, lo que ve el algoritmo
  CONTROL.basura = (k) => {
    if (manual) return;
    const v = k < 0.5 ? "sensor" : "algoritmo";
    if (v === vista) return;
    vista = v;
    botones.forEach((o) => o.setAttribute("aria-pressed", String(o.dataset.vista === v)));
  };
})();

// ── Misión 3 · Acoplarse: el baffle como zoom ──
(function acoplamiento() {
  const canvas = document.getElementById("simAcoplamiento");
  const control = document.getElementById("controlBaffle");
  if (!canvas || !control) return;
  const { x, W, H } = lienzo(canvas);
  const r = azar(99);
  const campo = Array.from({ length: 70 }, () => ({ x: r() * W, y: r() * H, m: r() }));
  const lectura = { campo: document.getElementById("lecturaCampo"), focal: document.getElementById("lecturaFocal"), modo: document.getElementById("lecturaModo") };
  let ext = +control.value, meta = +control.value, manual = false;
  const dibujar = (t) => {
    ext += reducir ? meta - ext : (meta - ext) * 0.08;
    const e = ext / 100, campoV = 22 - 17 * e, focal = 16 + 34 * e, zoom = 22 / campoV, cerca = e > 0.55;
    lectura.campo.textContent = `${campoV.toFixed(1)}°`;
    lectura.focal.textContent = `${focal.toFixed(0)} mm`;
    lectura.modo.textContent = cerca ? tr("Acoplamiento", "Docking") : tr("Orientación", "Orientation");
    fondo(x, W, H);
    // Vista lateral: el instrumento, el baffle que se extiende y su cono de visión
    const lx = 44, ly = H / 2, largo = 200;
    x.fillStyle = "#122440"; x.strokeStyle = `rgba(${C.claro},.7)`; x.lineWidth = 1;
    x.fillRect(lx - 26, ly - 22, 30, 44); x.strokeRect(lx - 26, ly - 22, 30, 44);
    for (let i = 0; i < 3; i++) {
      const off = 4 + i * 14 * (0.35 + 0.65 * e);
      x.fillStyle = i % 2 ? "#17304f" : "#1d3a60";
      x.fillRect(lx + off, ly - 14 + i * 1.5, 14, 28 - i * 3); x.strokeRect(lx + off, ly - 14 + i * 1.5, 14, 28 - i * 3);
    }
    const punta = lx + 4 + 28 * (0.35 + 0.65 * e) + 14;
    const medio = (campoV / 2) * Math.PI / 180 * 5.2;
    x.fillStyle = `rgba(${C.azul},.12)`; x.strokeStyle = `rgba(${C.claro},.5)`;
    x.beginPath(); x.moveTo(punta, ly); x.lineTo(punta + largo, ly - Math.tan(medio) * largo); x.lineTo(punta + largo, ly + Math.tan(medio) * largo); x.closePath(); x.fill(); x.stroke();
    rotulo(x, tr("De lado", "Side view"), 18, 26, `rgba(${C.papel},.9)`, 14);
    // Vista del sensor: el cielo se acerca y aparece el vehículo objetivo
    const sx = W - 158, sy = H / 2, R = 128;
    x.save(); x.beginPath(); x.arc(sx, sy, R, 0, Math.PI * 2); x.clip();
    x.fillStyle = "#020711"; x.fillRect(sx - R, sy - R, R * 2, R * 2);
    for (const s of campo) {
      const zx = sx + (s.x / W - 0.5) * 2 * R * zoom * 0.9, zy = sy + (s.y / H - 0.5) * 2 * R * zoom * 0.9;
      if (Math.abs(zx - sx) > R || Math.abs(zy - sy) > R) continue;
      x.fillStyle = `rgba(${C.estrella},${0.3 + s.m * 0.5})`; x.beginPath(); x.arc(zx, zy, 0.7 + s.m * 1.6, 0, Math.PI * 2); x.fill();
    }
    const escala = 6 + 40 * e * e * zoom * 0.28, vaiven = reducir ? 0 : Math.sin(t / 900) * 4 * (1 - e);
    x.save(); x.translate(sx + vaiven, sy); x.rotate(reducir ? 0 : Math.sin(t / 2400) * 0.15); x.scale(escala / 10, escala / 10);
    x.fillStyle = "#1d3152"; x.strokeStyle = `rgba(${C.claro},1)`; x.lineWidth = 10 / escala;
    x.fillRect(-6, -6, 12, 12); x.strokeRect(-6, -6, 12, 12);
    x.fillStyle = "#123a63"; x.fillRect(-22, -4, 14, 8); x.strokeRect(-22, -4, 14, 8); x.fillRect(8, -4, 14, 8); x.strokeRect(8, -4, 14, 8);
    x.beginPath(); x.arc(0, 0, 2.6, 0, Math.PI * 2); x.fillStyle = `rgba(${C.papel},1)`; x.fill();
    x.restore();
    x.strokeStyle = `rgba(${C.claro},.55)`; x.lineWidth = 1;
    x.beginPath(); x.moveTo(sx - 16, sy); x.lineTo(sx + 16, sy); x.moveTo(sx, sy - 16); x.lineTo(sx, sy + 16); x.stroke();
    if (cerca) {
      x.strokeStyle = `rgba(${C.papel},.85)`; x.strokeRect(sx - escala * 2.4, sy - escala * 1.4, escala * 4.8, escala * 2.8);
      rotulo(x, tr("Objetivo fijado", "Target locked"), sx - escala * 2.4, sy - escala * 1.4 - 8, `rgba(${C.papel},.95)`, 12);
    }
    x.restore();
    x.strokeStyle = `rgba(${C.claro},.6)`; x.lineWidth = 1.5; x.beginPath(); x.arc(sx, sy, R, 0, Math.PI * 2); x.stroke();
    rotulo(x, tr("Lo que ve el sensor", "What the sensor sees"), sx - R, sy - R - 12, `rgba(${C.papel},.9)`, 14);
  };
  const redibujar = bucle(canvas, dibujar);
  control.addEventListener("input", () => { manual = true; meta = +control.value; redibujar(); });
  ["focus", "pointerdown", "keydown"].forEach(ev => control.addEventListener(ev, () => { manual = true; }));
  dibujar(0);
  // En la galería, el baffle se extiende mientras se baja
  CONTROL.acoplamiento = (k) => { if (manual) return; meta = Math.round(Math.min(1, Math.max(0, (k - 0.12) / 0.7)) * 100); control.value = String(meta); };
})();

// ── La galería de las tres misiones: pasa de lado mientras se baja ──
(function galeria() {
  const seccion = document.querySelector("[data-galeria]");
  if (!seccion) return;
  // Con «menos movimiento» o en pantallas muy bajas (un teléfono acostado), una misión debajo de otra
  if (reducir || matchMedia("(max-width: 760px), (max-height: 699px)").matches) { seccion.classList.add("corrida"); return; }
  const pista = seccion.querySelector(".st-galeria-pista");
  const paneles = [...seccion.querySelectorAll("[data-panel]")];
  const indice = [...seccion.querySelectorAll("[data-ir]")];
  const MISIONES = [null, "orientacion", "basura", "acoplamiento"];
  // Los tramos del recorrido: quieto en un panel, pasar al siguiente, quieto, pasar… (en pantallas)
  const PESOS = [0.18, 0.18, 0.45, 0.18, 0.4, 0.18, 0.4];
  const SUMA = PESOS.reduce((a, b) => a + b, 0);
  seccion.style.height = `${(SUMA + 1) * 100}svh`;
  const suave = (x) => x * x * (3 - 2 * x);
  const avance = () => {
    const r = seccion.getBoundingClientRect();
    return Math.min(1, Math.max(0, -r.top / (r.height - seccion.querySelector(".st-galeria-pin").offsetHeight)));
  };
  const ultimo = {};
  let actual = -1;
  const pintar = () => {
    if (seccion.classList.contains('corrida')) { paneles.forEach(el=>{el.inert=false;}); Object.values(CONTROL).forEach(fn=>fn(1)); return; }
    let u = avance() * SUMA, tramo = 0;
    while (tramo < PESOS.length - 1 && u > PESOS[tramo]) { u -= PESOS[tramo]; tramo++; }
    const local = Math.min(1, u / PESOS[tramo]);
    const pos = tramo % 2 ? (tramo - 1) / 2 + suave(local) : tramo / 2;
    pista.style.transform = `translateX(${-pos * 100}%)`;
    paneles.forEach((el, i) => {
      const d = i - pos;
      el.style.setProperty("--d", d.toFixed(3));
      el.style.setProperty("--o", Math.max(0, 1 - Math.abs(d) * 1.3).toFixed(3));
      el.inert = Math.abs(d) > 0.5;
    });
    // Cada simulación: antes de su tramo, al principio; durante, lo que se lleva; después, completa
    MISIONES.forEach((nombre, j) => {
      if (!nombre || !CONTROL[nombre]) return;
      const k = tramo < 2 * j ? 0 : tramo > 2 * j ? 1 : local;
      if (Math.abs((ultimo[nombre] ?? -1) - k) > 0.002) { ultimo[nombre] = k; CONTROL[nombre](k); }
    });
    const cerca = Math.round(pos);
    if (cerca !== actual) {
      actual = cerca;
      indice.forEach((a) => a.setAttribute("aria-current", String(+a.dataset.ir === cerca)));
    }
  };
  // Ir a una misión: al principio de su tramo quieto
  const irA = (j, suaveScroll = true) => {
    const u = PESOS.slice(0, 2 * j).reduce((a, b) => a + b, 0) + 0.02;
    const y = seccion.getBoundingClientRect().top + scrollY + (u / SUMA) * (seccion.offsetHeight - seccion.querySelector(".st-galeria-pin").offsetHeight);
    scrollTo({ top: y, behavior: suaveScroll ? "smooth" : "auto" });
  };
  document.querySelectorAll('a[href="#orientacion"], a[href="#basura"], a[href="#acoplamiento"]').forEach((a) => a.addEventListener("click", (e) => {
    e.preventDefault();
    irA(MISIONES.indexOf(a.getAttribute("href").slice(1)));
  }));
  addEventListener("scroll", pintar, { passive: true });
  addEventListener("resize", pintar);
  pintar();
  const pedida = MISIONES.indexOf(location.hash.slice(1));
  if (pedida > 0) requestAnimationFrame(() => irA(pedida, false));
})();

// ── Para quién: la Tierra con cuatro órbitas; la de la aplicación elegida se enciende ──
// Cada órbita es un círculo inclinado visto de frente: lo que pasa detrás de la Tierra se tapa.
// La Tierra es el disco de la ilustración del contacto (assets/space/tierra-disco.webp).
(function aplicaciones() {
  const canvas = document.getElementById("simOrbitas");
  if (!canvas) return;
  const { x, W, H } = lienzo(canvas, 640, 560);
  const botones = [...document.querySelectorAll("[data-app]")];
  const tierra = new Image();
  tierra.src = new URL("assets/space/tierra-disco.webp", import.meta.url).href;
  const CX = W / 2, CY = H / 2, RT = 150;
  const rad = (g) => (g * Math.PI) / 180;
  // Radio (en radios terrestres), inclinación, giro en pantalla, vueltas por segundo y satélites
  const ORBITAS = [
    { r: 1.42, i: 74, giro: -16, v: 0.05, n: 6 },
    { r: 1.74, i: 66, giro: 26, v: 0.035, n: 1 },
    { r: 1.24, i: 12, giro: 82, v: 0.07, n: 1 },
    { r: 1.92, i: 71, giro: 6, v: 0.028, n: 1 },
  ];
  // La basura que cruza la órbita de seguridad: otra órbita, con fragmentos sueltos
  const BASURA = { r: 1.7, i: 80, giro: -38, v: 0.03 };
  const ROTULO = [tr("Constelación · 6 satélites", "Constellation · 6 satellites"), tr("Objeto detectado", "Object detected"), tr("Apuntando a la Tierra", "Pointing at Earth"), tr("Acercamiento", "Approach")];
  const punto = (o, th) => {
    const R = o.r * RT, px = R * Math.cos(th), py = R * Math.sin(th) * Math.cos(rad(o.i)), pz = R * Math.sin(th) * Math.sin(rad(o.i));
    const g = rad(o.giro);
    return { x: CX + px * Math.cos(g) - py * Math.sin(g), y: CY + px * Math.sin(g) + py * Math.cos(g), z: pz };
  };
  const tapado = (p) => p.z < 0 && Math.hypot(p.x - CX, p.y - CY) < RT;
  let activa = 0, tocado = false;
  const trazo = (o, atras, encendida) => {
    x.strokeStyle = `rgba(${C.claro},${encendida ? (atras ? 0.4 : 0.95) : atras ? 0.1 : 0.24})`;
    x.lineWidth = encendida ? 1.6 : 1;
    x.beginPath();
    let pluma = false;
    for (let k = 0; k <= 160; k++) {
      const p = punto(o, (k / 160) * Math.PI * 2);
      if ((p.z < 0) !== atras) { pluma = false; continue; }
      if (pluma) x.lineTo(p.x, p.y); else { x.moveTo(p.x, p.y); pluma = true; }
    }
    x.stroke();
  };
  const satelite = (p, encendido, tam = 1) => {
    if (tapado(p)) return;
    const a = p.z < 0 ? 0.5 : 1;
    if (!encendido) { x.fillStyle = `rgba(${C.claro},${0.45 * a})`; x.beginPath(); x.arc(p.x, p.y, 2.4, 0, Math.PI * 2); x.fill(); return; }
    x.save(); x.translate(p.x, p.y); x.scale(tam, tam);
    x.fillStyle = `rgba(${C.claro},${0.9 * a})`; x.fillRect(-11, -2, 7, 4); x.fillRect(4, -2, 7, 4);
    x.fillStyle = `rgba(${C.papel},${a})`; x.fillRect(-3.5, -3.5, 7, 7);
    x.restore();
  };
  const dibujar = (t) => {
    const s = t / 1000;
    // La primera elección del visitante detiene el cambio automático de aplicaciones.
    if (!reducir && !tocado) activa = Math.floor(s / 5.5) % ORBITAS.length;
    botones.forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.app === activa)));
    // Sin fondo propio: la Tierra y sus órbitas flotan sobre la página, sin recuadro
    x.clearRect(0, 0, W, H);
    // Atrás: las mitades de las órbitas que pasan detrás de la Tierra
    ORBITAS.forEach((o, i) => trazo(o, true, i === activa));
    if (activa === 1) trazo(BASURA, true, false);
    if (tierra.complete && tierra.naturalWidth) x.drawImage(tierra, CX - RT, CY - RT, RT * 2, RT * 2);
    else { x.fillStyle = "#0b1628"; x.beginPath(); x.arc(CX, CY, RT, 0, Math.PI * 2); x.fill(); }
    ORBITAS.forEach((o, i) => trazo(o, false, i === activa));
    if (activa === 1) trazo(BASURA, false, false);
    // Los satélites de cada órbita
    let ancla = null;
    ORBITAS.forEach((o, i) => {
      for (let k = 0; k < o.n; k++) {
        const th = s * o.v * Math.PI * 2 + (k / o.n) * Math.PI * 2 + i;
        const p = punto(o, th);
        satelite(p, i === activa);
        if (i === activa && k === 0) ancla = p;
        // Observación: la línea que baja hasta la superficie
        if (i === activa && i === 2 && !tapado(p)) {
          const dx = CX - p.x, dy = CY - p.y, d = Math.hypot(dx, dy);
          x.strokeStyle = `rgba(${C.claro},.7)`; x.lineWidth = 1; x.setLineDash([3, 4]);
          x.beginPath(); x.moveTo(p.x, p.y); x.lineTo(p.x + (dx / d) * (d - RT), p.y + (dy / d) * (d - RT)); x.stroke(); x.setLineDash([]);
        }
        // Servicio: un segundo vehículo que se acerca y se aleja del primero
        if (i === activa && i === 3) {
          const q = punto(o, th - 0.05 - 0.07 * (0.5 + 0.5 * Math.sin(s * 0.9)));
          satelite(q, true, 0.7);
          if (!tapado(p) && !tapado(q)) {
            x.strokeStyle = `rgba(${C.papel},.55)`; x.lineWidth = 1; x.setLineDash([2, 3]);
            x.beginPath(); x.moveTo(p.x, p.y); x.lineTo(q.x, q.y); x.stroke(); x.setLineDash([]);
          }
        }
      }
    });
    // Seguridad: los fragmentos de basura y el que el instrumento detecta
    if (activa === 1) {
      for (let k = 0; k < 7; k++) {
        const p = punto(BASURA, s * BASURA.v * Math.PI * 2 + k * 0.5);
        if (tapado(p)) continue;
        x.fillStyle = `rgba(${C.papel},${p.z < 0 ? 0.35 : 0.75})`; x.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
        if (k === 3) { x.strokeStyle = `rgba(${C.claro},.95)`; x.lineWidth = 1; x.beginPath(); x.arc(p.x, p.y, 12, 0, Math.PI * 2); x.stroke(); ancla = p; }
      }
    }
    if (ancla && !tapado(ancla)) rotulo(x, ROTULO[activa], ancla.x + 16, ancla.y - 14, `rgba(${C.papel},.92)`, 13);
  };
  bucle(canvas, dibujar);
  tierra.addEventListener("load", () => { if (reducir) dibujar(9000); });
  botones.forEach((b) => b.addEventListener("click", () => { activa = +b.dataset.app; tocado = true; if (reducir) dibujar(9000); }));
  // Quien se acerca con el mouse o el teclado quiere leer: deja de cambiar sola
  const lista = botones[0]?.closest("ul");
  ["focusin", "pointerenter"].forEach((ev) => lista?.addEventListener(ev, () => { tocado = true; }));
})();

// ── El baffle que se despliega solo en órbita ──
(function baffle() {
  const escena = document.getElementById("escenaBaffle");
  const boton = document.getElementById("botonBaffle");
  const estado = document.getElementById("estadoBaffle");
  if (!escena || !boton) return;
  let desplegado = false, tocado = false;
  let poner = (valor) => {
    desplegado = valor;
    escena.classList.toggle("desplegado", desplegado);
    boton.textContent = desplegado ? tr("Plegar el baffle", "Stow the baffle") : tr("Desplegar el baffle", "Deploy the baffle");
    boton.setAttribute("aria-pressed", String(desplegado));
    estado.textContent = desplegado ? tr("Desplegado · 0.28 dm³", "Deployed · 0.28 dm³") : tr("Plegado para el lanzamiento · 0.13 dm³", "Stowed for launch · 0.13 dm³");
  };
  boton.addEventListener("click", () => { tocado = true; poner(!desplegado); });
  // El baffle en 3D (si carga) se despliega con el mismo botón; el dibujo queda de respaldo
  const caja = escena.closest("[data-baffle]");
  // Con la sección fija, el baffle se despliega mientras se baja: el volumen cuenta y cada rasgo
  // se enciende a su tiempo. Con «menos movimiento» o en pantallas muy bajas, el botón
  const seccion = caja.closest("[data-baffle-seccion]");
  const guiada = !!seccion && !reducir && !matchMedia("(max-width: 760px), (max-height: 699px)").matches;
  let visor3D = null, kd = 0;
  if (guiada) {
    seccion.classList.add("guiada");
    const rasgos = [...seccion.querySelectorAll(".rasgos-lista li")];
    const volumen = seccion.querySelector("[data-volumen]");
    const suave = (v) => v * v * (3 - 2 * v);
    let fase = "";
    const pintar = () => {
      if (!seccion.classList.contains('guiada')) return;
      const r = seccion.getBoundingClientRect();
      const k = Math.min(1, Math.max(0, -r.top / (r.height - seccion.querySelector(".st-baffle-pin").offsetHeight)));
      kd = suave(Math.min(1, Math.max(0, (k - 0.08) / 0.5)));
      visor3D?.fijar(kd);
      escena.classList.toggle("desplegado", kd > 0.5);
      volumen.textContent = (0.13 + 0.15 * kd).toFixed(2);
      const ahora = kd < 0.02 ? "plegado" : kd > 0.98 ? "desplegado" : "abriendo";
      if (ahora !== fase) {
        fase = ahora;
        estado.textContent = { plegado: tr("Plegado para el lanzamiento", "Stowed for launch"), abriendo: tr("Desplegándose", "Deploying"), desplegado: tr("Desplegado en órbita", "Deployed in orbit") }[ahora];
      }
      const activo = k < 0.45 ? 0 : k < 0.72 ? 1 : 2;
      rasgos.forEach((li, i) => li.classList.toggle("activa", i === activo));
    };
    addEventListener("scroll", pintar, { passive: true });
    pintar();
  } else if (!reducir) {
    new IntersectionObserver(([e], obs) => {
      if (e.isIntersecting) { setTimeout(() => { if (!tocado) poner(true); }, 700); obs.disconnect(); }
    }, { threshold: 0.5 }).observe(caja);
  }
  const lienzo3D = caja.querySelector(".baffle-lienzo");
  const montar = () => import("./space-3d.js?v=20261025e").then((m) => {
    const visor = m.montarStarTracker({ contenedor: lienzo3D.parentElement, lienzo: lienzo3D, base: new URL("assets/space/", import.meta.url).href, modo: "baffle", reducir });
    if (guiada) { visor3D = visor; visor.fijar(kd); }
    const ponerDibujo = poner;
    poner = (valor) => { ponerDibujo(valor); visor.desplegar(valor); };
    if (!guiada) visor.desplegar(desplegado);
    return visor.listo.then(() => caja.classList.add("con-3d"));
  }).catch((err) => console.warn("No se pudo montar el baffle en 3D:", err));
  if (lienzo3D && tiene3D()) new IntersectionObserver(([e], obs) => { if (e.isIntersecting) { obs.disconnect(); montar(); } }, { rootMargin: "100% 0px" }).observe(caja);
})();

// ── Por dentro: el instrumento se abre en sus piezas mientras se baja ──
(function porDentro() {
  const seccion = document.querySelector("[data-por-dentro]");
  if (!seccion) return;
  if (reducir || !tiene3D()) { seccion.classList.add("corrida"); return; }
  const escena = seccion.querySelector(".st-escena");
  const pasos = [...seccion.querySelectorAll("[data-paso]")];
  let elegido = 0;
  const avance = () => elegido;
  const controles = document.createElement("div");
  controles.className = "ritmo-controles"; controles.setAttribute("role", "group");
  controles.setAttribute("aria-label", document.documentElement.lang === "en" ? "Explore the instrument" : "Explora el instrumento");
  const selectores = pasos.map((li, i) => {
    const b = document.createElement("button"); b.type = "button"; b.textContent = li.querySelector("b").textContent;
    b.setAttribute("aria-pressed", String(i === 0)); controles.append(b);
    b.addEventListener("click", () => { elegido = (i + .65) / pasos.length; alPaso(li.dataset.paso); visor?.avanzar(elegido); });
    return b;
  });
  seccion.querySelector(".st-texto").insertBefore(controles, seccion.querySelector(".st-pasos"));
  let actual = "armado", visor = null;
  const alPaso = (paso) => {
    if (paso !== pasos[Math.min(pasos.length - 1, Math.floor(elegido * pasos.length))].dataset.paso) return;
    if (paso === actual) return;
    actual = paso;
    pasos.forEach((li, i) => {
      const activa = li.dataset.paso === paso; li.classList.toggle("activa", activa);
      li.inert = !activa; li.setAttribute("aria-hidden", String(!activa)); selectores[i].setAttribute("aria-pressed", String(activa));
    });
  };
  new IntersectionObserver(([e], obs) => {
    if (!e.isIntersecting) return;
    obs.disconnect();
    import("./space-3d.js?v=20261025e").then((m) => {
      visor = m.montarStarTracker({ contenedor: escena, lienzo: escena.querySelector(".st-lienzo"), base: new URL("assets/space/", import.meta.url).href, modo: "despiece", pasos: pasos.map((li) => li.dataset.paso), alPaso });
      visor.avanzar(avance());
      return visor.listo.then(() => escena.classList.add("con-3d"));
    }).catch((err) => { console.warn("No se pudo montar el Star Tracker en 3D:", err); seccion.classList.add("corrida"); });
  }, { rootMargin: "120% 0px" }).observe(seccion);
  addEventListener("scroll", () => visor?.avanzar(avance()), { passive: true });
})();
