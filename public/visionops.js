// Vision Ops: el texto, los rótulos, el hallazgo y el tablero de la escena aérea (visionops-3d.js).

const reducir = matchMedia("(prefers-reduced-motion: reduce)").matches;
// La misma página sirve en español y en inglés (public/en/): el idioma sale de <html lang>.
const EN = document.documentElement.lang === "en";
const t = (es, en) => (EN ? en : es);

// Lo que dice cada escena: sus zonas, la zona del hallazgo (foco), el hallazgo y el tablero.
// Son datos de ejemplo: en la página van marcados así.
const DATOS = {
  restaurante: {
    foco: "fila",
    zonas: { fila: [t("Fila", "Queue"), t("espera típica 0:16", "typical wait 0:16")], plancha: [t("Plancha", "Grill"), t("7:40 por pedido", "7:40 per order")], entrega: [t("Entrega", "Pickup"), t("3:10 hasta la mesa", "3:10 to the table")], mesas: [t("Mesas", "Tables"), t("38 min de estancia", "38 min stay")] },
    hallazgo: t("A las 2:10 pm la fila llegó a 6 personas y una se fue sin ordenar.", "At 2:10 pm the queue reached 6 people and one left without ordering."),
    tablero: [[t("Visitantes", "Visitors"), "128"], [t("Espera típica", "Typical wait"), "0:16"], [t("Abandonos", "Walk-outs"), "1"]],
  },
  almacen: {
    foco: "recepcion",
    zonas: { muelle: [t("Muelle", "Dock"), t("38 min por camión", "38 min per truck")], recepcion: [t("Recepción", "Receiving"), t("12 tarimas en espera", "12 pallets waiting")], empaque: [t("Empaque", "Packing"), t("64 pedidos", "64 orders")], almacenamiento: [t("Almacenamiento", "Storage"), t("ocupación del 78 %", "78% occupied")] },
    hallazgo: t("Entre 10 y 11 am la recepción se saturó 22 minutos: llegaban más tarimas de las que se alcanzaban a acomodar.", "Between 10 and 11 am receiving was saturated for 22 minutes: pallets arrived faster than they could be stored."),
    tablero: [[t("Movimientos de carga", "Load moves"), "46"], [t("Tiempo en muelle", "Dock time"), "38 min"], [t("Recepción saturada", "Receiving saturated"), "22 min"]],
  },
  linea: {
    foco: "estacion-3",
    zonas: { "estacion-1": [t("Estación 1", "Station 1"), t("ciclo de 18 s", "18 s cycle")], "estacion-3": [t("Estación 3", "Station 3"), t("ciclo de 26 s", "26 s cycle")], inspeccion: [t("Inspección", "Inspection"), t("212 piezas por hora", "212 parts per hour")], "producto-terminado": [t("Terminado", "Finished"), t("1,480 piezas", "1,480 parts")] },
    hallazgo: t("La estación 3 tarda 40 % más que las demás: ahí se acumula la línea.", "Station 3 takes 40% longer than the rest: that is where the line backs up."),
    tablero: [[t("Piezas por hora", "Parts per hour"), "212"], [t("Tiempo de ciclo", "Cycle time"), "18 s"], [t("Cuello de botella", "Bottleneck"), t("Estación 3", "Station 3")]],
  },
};

(function operacion() {
  const seccion = document.querySelector("[data-operacion]");
  if (!seccion) return;
  const escena = seccion.querySelector(".vo-escena");
  const lienzo = seccion.querySelector(".vo-lienzo");
  const etapas = [...seccion.querySelectorAll("[data-etapa]")];
  const capaRotulos = seccion.querySelector(".vo-rotulos");
  const hallazgo = seccion.querySelector(".vo-hallazgo");
  const tablero = seccion.querySelector(".vo-tablero");
  const botones = [...seccion.querySelectorAll("[data-escena]")];
  const respaldo = seccion.querySelector(".vo-respaldo");
  const soporta3D = (() => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; } })();
  if (reducir || !soporta3D) { seccion.classList.add("corrida"); return; }

  let actual = "restaurante", rotulos = {};
  // Los rótulos de las zonas y el tablero, de la escena que se ve
  const poner = (nombre) => {
    actual = nombre;
    const d = DATOS[nombre];
    capaRotulos.replaceChildren();
    rotulos = Object.fromEntries(Object.entries(d.zonas).map(([clave, [titulo, dato]]) => {
      const el = document.createElement("span");
      el.className = "vo-rotulo";
      el.innerHTML = `<b></b><small></small>`;
      el.querySelector("b").textContent = titulo;
      el.querySelector("small").textContent = dato;
      capaRotulos.append(el);
      return [clave, el];
    }));
    hallazgo.textContent = d.hallazgo;
    tablero.replaceChildren(...d.tablero.map(([dt, dd]) => {
      const div = document.createElement("div");
      div.innerHTML = "<dt></dt><dd></dd>";
      div.querySelector("dt").textContent = dt;
      div.querySelector("dd").textContent = dd;
      return div;
    }));
    botones.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.escena === nombre)));
    respaldo.src = new URL(`assets/visionops/${nombre}-aerea.webp`, import.meta.url).href;
  };
  poner(actual);

  // El avance cuenta el tramo en que la escena está fija
  const avance = () => {
    const r = seccion.getBoundingClientRect();
    return Math.min(1, Math.max(0, -r.top / (r.height - innerHeight)));
  };
  let etapaActual = "";
  const alAvance = ({ etapa, anclas, zonas, hallazgo: h, escena: nombre }) => {
    if (nombre !== actual) return;
    if (etapa !== etapaActual) {
      etapaActual = etapa;
      etapas.forEach((e) => e.classList.toggle("activa", e.dataset.etapa === etapa));
    }
    // Los rótulos siguen a su zona; el de la zona del hallazgo se queda más tiempo
    const ancho = escena.clientWidth, alto = escena.clientHeight;
    for (const [clave, el] of Object.entries(rotulos)) {
      const a = anclas[clave];
      if (!a) continue;
      const x = Math.min(ancho - el.offsetWidth - 4, Math.max(4, a.x - el.offsetWidth / 2));
      const y = Math.min(alto - el.offsetHeight - 60, Math.max(4, a.y - el.offsetHeight - 10));
      el.style.transform = `translate(${x}px, ${y}px)`;
      el.style.opacity = zonas * (etapa === "patrones" || etapa === "hallazgo" || etapa === "tablero" ? 0.85 : 1);
    }
    // El hallazgo, junto a su zona
    const a = anclas[DATOS[actual].foco];
    if (a) {
      const w = hallazgo.offsetWidth, hh = hallazgo.offsetHeight;
      const x = Math.min(ancho - w - 4, Math.max(4, a.x - w / 2));
      const y = Math.min(alto - hh - 60, Math.max(4, a.y + 24));
      hallazgo.style.left = `${x}px`; hallazgo.style.top = `${y}px`;
    }
    hallazgo.classList.toggle("visible", h > 0.4 && etapa !== "tablero");
    tablero.classList.toggle("visible", etapa === "tablero");
  };

  let visor = null;
  const iniciar = () => import("./visionops-3d.js")
    .then((m) => {
      visor = m.montarOperacion({ escena, lienzo, alAvance, base: new URL("assets/visionops/", import.meta.url).href });
      visor.avanzar(avance());
      visor.listo.then(() => escena.classList.add("con-3d"));
      botones.forEach((b) => {
        // Al acercar el dedo o el mouse ya se pide el modelo; mientras llega se ve su ilustración
        const precargar = () => visor.precargar(b.dataset.escena);
        ["pointerenter", "focus", "touchstart"].forEach((ev) => b.addEventListener(ev, precargar, { passive: true }));
        b.addEventListener("click", () => {
          poner(b.dataset.escena);
          escena.classList.remove("con-3d");
          visor.cambiar(b.dataset.escena).then(() => escena.classList.add("con-3d"));
        });
      });
    })
    .catch((err) => { console.warn("No se pudo montar la escena de Vision Ops:", err); seccion.classList.add("corrida"); });
  iniciar();
  addEventListener("scroll", () => visor?.avanzar(avance()), { passive: true });
})();

// De la primera cámara a toda la operación: el paso activo y los rótulos de la escena
(function camino() {
  const seccion = document.querySelector("[data-camino]");
  if (!seccion) return;
  const escena = seccion.querySelector(".vo-escena");
  const lienzo = seccion.querySelector(".vo-lienzo");
  const capa = seccion.querySelector(".vo-rotulos");
  const pasos = [...seccion.querySelectorAll("[data-paso]")];
  const soporta3D = (() => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; } })();
  if (reducir || !soporta3D) { seccion.classList.add("corrida"); return; }

  // Un rótulo por paso, pegado a lo que señala en la escena (son datos de ejemplo)
  const ROTULOS = {
    diagnostico: ["camara", t("3 cámaras", "3 cameras"), t("las que ya tenías", "the ones you already had")],
    piloto: ["fila", t("Fila", "Queue"), t("espera típica 0:16", "typical wait 0:16")],
    integracion: ["conector", t("Conector", "Connector"), t("lee el video en tu red", "reads the video on your network")],
    escalamiento: ["centro", t("6 sucursales · 18 cámaras", "6 locations · 18 cameras"), t("un solo reporte", "one report")],
  };
  const rotulos = Object.fromEntries(Object.entries(ROTULOS).map(([paso, [ancla, titulo, dato]]) => {
    const el = document.createElement("span");
    el.className = "vo-rotulo";
    el.innerHTML = "<b></b><small></small>";
    el.querySelector("b").textContent = titulo;
    el.querySelector("small").textContent = dato;
    capa.append(el);
    return [paso, { el, ancla }];
  }));

  const avance = () => {
    const r = seccion.getBoundingClientRect();
    return Math.min(1, Math.max(0, -r.top / (r.height - innerHeight)));
  };
  let pasoActual = "";
  const alAvance = ({ paso, anclas, fuerza }) => {
    if (paso !== pasoActual) {
      pasoActual = paso;
      pasos.forEach((li) => li.classList.toggle("activa", li.dataset.paso === paso));
    }
    const ancho = escena.clientWidth, alto = escena.clientHeight;
    for (const [clave, { el, ancla }] of Object.entries(rotulos)) {
      const a = anclas[ancla];
      const x = Math.min(ancho - el.offsetWidth - 4, Math.max(4, a.x - el.offsetWidth / 2));
      const y = Math.min(alto - el.offsetHeight - 36, Math.max(4, a.y - el.offsetHeight - 14));
      el.style.transform = `translate(${x}px, ${y}px)`;
      el.style.opacity = Math.min(1, fuerza[clave] * 1.6);
    }
  };

  let visor = null;
  // Se monta cuando ya casi se ve: el restaurante ya lo bajó la escena de arriba
  new IntersectionObserver(([e], obs) => {
    if (!e.isIntersecting) return;
    obs.disconnect();
    import("./visionops-camino.js")
      .then((m) => {
        visor = m.montarCamino({ escena, lienzo, alAvance, base: new URL("assets/visionops/", import.meta.url).href });
        visor.avanzar(avance());
        visor.listo.then(() => escena.classList.add("con-3d"));
      })
      .catch((err) => { console.warn("No se pudo montar el camino de Vision Ops:", err); seccion.classList.add("corrida"); });
  }, { rootMargin: "600px" }).observe(seccion);
  addEventListener("scroll", () => visor?.avanzar(avance()), { passive: true });
})();

// Privacidad: la cortina entre lo que ve la cámara y lo que mide Vision Ops. Se arrastra con el
// dedo o el mouse, o con las flechas desde el control (oculto a la vista, no al teclado)
(function cortina() {
  const fig = document.querySelector("[data-cortina]");
  if (!fig) return;
  const control = fig.querySelector(".vo-cortina-control");
  const poner = (v) => { v = Math.min(100, Math.max(0, v)); fig.style.setProperty("--corte", `${v}%`); control.value = String(Math.round(v)); };
  const desde = (e) => { const r = fig.getBoundingClientRect(); poner(((e.clientX - r.left) / r.width) * 100); };
  let tocada = false, arrastre = false;
  fig.addEventListener("pointerdown", (e) => { tocada = arrastre = true; fig.setPointerCapture(e.pointerId); desde(e); });
  fig.addEventListener("pointermove", (e) => { if (arrastre) desde(e); });
  ["pointerup", "pointercancel"].forEach((ev) => fig.addEventListener(ev, () => { arrastre = false; }));
  control.addEventListener("input", () => { tocada = true; poner(+control.value); });
  // Al aparecer, la cortina se mueve sola una vez para que se note que se puede arrastrar
  if (reducir) return;
  new IntersectionObserver(([e], obs) => {
    if (!e.isIntersecting) return;
    obs.disconnect();
    const t0 = performance.now();
    const paso = (t) => {
      if (tocada) return;
      const k = Math.min(1, (t - t0) / 1600);
      poner(50 + 30 * Math.sin(k * Math.PI * 2) * (1 - k));
      if (k < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  }, { threshold: 0.6 }).observe(fig);
})();

// Lo que recibes: el reporte se arma solo mientras se baja, en cuatro tiempos (ronda 20 de marca).
// Cada tiempo ocupa una cuarta parte del tramo fijo; dentro de él, cada parte avanza con el
// scroll. Con «menos movimiento» o pantallas muy bajas se ve todo completo, una parte debajo de otra.
(function reporte() {
  const seccion = document.querySelector("[data-reporte]");
  if (!seccion) return;
  if (reducir || innerHeight < 600) { seccion.classList.add("corrida"); return; }
  const limitar = (v) => Math.min(1, Math.max(0, v));
  const tramo = (k, a, b) => limitar((k - a) / (b - a));
  const suave = (x) => x * x * (3 - 2 * x);
  const capas = Object.fromEntries([...seccion.querySelectorAll("[data-capa]")].map((el) => [el.dataset.capa, el]));
  const pasos = [...seccion.querySelectorAll("[data-tiempo]")];
  const TIEMPOS = ["aviso", "evidencia", "cuentas", "pregunta"];

  // El correo: la frase se lee palabra por palabra
  const frase = capas.aviso.querySelector(".vo-correo-frase");
  const palabras = frase.textContent.trim().split(/\s+/).map((texto) => {
    const span = document.createElement("span");
    span.className = "palabra";
    span.textContent = texto;
    return span;
  });
  frase.replaceChildren(...palabras.flatMap((span, i) => (i ? [" ", span] : [span])));
  const notaCorreo = capas.aviso.querySelector(".vo-correo-nota");
  // La evidencia, las cuentas y la pregunta
  const zona = capas.evidencia.querySelector(".vo-ev-zona"), persona = capas.evidencia.querySelector(".vo-ev-persona");
  const rotulos = ["hora", "espera", "fila"].map((n) => capas.evidencia.querySelector(`.vo-ev-${n}`));
  const filas = [...capas.cuentas.querySelectorAll("dl div")], resta = capas.cuentas.querySelector(".vo-cuentas-resta");
  const escrita = capas.pregunta.querySelector("[data-escribe]"), textoPregunta = escrita.textContent;
  const burbuja = capas.pregunta.querySelector(".vo-pregunta-texto"), respuesta = capas.pregunta.querySelector(".vo-pregunta-respuesta");
  const barras = capas.pregunta.querySelector(".vo-barras");

  let actual = "";
  const pintar = () => {
    const r = seccion.getBoundingClientRect();
    const p = limitar(-r.top / (r.height - innerHeight));
    const i = Math.min(3, Math.floor(p * 4)), k = p * 4 - i, tiempo = TIEMPOS[i];
    if (tiempo !== actual) {
      actual = tiempo;
      pasos.forEach((li) => li.classList.toggle("activa", li.dataset.tiempo === tiempo));
      Object.entries(capas).forEach(([nombre, el]) => el.classList.toggle("activa", nombre === tiempo));
    }
    // Cada capa queda completa al pasar a la siguiente y vacía antes de su turno
    const de = (j) => (i > j ? 1 : i < j ? 0 : k);
    const k0 = de(0), k1 = de(1), k2 = de(2), k3 = de(3);
    const leidas = Math.ceil(tramo(k0, 0.05, 0.62) * palabras.length);
    palabras.forEach((span, j) => span.style.setProperty("--o", j < leidas ? 1 : 0.12));
    notaCorreo.style.setProperty("--o", tramo(k0, 0.62, 0.75));
    zona.style.setProperty("--z", suave(tramo(k1, 0.05, 0.4)));
    persona.style.setProperty("--p", suave(tramo(k1, 0.35, 0.65)));
    rotulos[0].style.setProperty("--o", tramo(k1, 0.15, 0.3));
    rotulos[1].style.setProperty("--o", tramo(k1, 0.6, 0.75));
    rotulos[2].style.setProperty("--o", tramo(k1, 0.3, 0.45));
    filas.forEach((el, j) => el.style.setProperty("--o", 0.2 + 0.8 * tramo(k2, 0.08 + j * 0.16, 0.2 + j * 0.16)));
    resta.style.setProperty("--o", tramo(k2, 0.74, 0.86));
    const letras = Math.round(tramo(k3, 0.02, 0.3) * textoPregunta.length);
    escrita.textContent = textoPregunta.slice(0, letras);
    burbuja.classList.toggle("escribiendo", letras < textoPregunta.length);
    respuesta.style.setProperty("--o", tramo(k3, 0.34, 0.46));
    barras.style.setProperty("--k", suave(tramo(k3, 0.42, 0.78)).toFixed(3));
  };
  addEventListener("scroll", pintar, { passive: true });
  addEventListener("resize", pintar);
  pintar();
})();

// Un día de operación: el mismo encuadre de la paletería, hora por hora. Al aparecer recorre el
// día una vez; después se mueve a mano. Son datos de ejemplo (ronda 20 de marca).
(function dia() {
  const seccion = document.querySelector("[data-dia]");
  if (!seccion) return;
  const control = seccion.querySelector("[data-dia-control]");
  const hora = seccion.querySelector("[data-dia-hora]"), lectura = seccion.querySelector("[data-dia-lectura]");
  const svg = seccion.querySelector("[data-dia-svg]"), grupo = seccion.querySelector("[data-dia-puntos]");
  const FILA = { 13: 1, 14: 2, 15: 2, 16: 3, 17: 5, 18: 6, 19: 4, 20: 2, 21: 1 };
  // Los lugares de la fila (en el orden en que se llena) y uno en la entrega, que siempre está
  const PUNTOS = [[532, 653], [672, 810], [810, 934], [1050, 760], [695, 700], [930, 875], [1010, 680]], ENTREGA = [875, 554];
  const ns = "http://www.w3.org/2000/svg";
  const puntos = [...PUNTOS, ENTREGA].map(() => {
    const c = document.createElementNS(ns, "circle");
    c.setAttribute("r", "13");
    grupo.append(c);
    return c;
  });
  const poner = (h) => {
    const n = FILA[h], d = h - 18;
    hora.textContent = `${h - 12} pm`;
    lectura.textContent = (n === 1 ? t("1 persona en la fila.", "1 person in the queue.") : t(`${n} personas en la fila.`, `${n} people in the queue.`)) + (h === 18 ? t(" La hora con más espera.", " The hour with the longest wait.") : "");
    puntos.forEach((c, j) => {
      const [x, y] = j < PUNTOS.length ? PUNTOS[j] : ENTREGA, mueve = j < PUNTOS.length;
      c.style.transform = `translate(${x + (mueve ? d * (j % 2 ? 9 : -7) : 0)}px, ${y - (mueve ? d * 5 : 0)}px)`;
      c.style.opacity = j < n || !mueve ? "1" : "0";
    });
    control.value = String(h);
  };
  // En celular, la imagen vertical es un recorte del mismo encuadre
  const vertical = matchMedia("(max-width: 760px)");
  const encuadre = () => svg.setAttribute("viewBox", vertical.matches ? "400 12 800 1000" : "0 0 1536 1024");
  vertical.addEventListener("change", encuadre);
  encuadre();
  poner(18);

  let reloj = 0;
  const parar = () => { clearInterval(reloj); reloj = 0; };
  control.addEventListener("input", () => { parar(); poner(+control.value); });
  control.addEventListener("pointerdown", parar);
  if (reducir) return;
  new IntersectionObserver(([e], obs) => {
    if (!e.isIntersecting) return;
    obs.disconnect();
    let h = 13;
    poner(h);
    reloj = setInterval(() => {
      h++;
      if (h > 21) { parar(); poner(18); return; }
      poner(h);
    }, 1100);
  }, { threshold: 0.5 }).observe(seccion.querySelector(".vo-dia-escena"));
})();

// El piloto empieza con una pregunta: con lo que elige la persona se arma su idea y el mensaje de
// WhatsApp. No se manda nada: el botón sólo abre WhatsApp con el texto escrito.
(function piloto() {
  const caja = document.querySelector("[data-piloto]");
  if (!caja) return;
  const campo = (n) => caja.querySelector(`[data-p="${n}"]`), salida = (n) => caja.querySelector(`[data-r="${n}"]`);
  const PREGUNTAS = {
    espera: [t("¿Dónde se acumula la espera?", "Where does the wait build up?"), t("Fotogramas, tiempos de espera y abandonos", "Frames, wait times and walk-outs")],
    cobertura: [t("¿Cuándo queda una zona sin nadie?", "When is an area left empty?"), t("Fotogramas y presencia por zona", "Frames and presence per area")],
    recorridos: [t("¿Por dónde se mueve la gente?", "Where do people move?"), t("Fotogramas y mapa de recorridos", "Frames and a map of paths")],
  };
  const ZONAS = {
    restaurante: { espera: t("La fila y el mostrador", "The queue and the counter"), cobertura: t("La entrega y las mesas", "Pickup and tables"), recorridos: t("La entrada, el mostrador y las mesas", "The entrance, the counter and the tables") },
    almacen: { espera: t("La recepción y la salida", "Receiving and shipping"), cobertura: t("La recepción y la preparación", "Receiving and picking"), recorridos: t("La recepción, la preparación y la salida", "Receiving, picking and shipping") },
    linea: { espera: t("La entrada y el empaque", "Intake and packing"), cobertura: t("Las estaciones del proceso", "The process stations"), recorridos: t("La entrada, el proceso y el empaque", "Intake, process and packing") },
  };
  const NOMBRE = { restaurante: t("restaurante o comercio de comida", "restaurant or food business"), almacen: t("almacén", "warehouse"), linea: t("línea de producción", "production line") };
  const actualizar = () => {
    const op = campo("operacion").value, obj = campo("objetivo").value;
    const n = Math.min(50, Math.max(1, parseInt(campo("camaras").value, 10) || 1));
    if (campo("camaras").value !== "" && +campo("camaras").value !== n) campo("camaras").value = String(n);
    const [pregunta, evidencia] = PREGUNTAS[obj], zona = ZONAS[op][obj];
    salida("pregunta").textContent = pregunta;
    salida("zona").textContent = zona;
    salida("evidencia").textContent = evidencia;
    salida("alcance").textContent = (n === 1 ? t("Para empezar: 1 cámara.", "To start: 1 camera.") : t(`Para empezar: ${n} cámaras.`, `To start: ${n} cameras.`))
      + t(" Lo confirmamos juntos en el diagnóstico.", " We confirm it together in the assessment.")
      + (op === "restaurante" ? "" : t(" Fuera de restaurantes, lo armamos a la medida.", " Outside restaurants, we build it to measure."));
    const mensaje = t(
      `Hola, vengo de albavision.tech y quiero un piloto de Vision Ops.\nMi operación: ${NOMBRE[op]}\nQuiero entender: ${pregunta}\nZona: ${zona}\nCámaras para revisar: ${n}`,
      `Hi, I found you on albavision.tech and I want a Vision Ops pilot.\nMy operation: ${NOMBRE[op]}\nI want to understand: ${pregunta}\nArea: ${zona}\nCameras to review: ${n}`);
    salida("enviar").href = `https://wa.me/525616908570?text=${encodeURIComponent(mensaje)}`;
  };
  caja.addEventListener("input", actualizar);
  caja.addEventListener("change", actualizar);
  actualizar();
})();

