// Interacciones manuales de Ronda 24. Textos en HTML, traducidos por version-en.
function elegir(botones, paneles, atributo) {
  botones.forEach((boton, indice) => boton.addEventListener("click", () => {
    botones.forEach((otro, n) => otro.setAttribute("aria-pressed", String(n === indice)));
    paneles.forEach((panel) => { panel.hidden = Number(panel.getAttribute(atributo)) !== indice; });
  }));
}

const puertas = document.querySelector("[data-puertas]");
if (puertas) {
  const botones = [...puertas.querySelectorAll("[data-puerta]")];
  botones.forEach((boton, indice) => boton.addEventListener("click", () => {
    botones.forEach((otro, n) => otro.setAttribute("aria-pressed", String(n === indice)));
    puertas.querySelectorAll(".r24-puerta").forEach((panel, n) => { panel.hidden = n !== indice; });
  }));
}
const mision = document.querySelector("[data-mision]");
if (mision) elegir([...mision.querySelectorAll("[data-mision-opcion]")], [...mision.querySelectorAll("[data-mision-texto]")], "data-mision-texto");

const receta = document.querySelector("[data-receta]");
if (receta) {
  const elegirManual = receta.querySelector("[data-receta-elegir]");
  const siguiente = receta.querySelector("[data-receta-siguiente]");
  const reiniciar = receta.querySelector("[data-receta-reiniciar]");
  const mostrar = (paso) => {
    receta.querySelectorAll("[data-receta-paso]").forEach((panel) => { panel.hidden = Number(panel.dataset.recetaPaso) !== paso; });
    elegirManual.setAttribute("aria-pressed", String(paso > 0));
    siguiente.disabled = paso === 0;
    siguiente.hidden = paso === 2;
    reiniciar.hidden = paso === 0;
  };
  elegirManual.addEventListener("click", () => mostrar(1));
  siguiente.addEventListener("click", () => mostrar(2));
  reiniciar.addEventListener("click", () => { mostrar(0); elegirManual.focus({ preventScroll: true }); });
}

const proceso = document.querySelector("[data-surface]");
if (proceso) {
  const reducir = matchMedia("(prefers-reduced-motion: reduce)");
  const bajo = matchMedia("(max-height: 699px)");
  const botones = [...proceso.querySelectorAll("[data-surface-elegir]")];
  const paneles = [...proceso.querySelectorAll("[data-surface-texto]")];
  let manual = false, pendiente = false;
  const mostrar = (paso) => {
    proceso.dataset.surfacePaso = String(paso);
    botones.forEach((boton, n) => boton.setAttribute("aria-pressed", String(n === paso)));
    paneles.forEach((panel, n) => { panel.hidden = n !== paso; });
  };
  botones.forEach((boton, n) => boton.addEventListener("click", () => { manual = true; mostrar(n); }));
  // El teclado y el cursor conservan el paso elegido; bajar deja de pelear con la selección.
  proceso.querySelector(".r24-opciones").addEventListener("focusin", () => { manual = true; });
  const actualizar = () => {
    pendiente = false;
    if (manual || reducir.matches || bajo.matches || proceso.classList.contains("surface-flujo")) return;
    const rect = proceso.getBoundingClientRect();
    const recorrido = rect.height - proceso.querySelector(".surface-pin").offsetHeight;
    if (recorrido > 0) mostrar(Math.min(3, Math.max(0, Math.floor(-rect.top / recorrido * 4))));
  };
  addEventListener("scroll", () => { if (!pendiente) { pendiente = true; requestAnimationFrame(actualizar); } }, { passive: true });
  addEventListener("resize", actualizar);
  reducir.addEventListener("change", actualizar);
  const saltar = proceso.querySelector("[data-surface-saltar]");
  saltar.addEventListener("click", () => document.querySelector("#oficina").scrollIntoView({ behavior: reducir.matches ? "auto" : "smooth" }));
  // Sin movimiento o en teléfono bajo, todos los pasos se explican además como lectura corrida.
  actualizar();
}
