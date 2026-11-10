// UNBLIND: la demo de audio 3D y la calle contada de cinco maneras.

const reducir = matchMedia("(prefers-reduced-motion: reduce)").matches;
// La misma página sirve en español y en inglés (public/en/): el idioma sale de <html lang>.
const EN = document.documentElement.lang === "en";
const t = (es, en) => (EN ? en : es);

// El audio 3D en vivo (motor de Asion): se pide cuando su sección se acerca, para que al tocar
// el botón el sonido arranque dentro del toque, como lo exige el navegador
let audio3D = null;
const pedirAudio3D = () => (audio3D ||= import("./unblind-audio.js").then((m) => (m.soportado() ? m : null)).catch(() => null));
const alAcercarse = (el, fn) => new IntersectionObserver(([e], obs) => { if (e.isIntersecting) { obs.disconnect(); fn(); } }, { rootMargin: "100% 0px" }).observe(el);

// ── Escucha dónde están las cosas: el cuarto suena en vivo y se gira la cabeza arrastrando la
// imagen (o con las flechas). Si el navegador no puede, queda la grabación de siempre. ──
(function demoAudio() {
  const figura = document.querySelector("[data-cuarto]");
  const boton = document.getElementById("botonAudio");
  if (!figura || !boton) return;
  const texto = boton.querySelector("span");
  const vista = figura.querySelector(".ub-demo-vista");
  const pista = figura.querySelector(".ub-demo-pista");
  const fuentes = Object.fromEntries([...figura.querySelectorAll("[data-fuente]")].map((f) => [f.dataset.fuente, f]));
  const GIRO = 70; // grados, a cada lado
  let escena = null, giro = 0, apagar = 0;
  const girar = (grados) => {
    giro = Math.max(-GIRO, Math.min(GIRO, grados));
    figura.style.setProperty("--giro", (giro / GIRO).toFixed(3));
    escena?.girar(giro);
  };
  const destello = (nombre) => {
    const f = fuentes[nombre];
    if (!f) return;
    f.classList.remove("suena");
    void f.offsetWidth; // para que la onda vuelva a empezar
    f.classList.add("suena");
  };
  const callar = () => escena?.detener();
  const alDetener = () => {
    escena = null;
    clearTimeout(apagar);
    figura.classList.remove("en-vivo");
    boton.setAttribute("aria-pressed", "false");
    texto.textContent = t("Escuchar la demo", "Play the demo");
    pista.hidden = true;
    vista.removeAttribute("tabindex");
    girar(0);
  };
  const empezar = (m) => {
    escena = m.cuarto({ alSonar: destello, alDetener });
    figura.classList.add("en-vivo");
    boton.setAttribute("aria-pressed", "true");
    texto.textContent = t("Detener la demo", "Stop the demo");
    pista.hidden = false;
    vista.tabIndex = 0;
    apagar = setTimeout(callar, 90000);
  };

  alAcercarse(figura, () => pedirAudio3D().then((m) => {
    if (!m) return grabacion();
    boton.addEventListener("click", () => (escena ? callar() : empezar(m)));
    // Arrastrar para girar, como una foto panorámica: llevar la imagen a la derecha es mirar a la izquierda
    let x0 = null, giro0 = 0;
    vista.addEventListener("dragstart", (e) => e.preventDefault());
    vista.addEventListener("pointerdown", (e) => { if (!escena) return; x0 = e.clientX; giro0 = giro; vista.setPointerCapture(e.pointerId); vista.classList.add("arrastrando"); });
    vista.addEventListener("pointermove", (e) => { if (x0 !== null) girar(giro0 - ((e.clientX - x0) / vista.clientWidth) * GIRO * 1.6); });
    const soltar = () => { x0 = null; vista.classList.remove("arrastrando"); };
    vista.addEventListener("pointerup", soltar);
    vista.addEventListener("pointercancel", soltar);
    vista.addEventListener("keydown", (e) => {
      const paso = { ArrowLeft: -15, ArrowRight: 15 }[e.key];
      if (paso && escena) { e.preventDefault(); girar(giro + paso); }
    });
    // Se calla sola si la sección sale de la pantalla o la pestaña se esconde
    new IntersectionObserver(([e]) => { if (!e.isIntersecting) callar(); }).observe(figura);
    document.addEventListener("visibilitychange", () => { if (document.hidden) callar(); });
  }));

  // La grabación de 15 segundos: un botón que reproduce y pausa, con su avance
  function grabacion() {
    const audio = document.getElementById("audioDemo");
    const avance = document.getElementById("avanceAudio");
    if (!audio) return;
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
  }
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
    // Mientras se explora, lo de fondo no se puede enfocar: el tabulador se queda en la capa
    [...document.body.children].forEach((el) => { if (el !== capa) el.inert = true; });
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
    [...document.body.children].forEach((el) => { el.inert = false; });
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

// ── Te lo dice: con audífonos, cada cosa que reconoció en la calle suena desde donde está en la
// foto, después de que el LiDAR avisa que algo se acerca de frente. También en la versión corrida. ──
(function teLoDice() {
  const seccion = document.querySelector("[data-despiece]");
  const boton = seccion?.querySelector("[data-oir]");
  if (!boton) return;
  const paso = boton.closest("[data-paso]");
  const texto = boton.querySelector("span");
  const cajas = [...seccion.querySelectorAll(".ub-ve .caja")];
  // La foto abarca unos 70 grados: el centro de cada recuadro da el ángulo; el perro, más bajo y más cerca
  const cosas = cajas.map((c) => {
    const v = (n) => parseFloat(c.style.getPropertyValue(n));
    const perro = c.dataset.cosa === "perro";
    return { tipo: c.dataset.cosa, angulo: (v("--x") + v("--w") / 2 - 0.5) * 70, distancia: perro ? 2.5 : 3.5, alto: perro ? -1 : 0 };
  });
  let calle = null;
  const alDetener = () => {
    calle = null;
    cajas.forEach((c) => c.classList.remove("suena"));
    boton.setAttribute("aria-pressed", "false");
    texto.textContent = t("Escuchar otra vez", "Listen again");
  };
  alAcercarse(seccion, () => pedirAudio3D().then((m) => {
    if (!m) return;
    boton.hidden = false;
    boton.addEventListener("click", () => {
      if (calle) return calle.detener();
      calle = m.calle({ cosas, alDetener, alSonar: (i) => cajas.forEach((c, j) => c.classList.toggle("suena", j === i)) });
      boton.setAttribute("aria-pressed", "true");
      texto.textContent = t("Detener", "Stop");
    });
    // Se calla si la animación deja el paso «Te lo dice» o la pestaña se esconde
    addEventListener("scroll", () => { if (calle && !seccion.classList.contains("corrida") && !paso.classList.contains("activa")) calle.detener(); }, { passive: true });
    document.addEventListener("visibilitychange", () => { if (document.hidden) calle?.detener(); });
  }));
})();
