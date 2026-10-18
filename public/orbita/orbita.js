// Órbita: la conversación que pasa sola en el teléfono de la portada, y la bandeja
// de tu equipo que cambia paso a paso conforme se baja.
// Con «menos movimiento» todo se queda quieto y completo.

const reducir = matchMedia("(prefers-reduced-motion: reduce)").matches;
const celular = matchMedia("(max-width: 760px)");
// La misma página sirve en español y en inglés (public/en/orbita/): el idioma sale de <html lang>.
const EN = document.documentElement.lang === "en";
const t = (es, en) => (EN ? en : es);

// ── El teléfono: los mensajes son los que usa Órbita; el menú y los precios, de ejemplo ──
const guionEs = [
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
// En inglés, los mismos mensajes traducidos (Órbita conversa en español con los negocios de México)
const guionEn = [
  ["cliente", "Hi, I'd like to order"],
  ["agente", "Identifies the intent: wants to order"],
  ["orbita", "Which branch would you like to order from? Reply with its name or number.\n1. Centro\n2. Norte"],
  ["cliente", "1"],
  ["agente", "Checks the open menus"],
  ["orbita", "Which menu would you like? Reply with its name or number.\n1. Set menu\n2. Vegetarian menu"],
  ["cliente", "Set menu"],
  ["orbita", "How many packages would you like? You can order from 1 to 20."],
  ["cliente", "2"],
  ["orbita", "Whose name should we put the request under?"],
  ["cliente", "Lucía Ramírez"],
  ["orbita", "Would you prefer home delivery or pickup at the branch?"],
  ["cliente", "Pickup"],
  ["orbita", "How would you like to pay: bank transfer or cash on delivery?"],
  ["cliente", "Bank transfer"],
  ["agente", "Verifies the quote with the business"],
  ["cotizacion", ""],
  ["cliente", "Yes"],
  ["agente", "Registers the request"],
  ["orbita", "Request registered: 1042. The team must check payment, delivery and availability before confirming the order."],
  ["sistema", "Pending your team's review"],
];
const guion = EN ? guionEn : guionEs;
const cotizacionEn = '<p>Your quote:</p><dl><dt>Set menu × 2</dt><dd>$340</dd><dt>Pickup · Centro</dt><dd>—</dd><dt>Payment</dt><dd>Bank transfer</dd><dt>Total</dt><dd>$340</dd></dl><p>To send this quote, reply «yes». To discard it, «cancel».</p>';
const cotizacionEs = '<p>Tu cotización:</p><dl><dt>Menú del día × 2</dt><dd>$340</dd><dt>Recoger · Centro</dt><dd>—</dd><dt>Pago</dt><dd>Transferencia</dd><dt>Total</dt><dd>$340</dd></dl><p>Para enviar esta cotización responde «sí». Para descartarla, «cancelar».</p>';
const cotizacion = EN ? cotizacionEn : cotizacionEs;

const video = document.querySelector("[data-video-chat]");
if (video) {
  const cuerpo = video.querySelector("[data-tel-cuerpo]");
  const estado = video.querySelector("[data-tel-estado]");
  const boton = video.querySelector("[data-video-boton]");
  const campo = video.querySelector("[data-tel-campo]");
  const enviar = video.querySelector("[data-tel-enviar]");
  let paso = 0, pausado = false, visible = false, reloj = 0, tecleado = 0;

  const burbuja = ([quien, texto], entra = true) => {
    const el = document.createElement(quien === "cotizacion" ? "div" : "p");
    el.className = `tm tm-${quien === "cotizacion" ? "orbita tm-cot" : quien}${entra ? " entra" : ""}`;
    if (quien === "cotizacion") el.innerHTML = cotizacion; else el.textContent = texto;
    if (quien === "cliente") {
      // Las palomitas: grises al enviar, azules cuando Órbita lo lee
      const palomitas = document.createElement("span");
      palomitas.className = "tm-palomitas";
      palomitas.textContent = "✓✓";
      el.append(palomitas);
      if (!entra) el.classList.add("leido");
    }
    return el;
  };
  const ponerCampo = (texto) => {
    campo.textContent = texto || t("Mensaje", "Message");
    campo.classList.toggle("vacio", !texto);
  };
  const poner = (el) => {
    cuerpo.append(el);
    while (cuerpo.children.length > 12) cuerpo.firstElementChild.remove();
  };
  const quitarEscribiendo = () => {
    cuerpo.querySelector(".tm-escribiendo")?.remove();
    estado.textContent = t("en línea", "online");
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
    const [quien, texto] = linea;
    if (quien === "cliente") {
      // El cliente teclea en la barra de abajo, letra por letra, y luego envía
      if (tecleado < texto.length) {
        tecleado += 1;
        ponerCampo(texto.slice(0, tecleado));
        reloj = setTimeout(siguiente, Math.max(28, Math.min(70, 1100 / texto.length)));
        return;
      }
      if (!enviar.classList.contains("pulsa")) {
        enviar.classList.add("pulsa");
        reloj = setTimeout(siguiente, 260);
        return;
      }
      enviar.classList.remove("pulsa");
      ponerCampo("");
      tecleado = 0;
      poner(burbuja(linea));
      paso += 1;
      reloj = setTimeout(siguiente, 650);
      return;
    }
    const habla = quien === "orbita" || quien === "cotizacion";
    if (habla && !cuerpo.querySelector(".tm-escribiendo")) {
      // Órbita lee (palomitas azules) y escribe: los puntitos duran según el largo de la respuesta
      cuerpo.querySelectorAll(".tm-cliente:not(.leido)").forEach((m) => m.classList.add("leido"));
      const puntos = document.createElement("p");
      puntos.className = "tm tm-orbita tm-escribiendo entra";
      puntos.innerHTML = "<i></i><i></i><i></i>";
      poner(puntos);
      estado.textContent = t("escribiendo…", "typing…");
      estado.classList.add("activo");
      const largo = quien === "cotizacion" ? 140 : texto.length;
      reloj = setTimeout(siguiente, Math.min(2800, 900 + largo * 16));
      return;
    }
    if (quien === "agente") cuerpo.querySelectorAll(".tm-cliente:not(.leido)").forEach((m) => m.classList.add("leido"));
    quitarEscribiendo();
    poner(burbuja(linea));
    paso += 1;
    const espera = quien === "agente" ? 900 : quien === "cotizacion" ? 3400 : quien === "sistema" ? 1200 : 1800;
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
      boton.textContent = pausado ? t("Reanudar", "Resume") : t("Pausar", "Pause");
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
  const estados = EN ? [
    ["Hi, I'd like to order", "New"],
    ["Órbita: Which menu would you like?", "Replying"],
    ["Quote: Set menu × 2 · $340", "Quote sent"],
    ["Yes", "Ready for review"],
  ] : [
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
