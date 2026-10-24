// Alba Labs: «Ve. Recuerda. Actúa.» como una pantalla fija que cambia al bajar.
// En teléfonos bajitos o con «menos movimiento» se vuelve contenido corrido y los pasos se tocan.

const reducir = matchMedia("(prefers-reduced-motion: reduce)").matches;
const celular = matchMedia("(max-width: 760px)");
const seccion = document.querySelector("[data-tiempos]");

if (seccion) {
  const botones = [...seccion.querySelectorAll("[data-tiempo]")];
  const capas = [...seccion.querySelectorAll("[data-capa]")];
  const corrida = () => reducir || (celular.matches && innerHeight < 700);
  let actual = -1;

  const mostrar = (i) => {
    if (i === actual) return;
    actual = i;
    botones.forEach((b, j) => b.setAttribute("aria-current", j === i ? "true" : "false"));
    capas.forEach((c, j) => c.classList.toggle("activa", j === i));
  };

  const alBajar = () => {
    seccion.classList.toggle("corrida", corrida());
    if (corrida()) return;
    const r = seccion.getBoundingClientRect();
    const avance = Math.min(1, Math.max(0, -r.top / (r.height - innerHeight)));
    mostrar(Math.min(botones.length - 1, Math.floor(avance * botones.length)));
  };

  botones.forEach((b, j) => b.addEventListener("click", () => {
    if (corrida()) { mostrar(j); return; }
    const recorrido = seccion.offsetHeight - innerHeight;
    scrollTo({ top: seccion.offsetTop + recorrido * ((j + 0.5) / botones.length), behavior: "smooth" });
  }));

  let pendiente = false;
  addEventListener("scroll", () => {
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(() => { pendiente = false; alBajar(); });
  }, { passive: true });
  addEventListener("resize", alBajar);
  mostrar(0);
  alBajar();
}

// ── Una base, muchos módulos: el concepto en 3D; al elegir un clip, entra y se acopla ──
(function modular() {
  const caja = document.querySelector("[data-modular]");
  if (!caja) return;
  const escena = caja.querySelector(".lb-modular-escena");
  const lienzo = caja.querySelector(".lb-modular-lienzo");
  const botones = [...caja.querySelectorAll("[data-clip]")];
  const tiene3D = (() => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; } })();
  let visor = null, tocado = false, indice = 0, reloj = 0;
  const elegir = (i) => {
    indice = i;
    botones.forEach((b, j) => b.setAttribute("aria-pressed", String(j === i)));
    visor?.poner(botones[i].dataset.clip);
  };
  botones.forEach((b, i) => b.addEventListener("click", () => { tocado = true; clearInterval(reloj); elegir(i); }));
  if (!tiene3D) return;
  new IntersectionObserver(([e], obs) => {
    if (!e.isIntersecting) return;
    obs.disconnect();
    import("./labs-3d.js").then((m) => {
      visor = m.montarModular({ contenedor: escena, lienzo, url: new URL("assets/labs/labs-modular.glb", import.meta.url).href, reducir });
      return visor.listo.then(() => {
        escena.classList.add("con-3d");
        elegir(indice);
        // Mientras nadie toque, los clips se turnan solos
        if (!reducir) reloj = setInterval(() => { if (!tocado && !document.hidden) elegir((indice + 1) % botones.length); }, 3600);
      });
    }).catch((err) => console.warn("No se pudo montar el concepto modular en 3D:", err));
  }, { rootMargin: "100% 0px" }).observe(caja);
})();
