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
  const pasosTaller = [...seccion.querySelectorAll(".ub-taller li")];
  const guia = seccion.querySelector(".ub-guia");
  const lineas = [...guia.querySelectorAll("line")], puntos = [...guia.querySelectorAll("circle")];
  const rotulo = seccion.querySelector(".ub-rotulo");
  const ve = seccion.querySelector(".ub-ve"), dicho = seccion.querySelector(".ub-dicho");
  const abrirExplorar = seccion.querySelector("[data-explorar-abrir]");
  const capa = document.querySelector("[data-explorar]");
  const soporta3D = (() => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; } })();
  if (reducir || !soporta3D) { seccion.classList.add("corrida"); return; }

  // Lo que dice cada pieza (nombre, qué hace, medida), tomado del texto de la lista
  const info = Object.fromEntries(partes.map((li) => [li.dataset.pieza, {
    nombre: li.querySelector("b").textContent, texto: li.querySelector("span").textContent, medida: li.querySelector("small")?.textContent || "",
  }]));
  // El avance cuenta sólo el tramo en que la escena está fija (sin los márgenes del fundido)
  const avance = () => {
    const r = seccion.getBoundingClientRect();
    const estilo = getComputedStyle(seccion);
    const arriba = parseFloat(estilo.paddingTop), abajo = parseFloat(estilo.paddingBottom);
    return Math.min(1, Math.max(0, (-r.top - arriba) / (r.height - arriba - abajo - innerHeight)));
  };
  let etapaActual = "";
  const alAvance = ({ p, foco, enFoco, pulso, anclas }) => {
    const etapa = p < 0.285 ? "armado" : p < 0.705 ? "piezas" : "pulso";
    if (etapa !== etapaActual) { etapaActual = etapa; etapas.forEach((e) => e.classList.toggle("activa", e.dataset.etapa === etapa)); }
    partes.forEach((li) => li.classList.toggle("activa", li.dataset.pieza === foco));
    // Mientras se abren, el texto dice qué está pasando (los mismos tiempos que unblind-3d.js)
    const taller = [0.075, 0.1, 0.135, 0.16, 0.185, 0.24].filter((x) => p >= x).length - 1;
    pasosTaller.forEach((li, i) => li.classList.toggle("activa", i === taller));
    seccion.classList.toggle("abriendo", taller >= 0 && etapa === "armado");
    const paso = pulso.dice > 0 ? "dice" : pulso.entiende > 0 ? "entiende" : etapa === "pulso" ? "ve" : null;
    pasos.forEach((li) => li.classList.toggle("activa", li.dataset.paso === paso));
    ve.classList.toggle("visible", pulso.ve > 0.12 && p < 0.995);
    ve.classList.toggle("cajas", pulso.entiende > 0.25);
    dicho.classList.toggle("visible", pulso.dice > 0.55 && p < 0.995);
    // La ficha de la pieza (nombre y medida), a un lado, con una línea fina hasta cada pieza
    if (anclas && foco && enFoco > 0.05) {
      const ancho = escena.clientWidth, alto = escena.clientHeight;
      rotulo.querySelector("b").textContent = info[foco].nombre;
      rotulo.querySelector("small").textContent = info[foco].medida;
      const w = rotulo.offsetWidth, h = rotulo.offsetHeight;
      // La ficha va arriba a la derecha de la pieza (en celular, arriba, centrada)
      const a = anclas[0];
      const lx = Math.min(ancho - w - 4, Math.max(4, celular() ? (ancho - w) / 2 : a.x + Math.min(160, ancho * 0.16)));
      const ly = Math.max(4, Math.min(alto - h - 4, a.y - Math.min(170, alto * 0.24) - h));
      rotulo.style.transform = `translate(${lx}px, ${ly}px)`;
      rotulo.style.opacity = enFoco;
      lineas.forEach((ln, i) => {
        const an = anclas[i];
        // Sólo si la pieza está dentro de la escena (en el súper zoom, la pareja suele quedar fuera)
        const ver = !!an && an.x > 0 && an.x < ancho && an.y > 0 && an.y < alto;
        ln.style.display = puntos[i].style.display = ver ? "" : "none";
        if (!ver) return;
        ln.setAttribute("x1", Math.min(Math.max(an.x, lx), lx + w)); ln.setAttribute("y1", ly + h);
        ln.setAttribute("x2", an.x); ln.setAttribute("y2", an.y);
        puntos[i].setAttribute("cx", an.x); puntos[i].setAttribute("cy", an.y);
      });
      guia.style.opacity = enFoco;
    } else {
      rotulo.style.opacity = 0;
      guia.style.opacity = 0;
    }
  };
  const celular = () => matchMedia("(max-width: 760px)").matches;

  let visor = null;
  const iniciar = () => import("./unblind-3d.js")
    .then((m) => {
      visor = m.montarDespiece({ escena, lienzo, urlModelo: new URL("assets/unblind/lentes.glb", import.meta.url).href, alAvance });
      visor.avanzar(avance());
      return visor.listo;
    })
    .then(() => { escena.classList.add("con-3d"); if (abrirExplorar && capa) abrirExplorar.hidden = false; })
    .catch((err) => { console.warn("No se pudo cargar el modelo 3D de UNBLIND:", err); seccion.classList.add("corrida"); });
  new IntersectionObserver(([e], obs) => { if (e.isIntersecting) { obs.disconnect(); iniciar(); } }, { rootMargin: "120% 0px" }).observe(seccion);
  addEventListener("scroll", () => visor?.avanzar(avance()), { passive: true });
  addEventListener("resize", () => visor?.avanzar(avance()));

  // ── Explorar en 3D: el mismo lienzo pasa a una capa a pantalla completa ──
  if (!abrirExplorar || !capa) return;
  // La capa va en el body: dentro del contenido quedaría debajo del menú flotante
  document.body.append(capa);
  const lugar = capa.querySelector("[data-explorar-escena]");
  const separar = capa.querySelector("[data-separar]");
  const cerrar = capa.querySelector("[data-cerrar-explorar]");
  const ficha = capa.querySelector(".ub-explorar-ficha");
  const mostrarFicha = (pieza) => {
    if (!pieza) { ficha.classList.remove("visible"); return; }
    const d = info[pieza];
    ficha.innerHTML = `<b>${d.nombre}</b><span>${d.texto}</span><small>${d.medida}</small>`;
    ficha.classList.add("visible");
  };
  const abrir = () => {
    capa.hidden = false;
    document.documentElement.classList.add("explorando");
    lugar.append(lienzo);
    visor.explorar.abrir(mostrarFicha);
    separar.setAttribute("aria-pressed", "false"); separar.textContent = t("Separar piezas", "Take it apart");
    mostrarFicha(null);
    cerrar.focus();
  };
  const salir = () => {
    visor.explorar.cerrar();
    escena.insertBefore(lienzo, guia);
    capa.hidden = true;
    document.documentElement.classList.remove("explorando");
    visor.avanzar(avance());
    abrirExplorar.focus();
  };
  abrirExplorar.addEventListener("click", abrir);
  cerrar.addEventListener("click", salir);
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !capa.hidden) salir(); });
  separar.addEventListener("click", () => {
    const si = separar.getAttribute("aria-pressed") !== "true";
    separar.setAttribute("aria-pressed", String(si));
    separar.textContent = si ? t("Armar de nuevo", "Put it back together") : t("Separar piezas", "Take it apart");
    visor.explorar.separar(si);
  });
})();
