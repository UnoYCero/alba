// Órbita: la conversación que pasa sola en el teléfono de la portada, y la bandeja
// de tu equipo que cambia paso a paso conforme se baja.
// Con «menos movimiento» todo se queda quieto y completo.

const reducir = matchMedia("(prefers-reduced-motion: reduce)").matches;
const celular = matchMedia("(max-width: 760px)");

// ── El teléfono: los mensajes son los que usa Órbita; el menú y los precios, de ejemplo ──
const guion = [
  ["cliente", "Hola, quiero pedir"],
  ["agente", "Identifica la intención: quiere pedir"],
  ["orbita", "¿En qué sucursal quieres pedir? Responde con su nombre o número.\n1. Centro\n2. Norte"],
  ["cliente", "1"],
  ["agente", "Consulta los menús abiertos"],
  ["orbita", "¿Qué menú quieres? Responde con su nombre o número.\n1. Menú del día\n2. Menú vegetariano"],
  ["cliente", "Menú del día"],
  ["orbita", "¿Cuántos paquetes quieres? Puedes pedir de 1 a 20."],
  ["cliente", "2"],
  ["orbita", "¿A nombre de quién registramos la solicitud?"],
  ["cliente", "Lucía Ramírez"],
  ["orbita", "¿Prefieres entrega a domicilio o recoger en sucursal?"],
  ["cliente", "Recoger"],
  ["orbita", "¿Cómo prefieres pagar: transferencia o efectivo al recibir?"],
  ["cliente", "Transferencia"],
  ["agente", "Verifica la cotización con el negocio"],
  ["cotizacion", ""],
  ["cliente", "Sí"],
  ["agente", "Registra la solicitud"],
  ["orbita", "Solicitud registrada: 1042. El equipo debe revisar pago, envío y disponibilidad antes de confirmar el pedido."],
  ["sistema", "Pendiente de revisión de tu equipo"],
];
const cotizacion = '<p>Tu cotización:</p><dl><dt>Menú del día × 2</dt><dd>$340</dd><dt>Recoger · Centro</dt><dd>—</dd><dt>Pago</dt><dd>Transferencia</dd><dt>Total</dt><dd>$340</dd></dl><p>Para enviar esta cotización responde «sí». Para descartarla, «cancelar».</p>';

const video = document.querySelector("[data-video-chat]");
if (video) {
  const cuerpo = video.querySelector("[data-tel-cuerpo]");
  const estado = video.querySelector("[data-tel-estado]");
  const boton = video.querySelector("[data-video-boton]");
  let paso = 0, pausado = false, visible = false, reloj = 0;

  const burbuja = ([quien, texto], entra = true) => {
    const el = document.createElement(quien === "cotizacion" ? "div" : "p");
    el.className = `tm tm-${quien === "cotizacion" ? "orbita tm-cot" : quien}${entra ? " entra" : ""}`;
    if (quien === "cotizacion") el.innerHTML = cotizacion; else el.textContent = texto;
    return el;
  };
  const poner = (el) => {
    cuerpo.append(el);
    while (cuerpo.children.length > 12) cuerpo.firstElementChild.remove();
  };
  const quitarEscribiendo = () => {
    cuerpo.querySelector(".tm-escribiendo")?.remove();
    estado.textContent = "en línea";
    estado.classList.remove("activo");
  };

  const siguiente = () => {
    reloj = 0;
    if (pausado || !visible || document.hidden) return;
    if (paso >= guion.length) {
      // Al terminar, una pausa para leer y vuelve a empezar
      reloj = setTimeout(() => { cuerpo.replaceChildren(); paso = 0; siguiente(); }, 4500);
      return;
    }
    const linea = guion[paso];
    const habla = linea[0] === "orbita" || linea[0] === "cotizacion";
    if (habla && !cuerpo.querySelector(".tm-escribiendo")) {
      // Antes de cada respuesta, «escribiendo…»
      const puntos = document.createElement("p");
      puntos.className = "tm tm-orbita tm-escribiendo entra";
      puntos.innerHTML = "<i></i><i></i><i></i>";
      poner(puntos);
      estado.textContent = "escribiendo…";
      estado.classList.add("activo");
      reloj = setTimeout(siguiente, 1100);
      return;
    }
    quitarEscribiendo();
    poner(burbuja(linea));
    paso += 1;
    const espera = linea[0] === "cliente" ? 900 : linea[0] === "agente" ? 700 : linea[0] === "cotizacion" ? 3200 : 1700;
    reloj = setTimeout(siguiente, espera);
  };
  const arrancar = () => { if (!reloj) siguiente(); };

  if (reducir) {
    // Quieto: el final de la conversación, completo
    cuerpo.replaceChildren(...guion.slice(-8).map((l) => burbuja(l, false)));
  } else {
    cuerpo.replaceChildren();
    boton.addEventListener("click", () => {
      pausado = !pausado;
      boton.setAttribute("aria-pressed", String(pausado));
      boton.textContent = pausado ? "Reanudar" : "Pausar";
      if (!pausado) arrancar();
    });
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) arrancar(); }, { threshold: 0.25 }).observe(video);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) arrancar(); });
  }
}

// ── La bandeja de tu equipo: cambia con cada paso al bajar ──
const seccion = document.querySelector("[data-pasos-chat]");
if (seccion) {
  const botones = [...seccion.querySelectorAll("[data-paso]")];
  const texto = seccion.querySelector("[data-fila-texto]");
  const estadoFila = seccion.querySelector("[data-fila-estado]");
  const solicitud = seccion.querySelector("[data-solicitud]");
  const estados = [
    ["Hola, quiero pedir", "Nueva"],
    ["Órbita: ¿Qué menú quieres?", "Respondiendo"],
    ["Cotización: Menú del día × 2 · $340", "Cotización enviada"],
    ["Sí", "Lista para revisar"],
  ];
  const corrida = () => reducir || (celular.matches && innerHeight < 700);
  let actual = -1;

  const mostrar = (i) => {
    if (i === actual) return;
    actual = i;
    botones.forEach((b, j) => b.setAttribute("aria-current", j === i ? "true" : "false"));
    texto.textContent = estados[i][0];
    estadoFila.textContent = estados[i][1];
    estadoFila.classList.toggle("estado-lista", i === estados.length - 1);
    solicitud.classList.toggle("abierta", i === estados.length - 1);
  };

  const alBajar = () => {
    seccion.classList.toggle("corrida", corrida());
    if (corrida()) { mostrar(botones.length - 1); return; }
    const r = seccion.getBoundingClientRect();
    const avance = Math.min(1, Math.max(0, -r.top / (r.height - innerHeight)));
    mostrar(Math.min(botones.length - 1, Math.floor(avance * botones.length)));
  };

  botones.forEach((b, j) => b.addEventListener("click", () => {
    if (corrida()) return;
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
  alBajar();
}
