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
