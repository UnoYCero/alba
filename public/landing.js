// Portada de Alba Vision: navegación, apariciones al desplazarse, texto que se
// enciende, botones magnéticos, tarjetas que se inclinan y el 3D (que se carga
// sólo cuando su sección está por verse).

const reducir = matchMedia("(prefers-reduced-motion: reduce)").matches;
const punteroFino = matchMedia("(pointer: fine)").matches;
document.documentElement.classList.toggle("reduce", reducir);

// Año del pie
document.querySelectorAll("[data-year]").forEach((el) => { el.textContent = new Date().getFullYear(); });

// Navegación: fondo al bajar, se esconde al seguir bajando y vuelve al subir
const nav = document.querySelector("[data-nav]");
let ultimoY = scrollY;
addEventListener("scroll", () => {
  const y = scrollY;
  nav.classList.toggle("scrolled", y > 40);
  nav.classList.toggle("oculto", y > 400 && y > ultimoY && !nav.classList.contains("menu-abierto"));
  ultimoY = y;
}, { passive: true });

// Menú del celular
const boton = document.querySelector("[data-nav-toggle]");
const panel = document.querySelector("[data-nav-panel]");
const cerrarMenu = () => {
  boton.setAttribute("aria-expanded", "false");
  boton.setAttribute("aria-label", "Abrir menú");
  panel.classList.remove("abierto");
  nav.classList.remove("menu-abierto");
  document.body.style.overflow = "";
};
boton.addEventListener("click", () => {
  const abrir = boton.getAttribute("aria-expanded") !== "true";
  if (!abrir) return cerrarMenu();
  boton.setAttribute("aria-expanded", "true");
  boton.setAttribute("aria-label", "Cerrar menú");
  panel.classList.add("abierto");
  nav.classList.add("menu-abierto");
  document.body.style.overflow = "hidden";
});
panel.querySelectorAll("a").forEach((a) => a.addEventListener("click", cerrarMenu));
addEventListener("keydown", (e) => { if (e.key === "Escape") cerrarMenu(); });

// Titular de la portada
requestAnimationFrame(() => document.querySelector(".hero")?.classList.add("listo"));

// Apariciones al desplazarse (con un pequeño escalonado por grupo)
const grupos = new Map();
document.querySelectorAll(".reveal").forEach((el) => {
  const padre = el.parentElement;
  const n = grupos.get(padre) || 0;
  el.style.setProperty("--i", n);
  grupos.set(padre, n + 1);
});
const aparecer = new IntersectionObserver((entradas) => {
  entradas.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("in"); aparecer.unobserve(e.target); }
  });
}, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
document.querySelectorAll(".reveal, .ops-stage").forEach((el) => aparecer.observe(el));

// El texto del origen se enciende palabra por palabra al bajar
const scrub = document.querySelector("[data-scrub]");
if (scrub && !reducir) {
  const palabras = scrub.textContent.trim().split(/\s+/);
  scrub.innerHTML = palabras.map((p) => `<span class="w">${p}</span>`).join(" ");
  const ws = [...scrub.querySelectorAll(".w")];
  const encender = () => {
    const r = scrub.getBoundingClientRect();
    const avance = Math.min(1, Math.max(0, (innerHeight * 0.85 - r.top) / (r.height + innerHeight * 0.45)));
    const hasta = Math.round(avance * ws.length);
    ws.forEach((w, i) => w.classList.toggle("on", i < hasta));
  };
  addEventListener("scroll", encender, { passive: true });
  encender();
}

// La línea de «Cómo trabajamos» se llena al bajar
const pasos = document.querySelector("[data-steps]");
if (pasos) {
  const llenar = () => {
    const r = pasos.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (innerHeight * 0.8 - r.top) / (innerHeight * 0.6)));
    pasos.style.setProperty("--p", p.toFixed(3));
  };
  addEventListener("scroll", llenar, { passive: true });
  llenar();
}

// Botones magnéticos y tarjetas que se inclinan (sólo con mouse)
if (punteroFino && !reducir) {
  document.querySelectorAll(".magnetic").forEach((el) => {
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) * 0.22;
      const y = (e.clientY - r.top - r.height / 2) * 0.32;
      el.style.transform = `translate(${x}px, ${y}px)`;
    });
    el.addEventListener("pointerleave", () => { el.style.transform = ""; });
  });
  document.querySelectorAll(".tilt").forEach((el) => {
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      el.style.setProperty("--ry", `${(px - 0.5) * 8}deg`);
      el.style.setProperty("--rx", `${(0.5 - py) * 8}deg`);
      el.style.setProperty("--mx", `${px * 100}%`);
      el.style.setProperty("--my", `${py * 100}%`);
    });
    el.addEventListener("pointerleave", () => {
      el.style.setProperty("--rx", "0deg");
      el.style.setProperty("--ry", "0deg");
    });
  });
}

// 3D: cada lienzo se monta cuando su sección está cerca de verse
const lienzos = document.querySelectorAll("canvas[data-3d]");
if (lienzos.length) {
  let modulo;
  const montar = async (canvas) => {
    try {
      modulo ||= import("./landing-3d.js");
      const m = await modulo;
      m.montar(canvas, canvas.dataset["3d"], { reducir, punteroFino });
    } catch (err) {
      // Sin WebGL o sin red: la página se lee igual, sólo sin el 3D
      canvas.remove();
      console.warn("No se pudo cargar el 3D:", err);
    }
  };
  const cerca = new IntersectionObserver((entradas) => {
    entradas.forEach((e) => {
      if (e.isIntersecting) { cerca.unobserve(e.target); montar(e.target); }
    });
  }, { rootMargin: "300px 0px" });
  lienzos.forEach((c) => cerca.observe(c));
}
