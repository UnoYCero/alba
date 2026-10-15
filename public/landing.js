// Portada de Alba Vision: menú flotante, origen y Alba Vision en pantallas fijas
// que cambian al bajar, collage de hitos explorable, y el 3D cargado sólo cuando se va a ver.

const prefMovimiento = matchMedia("(prefers-reduced-motion: reduce)");
const punteroFino = matchMedia("(pointer: fine)").matches;
const celular = matchMedia("(max-width: 760px)");
const anchoMenu = matchMedia("(max-width: 1080px)");
let reducir = prefMovimiento.matches;
document.documentElement.classList.toggle("reduce", reducir);
const limitar = (v) => Math.min(1, Math.max(0, v));

document.querySelectorAll("[data-year]").forEach((el) => { el.textContent = new Date().getFullYear(); });
// El titular entra al cargar o, si hay apertura de ojos, cuando los ojos se abren
const mostrarPortada = () => document.querySelector(".hero")?.classList.add("listo");

// ── Menú: se compacta al bajar y marca la sección en la que estás ──
const nav = document.querySelector("[data-nav]");
const marcador = nav.querySelector(".nav-marker");
const enlacesSpy = [...nav.querySelectorAll("[data-spy]")];
const seccionesSpy = enlacesSpy.map((a) => document.getElementById(a.dataset.spy));
function espiar() {
  nav.classList.toggle("scrolled", scrollY > 40);
  let activo = null;
  seccionesSpy.forEach((s, i) => {
    const r = s.getBoundingClientRect();
    if (r.top < innerHeight * 0.45 && r.bottom > innerHeight * 0.45) activo = enlacesSpy[i];
  });
  enlacesSpy.forEach((a) => a.classList.toggle("activo", a === activo));
  if (activo) {
    marcador.style.setProperty("--mx", `${activo.offsetLeft}px`);
    marcador.style.setProperty("--mw", (activo.offsetWidth / 100).toFixed(3));
    marcador.style.opacity = "1";
  } else {
    marcador.style.opacity = "0";
  }
}

// ── Menú del celular: se cierra con Escape, al elegir y al cambiar de ancho ──
const boton = document.querySelector("[data-nav-toggle]");
const panelMenu = document.querySelector("[data-nav-panel]");
const menuAbierto = () => boton.getAttribute("aria-expanded") === "true";
function cerrarMenu({ devolverFoco = false } = {}) {
  boton.setAttribute("aria-expanded", "false");
  boton.setAttribute("aria-label", "Abrir menú");
  panelMenu.classList.remove("abierto");
  document.body.style.overflow = "";
  if (devolverFoco && anchoMenu.matches) boton.focus();
}
boton.addEventListener("click", () => {
  if (menuAbierto()) return cerrarMenu();
  boton.setAttribute("aria-expanded", "true");
  boton.setAttribute("aria-label", "Cerrar menú");
  panelMenu.classList.add("abierto");
  document.body.style.overflow = "hidden";
});
panelMenu.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => cerrarMenu()));
addEventListener("keydown", (e) => { if (e.key === "Escape" && menuAbierto()) cerrarMenu({ devolverFoco: true }); });
anchoMenu.addEventListener("change", () => { if (menuAbierto()) cerrarMenu(); });

// ── Apariciones ──
const grupos = new Map();
document.querySelectorAll(".reveal").forEach((el) => {
  const n = grupos.get(el.parentElement) || 0;
  el.style.setProperty("--i", n);
  grupos.set(el.parentElement, n + 1);
});
const aparecer = new IntersectionObserver((entradas) => {
  entradas.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); aparecer.unobserve(e.target); } });
}, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
document.querySelectorAll(".reveal").forEach((el) => aparecer.observe(el));

// Avance de una sección fija: 0 al llegar, 1 al terminar
const avanceFijo = (seccion) => {
  const r = seccion.getBoundingClientRect();
  return limitar(-r.top / (r.height - innerHeight));
};

// ── Origen: se lee desde el inicio; las palabras se encienden y la misión y la visión llegan pronto ──
const origen = document.querySelector(".origen");
const scrub = origen.querySelector("[data-scrub]");
scrub.innerHTML = scrub.textContent.trim().split(/\s+/).map((p) => `<span class="w">${p}</span>`).join(" ");
const palabras = [...scrub.querySelectorAll(".w")];
function encender() {
  if (reducir) {
    palabras.forEach((w) => w.classList.add("on"));
    origen.classList.add("fin");
    return;
  }
  const p = avanceFijo(origen);
  const hasta = Math.round(limitar(p / 0.5) * palabras.length);
  palabras.forEach((w, i) => w.classList.toggle("on", i < hasta));
  origen.classList.toggle("fin", p > 0.35);
}

// ── Alba Vision: la ventana cambia de proyecto al bajar ──
// En teléfonos bajitos (o con «menos movimiento») se vuelve contenido corrido.
const ventana = document.querySelector("[data-window]");
const botones = [...ventana.querySelectorAll("[data-item]")];
const paneles = [...ventana.querySelectorAll("[data-panel]")];
let activoVentana = -1;
const apilada = () => reducir || (celular.matches && innerHeight < 700);
function ventanaAlBajar() {
  const corrida = apilada();
  ventana.classList.toggle("apilado", corrida && !reducir);
  if (corrida) {
    paneles.forEach((p) => p.classList.add("activo"));
    activoVentana = -1;
    return;
  }
  const i = Math.min(paneles.length - 1, Math.floor(avanceFijo(ventana) * paneles.length));
  if (i === activoVentana) return;
  activoVentana = i;
  paneles.forEach((p, j) => p.classList.toggle("activo", j === i));
  botones.forEach((b, j) => b.setAttribute("aria-current", j === i ? "true" : "false"));
}
botones.forEach((b, j) => b.addEventListener("click", () => {
  if (apilada()) {
    paneles[j].scrollIntoView({ behavior: reducir ? "auto" : "smooth", block: "start" });
    return;
  }
  const recorrido = ventana.offsetHeight - innerHeight;
  scrollTo({ top: ventana.offsetTop + recorrido * ((j + 0.5) / paneles.length), behavior: reducir ? "auto" : "smooth" });
}));

// Un solo manejador de desplazamiento, una vez por cuadro
let pendiente = false;
function alDesplazar() {
  if (pendiente) return;
  pendiente = true;
  requestAnimationFrame(() => { pendiente = false; espiar(); encender(); ventanaAlBajar(); });
}
addEventListener("scroll", alDesplazar, { passive: true });
addEventListener("resize", alDesplazar);
espiar(); encender(); ventanaAlBajar();

// ── Collage de hitos: avanza solo, se puede deslizar, pausar o mover con flechas ──
const collage = document.querySelector("[data-collage]");
const pausa = document.querySelector("[data-pausa]");
let pausadoPorPersona = false;
let encima = false;
let collageVisible = false;
const pasoCollage = () => {
  const li = collage.querySelector(".postal");
  return li ? li.offsetWidth + parseFloat(getComputedStyle(li.parentElement).gap || 0) : 300;
};
function moverCollage(dir) {
  const fin = collage.scrollWidth - collage.clientWidth - 4;
  if (dir > 0 && collage.scrollLeft >= fin) collage.scrollTo({ left: 0, behavior: reducir ? "auto" : "smooth" });
  else if (dir < 0 && collage.scrollLeft <= 4) collage.scrollTo({ left: fin, behavior: reducir ? "auto" : "smooth" });
  else collage.scrollBy({ left: dir * pasoCollage(), behavior: reducir ? "auto" : "smooth" });
}
document.querySelectorAll("[data-hito]").forEach((b) => b.addEventListener("click", () => moverCollage(Number(b.dataset.hito))));
function ponerPausa(valor) {
  pausadoPorPersona = valor;
  pausa.setAttribute("aria-pressed", String(valor));
  pausa.textContent = valor ? "Reanudar" : "Pausar";
}
pausa.addEventListener("click", () => ponerPausa(!pausadoPorPersona));
collage.addEventListener("pointerenter", () => { encima = true; });
collage.addEventListener("pointerleave", () => { encima = false; });
collage.addEventListener("focusin", () => { encima = true; });
collage.addEventListener("focusout", () => { encima = false; });
collage.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") { e.preventDefault(); moverCollage(1); }
  if (e.key === "ArrowLeft") { e.preventDefault(); moverCollage(-1); }
});
new IntersectionObserver(([e]) => { collageVisible = e.isIntersecting; }).observe(collage);
setInterval(() => {
  if (!reducir && !pausadoPorPersona && !encima && collageVisible && !document.hidden) moverCollage(1);
}, 4200);
if (reducir) ponerPausa(true);

// ── Botón magnético (sólo con mouse) ──
if (punteroFino) {
  document.querySelectorAll(".magnetic").forEach((el) => {
    el.addEventListener("pointermove", (e) => {
      if (reducir) return;
      const r = el.getBoundingClientRect();
      el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.2}px, ${(e.clientY - r.top - r.height / 2) * 0.3}px)`;
    });
    el.addEventListener("pointerleave", () => { el.style.transform = ""; });
  });
}

// ── 3D: cada lienzo se monta cuando su sección está cerca ──
const lienzos = [...document.querySelectorAll("canvas[data-3d]")];
let modulo;
const montar = async (canvas) => {
  try {
    modulo ||= import("./landing-3d.js");
    (await modulo).montar(canvas, canvas.dataset["3d"], { reducir, punteroFino });
  } catch (err) {
    canvas.remove();
    console.warn("No se pudo cargar el 3D:", err);
  }
};
const cerca = new IntersectionObserver((entradas) => {
  entradas.forEach((e) => { if (e.isIntersecting) { cerca.unobserve(e.target); montar(e.target); } });
}, { rootMargin: "400px 0px" });
lienzos.forEach((c) => cerca.observe(c));

// ── «Menos movimiento» que responde aunque se cambie con la página abierta ──
prefMovimiento.addEventListener("change", (e) => {
  reducir = e.matches;
  document.documentElement.classList.toggle("reduce", reducir);
  lienzos.forEach((c) => { c.pausado = reducir; });
  ponerPausa(reducir);
  if (!reducir) { paneles.forEach((p) => p.classList.remove("activo")); activoVentana = -1; }
  alDesplazar();
});

// ═══ Propuesta «amanecer» ═══

// ── El cielo amanece al bajar: cada sección tiene su color y se mezclan en la frontera ──
const cieloAlba = document.querySelector("[data-cielo-alba]");
const coloresCielo = { inicio: "#03081a", origen: "#0b2142", "quienes-somos": "#13366c", capacidades: "#e3ecf8", "alba-vision": "#f4f6fa", "alba-space": "#03081a", contacto: "#050d1c" };
const seccionesCielo = Object.keys(coloresCielo).map((id) => document.getElementById(id)).filter(Boolean);
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
function amanecer() {
  const y = scrollY + innerHeight * 0.55;
  let i = seccionesCielo.findIndex((s) => y >= s.offsetTop && y < s.offsetTop + s.offsetHeight);
  if (i < 0) i = y < seccionesCielo[0].offsetTop ? 0 : seccionesCielo.length - 1;
  const s = seccionesCielo[i];
  const sig = seccionesCielo[Math.min(i + 1, seccionesCielo.length - 1)];
  const zona = Math.min(innerHeight * 0.6, s.offsetHeight * 0.4);
  const f = limitar((y - (s.offsetTop + s.offsetHeight - zona)) / zona);
  const a = hexRgb(coloresCielo[s.id]), b = hexRgb(coloresCielo[sig.id]);
  const c = a.map((v, k) => Math.round(v + (b[k] - v) * f));
  cieloAlba.style.backgroundColor = `rgb(${c.join(",")})`;
  // El menú flotante se aclara cuando pasa sobre una sección de día
  const bajoMenu = seccionesCielo.find((x) => scrollY + 40 >= x.offsetTop && scrollY + 40 < x.offsetTop + x.offsetHeight);
  nav.classList.toggle("claro", !!bajoMenu && bajoMenu.classList.contains("tema-dia"));
}
addEventListener("scroll", () => requestAnimationFrame(amanecer), { passive: true });
addEventListener("resize", amanecer);
amanecer();

// ── El ojo 3D (se carga aparte: si falla, queda el símbolo fijo y la página sigue) ──
let ojo = null;
const ojoListo = import("./ojo.js").then((m) => { ojo = m.montarOjo(); return ojo; }).catch((err) => { console.warn("No se pudo cargar el ojo 3D:", err); return null; });

// ── La apertura de ojos: sólo en la primera visita de la sesión ──
function primeraVisita() {
  try {
    if (sessionStorage.getItem("alba-ojos")) return false;
    sessionStorage.setItem("alba-ojos", "1");
    return true;
  } catch { return true; }
}
function abrirOjos() {
  const capa = document.createElement("div");
  capa.className = "apertura";
  capa.setAttribute("aria-hidden", "true");
  capa.innerHTML = '<svg><defs><mask id="mascara-ojos"><rect width="100%" height="100%" fill="#fff"/><path fill="#000"/></mask></defs><rect width="100%" height="100%" fill="#000" mask="url(#mascara-ojos)"/></svg><button type="button" class="apertura-saltar">Saltar</button>';
  document.body.appendChild(capa);
  const almendra = capa.querySelector("path");
  const DURACION = 2300;
  let t0 = performance.now(), velocidad = 1, avance = 0, ultimo = t0, terminado = false;
  const suave = (x) => 1 - Math.pow(1 - x, 3);
  const tramo = (x, a, b) => limitar((x - a) / (b - a));
  function dibujar(x) {
    const w = innerWidth, h = innerHeight, cx = w / 2, cy = h * 0.46;
    // Se entreabre, parpadea y se abre del todo; al final la almendra crece hasta cubrir la pantalla
    let alto = 0.07 * suave(tramo(x, 0.04, 0.24));
    alto -= 0.05 * suave(tramo(x, 0.26, 0.34));
    alto += 0.3 * suave(tramo(x, 0.38, 0.66));
    const ancho = 0.34 + 0.06 * suave(tramo(x, 0.38, 0.66));
    const crece = 1 + 7 * Math.pow(tramo(x, 0.7, 1), 2.2);
    const aw = w * ancho * crece, ah = h * Math.max(0, alto) * crece;
    almendra.setAttribute("d", `M${cx - aw} ${cy} Q${cx} ${cy - 2 * ah} ${cx + aw} ${cy} Q${cx} ${cy + 2 * ah} ${cx - aw} ${cy} Z`);
    capa.style.opacity = String(1 - tramo(x, 0.86, 1));
  }
  function cuadro(ahora) {
    avance += ((ahora - ultimo) / DURACION) * velocidad;
    ultimo = ahora;
    dibujar(limitar(avance));
    if (avance > 0.42 && !capa.dataset.portada) { capa.dataset.portada = "1"; mostrarPortada(); ojoListo.then((o) => o?.despertar(1400)); }
    if (avance < 1) requestAnimationFrame(cuadro);
    else terminar();
  }
  function terminar() {
    if (terminado) return;
    terminado = true;
    mostrarPortada();
    capa.remove();
    ["pointerdown", "keydown", "wheel", "touchstart"].forEach((ev) => removeEventListener(ev, apurar));
  }
  function apurar() { velocidad = 5; }
  ["pointerdown", "keydown", "wheel", "touchstart"].forEach((ev) => addEventListener(ev, apurar, { passive: true }));
  capa.querySelector(".apertura-saltar").addEventListener("click", () => { velocidad = 8; });
  dibujar(0);
  requestAnimationFrame(cuadro);
}
if (!reducir && primeraVisita()) abrirOjos();
else requestAnimationFrame(mostrarPortada);
