// UNBLIND: la demo de audio 3D y la calle contada de cinco maneras.

const reducir = matchMedia("(prefers-reduced-motion: reduce)").matches;
// La misma página sirve en español y en inglés (public/en/): el idioma sale de <html lang>.
const EN = document.documentElement.lang === "en";
const t = (es, en) => (EN ? en : es);

// ── La demo de audio 3D: un botón que reproduce y pausa, con su avance ──
(function demoAudio() {
  const audio = document.getElementById("audioDemo");
  const boton = document.getElementById("botonAudio");
  const avance = document.getElementById("avanceAudio");
  if (!audio || !boton) return;
  const texto = boton.querySelector("span");
  const poner = (sonando) => {
    boton.setAttribute("aria-pressed", String(sonando));
    texto.textContent = sonando ? t("Pausar la demo", "Pause the demo") : (audio.currentTime > 0 && !audio.ended ? t("Seguir escuchando", "Keep listening") : t("Escuchar la demo", "Play the demo"));
  };
  boton.addEventListener("click", () => {
    if (audio.paused) audio.play().catch(() => { texto.textContent = t("No se pudo reproducir", "Could not play"); });
    else audio.pause();
  });
  audio.addEventListener("play", () => poner(true));
  audio.addEventListener("pause", () => poner(false));
  audio.addEventListener("ended", () => { audio.currentTime = 0; poner(false); });
  audio.addEventListener("timeupdate", () => {
    if (audio.duration) avance.style.transform = `scaleX(${audio.currentTime / audio.duration})`;
  });
})();

// ── Lo que hace: cada función enciende su capa sobre la misma foto ──
(function escenas() {
  const botones = [...document.querySelectorAll("[data-funcion]")];
  const capas = [...document.querySelectorAll(".ub-escena [data-capa]")];
  const escena = document.querySelector(".ub-escena");
  if (!botones.length || !capas.length) return;
  let actual = 0, tocado = false, visible = false;
  const mostrar = (i) => {
    actual = i;
    botones.forEach((b, j) => b.setAttribute("aria-current", j === i ? "true" : "false"));
    capas.forEach((c, j) => c.classList.toggle("activa", j === i));
  };
  botones.forEach((b, j) => b.addEventListener("click", () => { tocado = true; mostrar(j); }));
  mostrar(0);
  if (reducir) return;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.3 }).observe(escena);
  setInterval(() => {
    if (visible && !tocado && !document.hidden) mostrar((actual + 1) % botones.length);
  }, 4200);
})();

// ── Por dentro: los lentes en 3D guiados por el avance de la sección ──
// El modelo sólo se pide cuando la sección se acerca. Con «menos movimiento» o sin 3D, la
// sección se lee corrida con la imagen del despiece.
(function porDentro() {
  const seccion = document.querySelector("[data-despiece]");
  if (!seccion) return;
  const escena = seccion.querySelector(".ub-despiece-escena");
  const lienzo = seccion.querySelector(".ub-lienzo");
  const etapas = [...seccion.querySelectorAll("[data-etapa]")];
  const partes = [...seccion.querySelectorAll("[data-pieza]")];
  const pasos = [...seccion.querySelectorAll("[data-paso]")];
  const guia = seccion.querySelector(".ub-guia"), linea = guia.querySelector("line"), punto = guia.querySelector("circle");
  const rotulo = seccion.querySelector(".ub-rotulo");
  const ve = seccion.querySelector(".ub-ve"), dicho = seccion.querySelector(".ub-dicho");
  const soporta3D = (() => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; } })();
  if (reducir || !soporta3D) { seccion.classList.add("corrida"); return; }

  const nombres = Object.fromEntries(partes.map((li) => [li.dataset.pieza, li.querySelector("b").textContent]));
  // El avance cuenta sólo el tramo en que la escena está fija (sin los márgenes del fundido)
  const avance = () => {
    const r = seccion.getBoundingClientRect();
    const estilo = getComputedStyle(seccion);
    const arriba = parseFloat(estilo.paddingTop), abajo = parseFloat(estilo.paddingBottom);
    return Math.min(1, Math.max(0, (-r.top - arriba) / (r.height - arriba - abajo - innerHeight)));
  };
  let etapaActual = "";
  const alAvance = ({ p, foco, enFoco, pulso, ancla }) => {
    const etapa = p < 0.215 ? "armado" : p < 0.605 ? "piezas" : "pulso";
    if (etapa !== etapaActual) { etapaActual = etapa; etapas.forEach((e) => e.classList.toggle("activa", e.dataset.etapa === etapa)); }
    partes.forEach((li) => li.classList.toggle("activa", li.dataset.pieza === foco));
    const paso = pulso.dice > 0 ? "dice" : pulso.entiende > 0 ? "entiende" : etapa === "pulso" ? "ve" : null;
    pasos.forEach((li) => li.classList.toggle("activa", li.dataset.paso === paso));
    ve.classList.toggle("visible", pulso.ve > 0.12 && p < 0.995);
    ve.classList.toggle("cajas", pulso.entiende > 0.25);
    dicho.classList.toggle("visible", pulso.dice > 0.55 && p < 0.995);
    // El nombre de la pieza, a un lado de ella, con una línea fina hasta su centro
    if (ancla && foco && ancla.opacidad > 0.05) {
      const ancho = escena.clientWidth;
      rotulo.textContent = nombres[foco];
      const w = rotulo.offsetWidth, h = rotulo.offsetHeight;
      const derecha = ancla.x < ancho * 0.55;
      const lx = Math.min(ancho - w, Math.max(0, derecha ? ancla.x + 46 : ancla.x - 46 - w));
      const ly = Math.max(0, ancla.y - 54 - h / 2);
      rotulo.style.transform = `translate(${lx}px, ${ly}px)`;
      rotulo.style.opacity = ancla.opacidad;
      linea.setAttribute("x1", derecha ? lx : lx + w); linea.setAttribute("y1", ly + h / 2);
      linea.setAttribute("x2", ancla.x); linea.setAttribute("y2", ancla.y);
      punto.setAttribute("cx", ancla.x); punto.setAttribute("cy", ancla.y);
      guia.style.opacity = ancla.opacidad;
    } else {
      rotulo.style.opacity = 0;
      guia.style.opacity = 0;
    }
  };

  let visor = null;
  const iniciar = () => import("./unblind-3d.js")
    .then((m) => {
      visor = m.montarDespiece({ escena, lienzo, urlModelo: new URL("assets/unblind/lentes.glb", import.meta.url).href, alAvance });
      visor.avanzar(avance());
      return visor.listo;
    })
    .then(() => escena.classList.add("con-3d"))
    .catch((err) => { console.warn("No se pudo cargar el modelo 3D de UNBLIND:", err); seccion.classList.add("corrida"); });
  new IntersectionObserver(([e], obs) => { if (e.isIntersecting) { obs.disconnect(); iniciar(); } }, { rootMargin: "120% 0px" }).observe(seccion);
  addEventListener("scroll", () => visor?.avanzar(avance()), { passive: true });
  addEventListener("resize", () => visor?.avanzar(avance()));
})();

// ── «Escúchalo» al final del pulso: la misma demo de audio 3D de arriba ──
(function oirAlFinal() {
  const audio = document.getElementById("audioDemo");
  const boton = document.querySelector("[data-oir]");
  if (!audio || !boton) return;
  const texto = boton.querySelector("span");
  const poner = () => {
    const sonando = !audio.paused && !audio.ended;
    boton.setAttribute("aria-pressed", String(sonando));
    texto.textContent = sonando ? t("Pausar", "Pause") : t("Escúchalo", "Listen");
  };
  boton.addEventListener("click", () => { if (audio.paused) audio.play().catch(() => {}); else audio.pause(); });
  ["play", "pause", "ended"].forEach((ev) => audio.addEventListener(ev, poner));
})();
