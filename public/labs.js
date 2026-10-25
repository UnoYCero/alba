// Alba Labs: «Ve. Recuerda. Actúa.» como una pantalla fija que cambia al bajar.
// En teléfonos bajitos o con «menos movimiento» se vuelve contenido corrido y los pasos se tocan.

const reducir = matchMedia("(prefers-reduced-motion: reduce)").matches;
// La misma página sirve en español y en inglés (public/en/): el idioma sale de <html lang>
const t = (es, en) => (document.documentElement.lang === "en" ? en : es);
const tiene3D = (() => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; } })();
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
    scrollTo({ top: seccion.getBoundingClientRect().top + scrollY + recorrido * ((j + 0.5) / botones.length), behavior: "smooth" });
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

// ── La portada: los lentes en 3D; el clip de cámara llega y se acopla al abrir ──
// Se monta cuando la página ya cargó (primero se ve el render); con «menos movimiento», el render.
(function portada() {
  const figura = document.querySelector("[data-portada3d]");
  if (!figura || !tiene3D || reducir) return;
  const montar = () => import("./labs-3d.js").then((m) => {
    const lienzo = figura.querySelector(".lb-portada-lienzo");
    // El lienzo es más ancho que la figura (como el render): se mide a sí mismo
    const visor = m.montarModular({ contenedor: lienzo, lienzo, url: new URL("assets/labs/labs-modular.glb", import.meta.url).href, cerca: false });
    return visor.listo.then(() => {
      figura.classList.add("con-3d");
      setTimeout(() => visor.poner("camara"), 500);
    });
  }).catch((err) => console.warn("No se pudo montar la portada en 3D:", err));
  if (document.readyState === "complete") montar();
  else addEventListener("load", montar, { once: true });
})();

// ── Distintas formas de trabajar: el configurador de las cinco configuraciones ──
(function configurador() {
  const caja = document.querySelector("[data-configurador]");
  if (!caja) return;
  const escena = caja.querySelector(".lb-modular-escena");
  const respaldo = caja.querySelector(".lb-modular-respaldo");
  const botones = [...caja.querySelectorAll("[data-config]")];
  let visor = null, tocado = false, indice = 0, reloj = 0;
  const elegir = (i) => {
    indice = i;
    const id = botones[i].dataset.config;
    botones.forEach((b, j) => b.setAttribute("aria-pressed", String(j === i)));
    respaldo.src = new URL(`assets/labs/config-${id}.webp`, import.meta.url).href;
    visor?.poner(id);
  };
  botones.forEach((b, i) => b.addEventListener("click", () => { tocado = true; clearInterval(reloj); elegir(i); }));
  if (!tiene3D) return;
  new IntersectionObserver(([e], obs) => {
    if (!e.isIntersecting) return;
    obs.disconnect();
    import("./labs-3d.js").then((m) => {
      visor = m.montarConfigurador({ contenedor: escena, lienzo: caja.querySelector(".lb-modular-lienzo"), url: new URL("assets/labs/labs-configuraciones.glb", import.meta.url).href, reducir });
      return visor.listo.then(() => {
        escena.classList.add("con-3d");
        elegir(indice);
        // Mientras nadie toque, las configuraciones se turnan solas
        if (!reducir) reloj = setInterval(() => { if (!tocado && !document.hidden) elegir((indice + 1) % botones.length); }, 4800);
      });
    }).catch((err) => console.warn("No se pudo montar el configurador en 3D:", err));
  }, { rootMargin: "100% 0px" }).observe(caja);
})();

// ── Pregúntale al mundo: la conversación de ejemplo y por dónde viaja la pregunta ──
(function conversacion() {
  const caja = document.querySelector("[data-conversacion]");
  if (!caja) return;
  const camino = caja.querySelector("[data-camino]");
  const pregunta = caja.querySelector("[data-pregunta]"), respuesta = caja.querySelector("[data-respuesta]");
  const rutas = [...caja.querySelectorAll("[data-ruta]")], otras = [...caja.querySelectorAll("[data-p]")];
  const datos = Object.fromEntries([...caja.querySelectorAll("[data-dato]")].map((el) => [el.dataset.dato, el]));
  const RUTAS = {
    local: { privacidad: t("Lo que ven los lentes se queda en tu red", "What the glasses see stays on your network"), velocidad: t("Depende de tu computadora", "It depends on your computer"), costo: t("Sin pagar por cada pregunta", "No charge per question") },
    nube: { privacidad: t("Lo que ven viaja cifrado a un servicio externo", "What they see travels encrypted to an outside service"), velocidad: t("Rápida, aunque dependes de internet", "Fast, though you depend on the internet"), costo: t("Pagas según lo que uses", "You pay for what you use") },
  };
  const RESPUESTAS = [
    t("En el banco de trabajo, junto a la caja azul. La viste hace 12 minutos.", "On the workbench, next to the blue box. You saw it 12 minutes ago."),
    t("Es la garantía de la impresora: cubre un año y pide el comprobante de compra.", "It is the printer warranty: it covers one year and asks for the receipt."),
    t("Primero quita los dos tornillos de la tapa. Te aviso cuando veas el filtro.", "First remove the two screws on the cover. I will tell you when you see the filter."),
  ];
  let escritura = 0, tocado = false, actual = 0, reloj = 0;
  const escribir = (texto) => {
    clearInterval(escritura);
    if (reducir) { respuesta.textContent = texto; return; }
    let n = 0;
    respuesta.textContent = "";
    respuesta.classList.add("escribiendo");
    escritura = setInterval(() => {
      n += 2;
      respuesta.textContent = texto.slice(0, n);
      if (n >= texto.length) { clearInterval(escritura); respuesta.classList.remove("escribiendo"); }
    }, 28);
  };
  const preguntar = (i) => {
    actual = i;
    otras.forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.p === i)));
    pregunta.textContent = otras[i].textContent;
    escribir(RESPUESTAS[i]);
  };
  const ruta = (r) => {
    camino.dataset.camino = r;
    rutas.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.ruta === r)));
    Object.entries(RUTAS[r]).forEach(([k, v]) => { datos[k].textContent = v; });
    preguntar(actual);
  };
  rutas.forEach((b) => b.addEventListener("click", () => { tocado = true; ruta(b.dataset.ruta); }));
  otras.forEach((b) => b.addEventListener("click", () => { tocado = true; preguntar(+b.dataset.p); }));
  if (reducir) return;
  // Al aparecer, la primera respuesta se escribe; luego las preguntas se turnan solas
  new IntersectionObserver(([e], obs) => {
    if (!e.isIntersecting) return;
    obs.disconnect();
    preguntar(0);
    reloj = setInterval(() => { if (!tocado && !document.hidden) preguntar((actual + 1) % otras.length); }, 6500);
  }, { threshold: 0.5 }).observe(caja.querySelector(".lb-chat"));
})();

