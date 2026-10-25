// Subpáginas de Alba (UNBLIND, Alba Space y Alba Labs): menú flotante, menú del
// celular, apariciones y, en Alba Space, el mismo cielo 3D de la portada.

const reducir = matchMedia("(prefers-reduced-motion: reduce)").matches;
const punteroFino = matchMedia("(pointer: fine)").matches;
const anchoMenu = matchMedia("(max-width: 1080px)");
document.documentElement.classList.toggle("reduce", reducir);
// La misma página sirve en español y en inglés (public/en/): el idioma sale de <html lang>.
const EN = document.documentElement.lang === "en";
const t = (es, en) => (EN ? en : es);
document.querySelectorAll("[data-year]").forEach((el) => { el.textContent = new Date().getFullYear(); });

// ── Menú: se compacta al bajar ──
const nav = document.querySelector("[data-nav]");
const alBajar = () => nav.classList.toggle("scrolled", scrollY > 40);
addEventListener("scroll", alBajar, { passive: true });
alBajar();

// ── Menú del celular: se cierra con Escape, al elegir y al cambiar de ancho ──
const boton = document.querySelector("[data-nav-toggle]");
const panelMenu = document.querySelector("[data-nav-panel]");
const menuAbierto = () => boton.getAttribute("aria-expanded") === "true";
function cerrarMenu({ devolverFoco = false } = {}) {
  boton.setAttribute("aria-expanded", "false");
  boton.setAttribute("aria-label", t("Abrir menú", "Open menu"));
  panelMenu.classList.remove("abierto");
  nav.classList.remove("abierto");
  document.body.style.overflow = "";
  if (devolverFoco && anchoMenu.matches) boton.focus();
}
boton.addEventListener("click", () => {
  if (menuAbierto()) return cerrarMenu();
  boton.setAttribute("aria-expanded", "true");
  boton.setAttribute("aria-label", t("Cerrar menú", "Close menu"));
  panelMenu.classList.add("abierto");
  nav.classList.add("abierto");
  document.body.style.overflow = "hidden";
});
panelMenu.querySelectorAll("a, button").forEach((el) => el.addEventListener("click", () => cerrarMenu()));
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

// ── El cielo 3D (sólo en Alba Space). Si no carga, queda el fondo de noche ──
const lienzo = document.querySelector("canvas[data-3d]");
if (lienzo) {
  import("./landing-3d.js")
    .then((m) => m.montar(lienzo, lienzo.dataset["3d"], { reducir, punteroFino }))
    .catch((err) => { lienzo.remove(); console.warn("No se pudo cargar el cielo 3D:", err); });
}

// ── Lo secundario, plegado: se ve el título y una frase; quien quiera lo abre ──
// En «plegable-escena» la cabeza se va al abrir y aparece la escena completa con su propio título.
document.querySelectorAll("[data-plegable]").forEach((caja) => {
  const boton = caja.querySelector(".plegable-boton");
  const cuerpo = caja.querySelector(".plegable-cuerpo");
  if (!boton || !cuerpo) return;
  boton.addEventListener("click", () => {
    const abrir = cuerpo.hidden;
    cuerpo.hidden = !abrir;
    boton.setAttribute("aria-expanded", String(abrir));
    if (abrir && caja.classList.contains("plegable-escena")) {
      caja.querySelector(".plegable-cabeza").hidden = true;
      cuerpo.scrollIntoView({ behavior: reducir ? "auto" : "smooth" });
    }
    // Las escenas que dependen del scroll vuelven a medirse
    dispatchEvent(new Event("scroll"));
    dispatchEvent(new Event("resize"));
  });
});

// ── Escenas que se quedan fijas al bajar: un botón para pasar a lo siguiente ──
const navAlto = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nav-h")) || 72;
document.querySelectorAll(".vo-operacion, .vo-reporte, .vo-crece, .st-galeria, .st-dentro, .st-baffle, .lb-tiempos").forEach((seccion) => {
  const pin = seccion.querySelector(".vo-pin, .st-galeria-pin, .st-pin, .st-baffle-pin, .lb-tiempos-pin");
  if (!pin) return;
  const saltar = document.createElement("button");
  saltar.type = "button";
  saltar.className = "saltar-escena";
  saltar.textContent = t("Saltar", "Skip");
  saltar.setAttribute("aria-label", t("Saltar esta parte y seguir", "Skip this part and continue"));
  saltar.addEventListener("click", () => {
    const fin = seccion.getBoundingClientRect().bottom + scrollY - navAlto() + 1;
    scrollTo({ top: fin, behavior: reducir ? "auto" : "smooth" });
  });
  pin.append(saltar);
});

