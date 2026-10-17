// Alba Space: las simulaciones del Star Tracker 3 en 1.
// Parten de las que hizo Alan para alba-space.com (orientación, basura espacial,
// campo de visión y baffle), con la paleta y la letra de Alba y en español.
// Cada lienzo dibuja sólo mientras se ve; con «menos movimiento» dibuja un cuadro y ya.

const reducir = matchMedia("(prefers-reduced-motion: reduce)").matches;
const LETRA = '"Hanken Grotesk", "Segoe UI", sans-serif';
const C = { fondo: "#040a17", estrella: "220,232,255", claro: "143,178,255", azul: "37,99,235", papel: "244,246,250", tenue: "143,178,255" };

function azar(semilla) {
  return function () {
    semilla |= 0; semilla = semilla + 0x6D2B79F5 | 0;
    let t = Math.imul(semilla ^ semilla >>> 15, 1 | semilla);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Prepara un lienzo nítido de 680 × 460 unidades lógicas, del ancho que tenga en la página
function lienzo(canvas) {
  const W = 680, H = 460;
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
  const ESTADO = ["Exponiendo el fotograma", "Encontrando los centros", "Comparando con el catálogo", "Orientación calculada"];
  const pasos = [...document.querySelectorAll("[data-etapa]")];
  let manual = -1, manualDesde = 0;
  const etapaAhora = (t) => {
    if (reducir) return { p: manual >= 0 ? manual : 3, f: 1 };
    if (manual >= 0 && t - manualDesde < 7000) return { p: manual, f: Math.min(1, (t - manualDesde) / 1200) };
    manual = -1;
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
      rotulo(x, "Hacia dónde apunta", 28, H - alto + 8 * k, `rgba(${C.papel},1)`, 14);
      rotulo(x, `q = [${q.map((v) => (v / norma).toFixed(3)).join(", ")}]`, 28, H - alto + 30 * k, `rgba(${C.claro},.95)`, 12);
      rotulo(x, `${(1 + 4 * (0.5 + 0.5 * Math.sin(t / 2000))).toFixed(1)} veces por segundo`, 28, H - alto + 50 * k, `rgba(${C.claro},.8)`, 12);
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
  let vista = "sensor", ultimo = 0, lineas = [];
  const objetos = [
    { sp: 0.000105, y0: 0.28, amp: 40, id: "Objeto 042", ph: 0 },
    { sp: 0.000075, y0: 0.62, amp: -60, id: "Objeto 117", ph: 2.1 },
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
    rotulo(x, algoritmo ? "Fotograma actual menos el anterior: sólo queda lo que se mueve" : "Lo que ve el sensor", 18, 26, `rgba(${C.papel},.9)`, 14);
    if (bitacora && !reducir && t - ultimo > 1600) {
      ultimo = t;
      const o = objetos[Math.floor(Math.random() * objetos.length)];
      lineas.push(`${o.id}: rumbo ${(Math.random() * 360).toFixed(0)}°, trayectoria reportada`);
      if (lineas.length > 3) lineas.shift();
      bitacora.textContent = lineas.join("\n");
    }
  });
  botones.forEach((b) => b.addEventListener("click", () => {
    vista = b.dataset.vista;
    botones.forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
    redibujar();
  }));
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
  let ext = +control.value, meta = +control.value;
  const dibujar = (t) => {
    ext += reducir ? meta - ext : (meta - ext) * 0.08;
    const e = ext / 100, campoV = 22 - 17 * e, focal = 16 + 34 * e, zoom = 22 / campoV, cerca = e > 0.55;
    lectura.campo.textContent = `${campoV.toFixed(1)}°`;
    lectura.focal.textContent = `${focal.toFixed(0)} mm`;
    lectura.modo.textContent = cerca ? "Acoplamiento" : "Orientación";
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
    rotulo(x, "De lado", 18, 26, `rgba(${C.papel},.9)`, 14);
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
      rotulo(x, "Objetivo fijado", sx - escala * 2.4, sy - escala * 1.4 - 8, `rgba(${C.papel},.95)`, 12);
    }
    x.restore();
    x.strokeStyle = `rgba(${C.claro},.6)`; x.lineWidth = 1.5; x.beginPath(); x.arc(sx, sy, R, 0, Math.PI * 2); x.stroke();
    rotulo(x, "Lo que ve el sensor", sx - R, sy - R - 12, `rgba(${C.papel},.9)`, 14);
  };
  const redibujar = bucle(canvas, dibujar);
  control.addEventListener("input", () => { meta = +control.value; redibujar(); });
  dibujar(0);
})();

// ── El baffle que se despliega solo en órbita ──
(function baffle() {
  const escena = document.getElementById("escenaBaffle");
  const boton = document.getElementById("botonBaffle");
  const estado = document.getElementById("estadoBaffle");
  if (!escena || !boton) return;
  let desplegado = false;
  const poner = (valor) => {
    desplegado = valor;
    escena.classList.toggle("desplegado", desplegado);
    boton.textContent = desplegado ? "Plegar el baffle" : "Desplegar el baffle";
    boton.setAttribute("aria-pressed", String(desplegado));
    estado.textContent = desplegado ? "Desplegado · 0.28 dm³" : "Plegado para el lanzamiento · 0.13 dm³";
  };
  boton.addEventListener("click", () => poner(!desplegado));
  if (!reducir) {
    new IntersectionObserver(([e], obs) => {
      if (e.isIntersecting) { setTimeout(() => poner(true), 700); obs.disconnect(); }
    }, { threshold: 0.6 }).observe(escena);
  }
})();
