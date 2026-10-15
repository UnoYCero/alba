// Portada de Alba Vision: menú flotante, origen y proyectos en pantallas fijas
// que cambian al bajar, línea del tiempo, y el 3D cargado sólo cuando se va a ver.

const reducir = matchMedia("(prefers-reduced-motion: reduce)").matches;
const punteroFino = matchMedia("(pointer: fine)").matches;
document.documentElement.classList.toggle("reduce", reducir);
const limitar = (v) => Math.min(1, Math.max(0, v));

document.querySelectorAll("[data-year]").forEach((el) => { el.textContent = new Date().getFullYear(); });
requestAnimationFrame(() => document.querySelector(".hero")?.classList.add("listo"));

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

// ── Menú del celular ──
const boton = document.querySelector("[data-nav-toggle]");
const panel = document.querySelector("[data-nav-panel]");
const cerrarMenu = () => {
  boton.setAttribute("aria-expanded", "false");
  boton.setAttribute("aria-label", "Abrir menú");
  panel.classList.remove("abierto");
  document.body.style.overflow = "";
};
boton.addEventListener("click", () => {
  if (boton.getAttribute("aria-expanded") === "true") return cerrarMenu();
  boton.setAttribute("aria-expanded", "true");
  boton.setAttribute("aria-label", "Cerrar menú");
  panel.classList.add("abierto");
  document.body.style.overflow = "hidden";
});
panel.querySelectorAll("a").forEach((a) => a.addEventListener("click", cerrarMenu));
addEventListener("keydown", (e) => { if (e.key === "Escape") cerrarMenu(); });

// ── Apariciones sencillas ──
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

// ── Origen: el texto se enciende palabra por palabra ──
const origen = document.querySelector(".origen");
const scrub = origen?.querySelector("[data-scrub]");
let palabras = [];
if (scrub && !reducir) {
  scrub.innerHTML = scrub.textContent.trim().split(/\s+/).map((p) => `<span class="w">${p}</span>`).join(" ");
  palabras = [...scrub.querySelectorAll(".w")];
}
function encender() {
  if (!palabras.length) return;
  const p = avanceFijo(origen);
  const hasta = Math.round(limitar(p / 0.8) * palabras.length);
  palabras.forEach((w, i) => w.classList.toggle("on", i < hasta));
  origen.classList.toggle("fin", p > 0.82);
}

// ── Proyectos: una ventana que cambia de proyecto al bajar ──
const works = document.querySelector("[data-works]");
const tabs = [...works.querySelectorAll("[data-tab]")];
const obras = [...works.querySelectorAll("[data-work]")];
const visuales = [...works.querySelectorAll("[data-visual]")];
const lienzoLentes = works.querySelector('canvas[data-3d="lentes"]');
const lienzoCielo = works.querySelector('canvas[data-3d="cielo"]');
let activoWorks = -1;
function proyectos() {
  if (reducir) return;
  const p = avanceFijo(works);
  works.style.setProperty("--p", p.toFixed(3));
  works.querySelector(".works-progress").style.setProperty("--p", p.toFixed(3));
  const i = Math.min(2, Math.floor(p * 3));
  if (i === activoWorks) return;
  activoWorks = i;
  works.dataset.activo = String(i);
  obras.forEach((o, j) => o.classList.toggle("activo", j === i));
  visuales.forEach((v, j) => v.classList.toggle("activo", j === i));
  tabs.forEach((t, j) => t.setAttribute("aria-current", j === i ? "true" : "false"));
  if (lienzoLentes) lienzoLentes.pausado = i !== 0;
  if (lienzoCielo) lienzoCielo.pausado = i !== 2;
}
tabs.forEach((t, j) => t.addEventListener("click", () => {
  const recorrido = works.offsetHeight - innerHeight;
  scrollTo({ top: works.offsetTop + recorrido * ((j + 0.5) / 3), behavior: reducir ? "auto" : "smooth" });
}));
if (reducir) obras.forEach((o) => o.classList.add("activo"));

// ── Cómo trabajamos: la línea se llena al bajar ──
const pasos = document.querySelector("[data-steps]");
function llenarPasos() {
  if (!pasos) return;
  const r = pasos.getBoundingClientRect();
  pasos.style.setProperty("--p", limitar((innerHeight * 0.85 - r.top) / (innerHeight * 0.5)).toFixed(3));
}

// Un solo manejador de desplazamiento, una vez por cuadro
let pendiente = false;
function alDesplazar() {
  if (pendiente) return;
  pendiente = true;
  requestAnimationFrame(() => { pendiente = false; espiar(); encender(); proyectos(); llenarPasos(); });
}
addEventListener("scroll", alDesplazar, { passive: true });
addEventListener("resize", alDesplazar);
espiar(); encender(); proyectos(); llenarPasos();

// ── Línea del tiempo: flechas que avanzan un hito ──
const pista = document.querySelector(".timeline-track");
const [atras, adelante] = document.querySelectorAll("[data-tl]");
function flechas() {
  atras.disabled = pista.scrollLeft < 8;
  adelante.disabled = pista.scrollLeft > pista.scrollWidth - pista.clientWidth - 8;
}
[atras, adelante].forEach((b) => b.addEventListener("click", () => {
  const paso = pista.querySelector("li").offsetWidth;
  pista.scrollBy({ left: paso * Number(b.dataset.tl), behavior: reducir ? "auto" : "smooth" });
}));
pista.addEventListener("scroll", flechas, { passive: true });
addEventListener("resize", flechas);
flechas();

// ── Botón magnético (sólo con mouse) ──
if (punteroFino && !reducir) {
  document.querySelectorAll(".magnetic").forEach((el) => {
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.2}px, ${(e.clientY - r.top - r.height / 2) * 0.3}px)`;
    });
    el.addEventListener("pointerleave", () => { el.style.transform = ""; });
  });
}

// ── 3D: cada lienzo se monta cuando su sección está cerca ──
const lienzos = [...document.querySelectorAll("canvas[data-3d]")].filter((c) => !reducir || c.dataset["3d"] === "ojo");
if (lienzos.length) {
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
}
