// Portada de Alba Vision: menú flotante, origen y Alba Vision en pantallas fijas
// que cambian al bajar, collage de hitos, y el 3D cargado sólo cuando se va a ver.

const reducir = matchMedia("(prefers-reduced-motion: reduce)").matches;
const punteroFino = matchMedia("(pointer: fine)").matches;
const celular = matchMedia("(max-width: 760px)");
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
const panelMenu = document.querySelector("[data-nav-panel]");
const cerrarMenu = () => {
  boton.setAttribute("aria-expanded", "false");
  boton.setAttribute("aria-label", "Abrir menú");
  panelMenu.classList.remove("abierto");
  document.body.style.overflow = "";
};
boton.addEventListener("click", () => {
  if (boton.getAttribute("aria-expanded") === "true") return cerrarMenu();
  boton.setAttribute("aria-expanded", "true");
  boton.setAttribute("aria-label", "Cerrar menú");
  panelMenu.classList.add("abierto");
  document.body.style.overflow = "hidden";
});
panelMenu.querySelectorAll("a").forEach((a) => a.addEventListener("click", cerrarMenu));
addEventListener("keydown", (e) => { if (e.key === "Escape") cerrarMenu(); });

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

// ── Origen: el texto se enciende y luego aparecen misión y visión ──
const origen = document.querySelector(".origen");
const scrub = origen.querySelector("[data-scrub]");
let palabras = [];
if (!reducir) {
  scrub.innerHTML = scrub.textContent.trim().split(/\s+/).map((p) => `<span class="w">${p}</span>`).join(" ");
  palabras = [...scrub.querySelectorAll(".w")];
}
function encender() {
  if (!palabras.length) return;
  const p = avanceFijo(origen);
  const hasta = Math.round(limitar(p / 0.65) * palabras.length);
  palabras.forEach((w, i) => w.classList.toggle("on", i < hasta));
  origen.classList.toggle("fin", p > 0.68);
}

// ── Alba Vision: la ventana cambia de proyecto al bajar ──
const ventana = document.querySelector("[data-window]");
const menu = ventana.querySelector(".window-menu");
const botones = [...ventana.querySelectorAll("[data-item]")];
const paneles = [...ventana.querySelectorAll("[data-panel]")];
const marcadorVentana = ventana.querySelector(".window-marker");
const lienzoLentes = ventana.querySelector('canvas[data-3d="lentes"]');
let activoVentana = -1;
function colocarMarcador() {
  const b = botones[Math.max(0, activoVentana)];
  if (celular.matches) {
    marcadorVentana.style.setProperty("--mx", `${b.offsetLeft}px`);
    marcadorVentana.style.setProperty("--mw", (b.offsetWidth / 100).toFixed(3));
  } else {
    marcadorVentana.style.setProperty("--my", `${b.offsetTop}px`);
    marcadorVentana.style.setProperty("--mh", (b.offsetHeight / 100).toFixed(3));
  }
}
function ventanaAlBajar() {
  if (reducir) return;
  const i = Math.min(paneles.length - 1, Math.floor(avanceFijo(ventana) * paneles.length));
  if (i === activoVentana) return;
  activoVentana = i;
  paneles.forEach((p, j) => p.classList.toggle("activo", j === i));
  botones.forEach((b, j) => b.setAttribute("aria-current", j === i ? "true" : "false"));
  colocarMarcador();
  if (celular.matches) {
    const b = botones[i];
    menu.scrollTo({ left: b.offsetLeft - menu.clientWidth / 2 + b.offsetWidth / 2, behavior: "smooth" });
  }
  if (lienzoLentes) lienzoLentes.pausado = i !== 0;
}
botones.forEach((b, j) => b.addEventListener("click", () => {
  const recorrido = ventana.offsetHeight - innerHeight;
  scrollTo({ top: ventana.offsetTop + recorrido * ((j + 0.5) / paneles.length), behavior: reducir ? "auto" : "smooth" });
}));
if (reducir) paneles.forEach((p) => p.classList.add("activo"));
celular.addEventListener("change", colocarMarcador);

// Un solo manejador de desplazamiento, una vez por cuadro
let pendiente = false;
function alDesplazar() {
  if (pendiente) return;
  pendiente = true;
  requestAnimationFrame(() => { pendiente = false; espiar(); encender(); ventanaAlBajar(); });
}
addEventListener("scroll", alDesplazar, { passive: true });
addEventListener("resize", () => { colocarMarcador(); alDesplazar(); });
espiar(); encender(); ventanaAlBajar();

// ── Collage de hitos: se duplica para desfilar sin fin ──
const fila = document.querySelector("[data-marquee]");
if (fila && !reducir) {
  [...fila.children].forEach((li) => {
    const copia = li.cloneNode(true);
    copia.setAttribute("aria-hidden", "true");
    fila.appendChild(copia);
  });
}

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
const lienzos = [...document.querySelectorAll("canvas[data-3d]")].filter((c) => !reducir || c.dataset["3d"] !== "lentes");
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
