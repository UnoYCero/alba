// Alba Labs: «Ve. Recuerda. Actúa.» como una pantalla fija que cambia al bajar.
// En teléfonos bajitos o con «menos movimiento» se vuelve contenido corrido y los pasos se tocan.

const reducir = matchMedia("(prefers-reduced-motion: reduce)").matches;
// La misma página sirve en español y en inglés (public/en/): el idioma sale de <html lang>
const t = (es, en) => (document.documentElement.lang === "en" ? en : es);
const tiene3D = (() => { if (document.documentElement.dataset.webgl === "off") return false; try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; } })();
const celular = matchMedia("(max-width: 760px)");
const seccion = document.querySelector("[data-tiempos]");

// Tres elecciones conservadas durante la visita, en lectura natural: no hace falta
// consumir varias pantallas para pasar de la escena al recuerdo y a la acción.
if (seccion) {
  seccion.classList.add("corrida");
  const botones=[...seccion.querySelectorAll("[data-tiempo]")];
  const capas=[...seccion.querySelectorAll("[data-capa]")];
  const mostrar=i=>{
    botones.forEach((b,j)=>b.setAttribute("aria-current",String(j===i)));
    capas.forEach((c,j)=>{
      c.classList.toggle("activa",j===i); c.inert=j!==i;
      c.setAttribute("aria-hidden",String(j!==i));
    });
  };
  botones.forEach((b,i)=>b.addEventListener("click",()=>mostrar(i)));
  mostrar(0);
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
  // Quien se acerca con el mouse o el teclado quiere leer: deja de cambiar solo
  ["focusin", "pointerenter"].forEach((ev) => caja.querySelector(".lb-clips").addEventListener(ev, () => { tocado = true; clearInterval(reloj); }));
  let recienArrastrado = false;
  botones.forEach((b, i) => b.addEventListener("click", () => {
    if (recienArrastrado) { recienArrastrado = false; return; }
    tocado = true; clearInterval(reloj); elegir(i);
  }));
  // Arrastrar la tarjeta y soltarla sobre los lentes: el clip entra y se acopla. Con el mouse se
  // arrastra la tarjeta entera; en el celular, desde el dibujo (el resto de la tarjeta deja bajar).
  // Si se suelta fuera, la tarjeta regresa a su lugar.
  botones.forEach((b, i) => b.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || (e.pointerType !== "mouse" && !e.target.closest(".lb-clip-dibujo"))) return;
    const inicio = { x: e.clientX, y: e.clientY };
    let fantasma = null;
    const encima = (ev) => { const r = escena.getBoundingClientRect(); return ev.clientX > r.left && ev.clientX < r.right && ev.clientY > r.top && ev.clientY < r.bottom; };
    const mover = (ev) => {
      if (!fantasma) {
        if (Math.hypot(ev.clientX - inicio.x, ev.clientY - inicio.y) < 6) return;
        fantasma = b.querySelector(".lb-clip-dibujo").cloneNode();
        fantasma.className = "lb-clip-fantasma";
        document.body.append(fantasma);
        b.classList.add("arrastrando");
      }
      fantasma.style.transform = `translate(${ev.clientX - 45}px, ${ev.clientY - 45}px)`;
      escena.classList.toggle("recibiendo", encima(ev));
    };
    const soltar = (ev) => {
      removeEventListener("pointermove", mover);
      removeEventListener("pointerup", soltar);
      removeEventListener("pointercancel", soltar);
      escena.classList.remove("recibiendo");
      b.classList.remove("arrastrando");
      if (!fantasma) return;
      recienArrastrado = true;
      setTimeout(() => { recienArrastrado = false; }, 0);
      if (ev.type === "pointerup" && encima(ev)) {
        fantasma.remove();
        tocado = true; clearInterval(reloj); elegir(i);
        return;
      }
      // De regreso a su tarjeta
      const r = b.querySelector(".lb-clip-dibujo").getBoundingClientRect();
      fantasma.classList.add("regresa");
      fantasma.style.transform = `translate(${r.left}px, ${r.top}px)`;
      setTimeout(() => fantasma.remove(), 350);
    };
    addEventListener("pointermove", mover);
    addEventListener("pointerup", soltar);
    addEventListener("pointercancel", soltar);
  }));
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
  ["focusin", "pointerenter"].forEach((ev) => caja.querySelector(".lb-clips").addEventListener(ev, () => { tocado = true; clearInterval(reloj); }));
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
  // El lector de pantalla oye la respuesta completa cuando termina, no letra por letra
  const anuncio = document.createElement("p");
  anuncio.setAttribute("aria-live", "polite");
  anuncio.style.cssText = "position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap";
  caja.querySelector(".lb-chat").append(anuncio);
  ["focusin", "pointerenter"].forEach((ev) => caja.querySelector(".lb-chat").addEventListener(ev, () => { tocado = true; }));
  const escribir = (texto) => {
    clearInterval(escritura);
    anuncio.textContent = texto;
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
    if (!tocado) preguntar(0);
    reloj = setInterval(() => { if (!tocado && !document.hidden) preguntar((actual + 1) % otras.length); }, 6500);
  }, { threshold: 0.5 }).observe(caja.querySelector(".lb-chat"));
})();

// ── Entre ver y crear: del fotograma al dato, en cuatro pasos sobre la misma escena ──
// ── Tu idea en el laboratorio: con lo que escribe la persona se arma su experimento y el mensaje de
// WhatsApp. No se manda nada: el botón sólo abre WhatsApp con el texto escrito ──
(function tuIdea() {
  const caja = document.querySelector("[data-idea]");
  if (!caja) return;
  const campo = (n) => caja.querySelector(`[data-i="${n}"]`), hoja = (n) => caja.querySelector(`[data-h="${n}"]`);
  const RUTAS = {
    aplicacion: [t("Una aplicación para los lentes", "An app for the glasses"), t("Una escena y una intención concreta.", "A scene and a concrete intention."), t("Una receta de ejemplo y una respuesta que puedas revisar.", "An example recipe and an answer you can check."), t("Comprobar que el contexto ayuda en una tarea.", "Check that the context helps with a task.")],
    modulo: [t("Un módulo propio", "A module of your own"), t("Una necesidad que la base actual no cubra.", "A need the current base does not cover."), t("Un boceto, la forma de acople y las preguntas de viabilidad.", "A sketch, the way it attaches and the feasibility questions."), t("Revisar montaje, uso y límites antes de fabricar.", "Review fit, use and limits before building it.")],
    aula: [t("Una experiencia para el aula", "A classroom experience"), t("Algo que el grupo quiera observar o entender.", "Something the group wants to observe or understand."), t("Una actividad corta, una escena de ejemplo y el registro de lo aprendido.", "A short activity, an example scene and a record of what was learned."), t("Definir qué podría explicar o construir cada estudiante.", "Define what each student could explain or build.")],
  };
  const actualizar = () => {
    const [titulo, idea, experimento, prueba] = RUTAS[caja.querySelector('[data-i="ruta"]:checked').value];
    const suya = campo("idea").value.trim(), comprobar = campo("prueba").value.trim();
    hoja("titulo").textContent = titulo;
    hoja("idea").textContent = suya || idea;
    hoja("experimento").textContent = experimento;
    hoja("prueba").textContent = comprobar || prueba;
    const lineas = [t("Hola, vengo de albavision.tech y tengo una idea para Alba Labs.", "Hi, I found you on albavision.tech and I have an idea for Alba Labs."), t(`Quiero explorar: ${titulo}`, `I want to explore: ${titulo}`)];
    if (suya) lineas.push(t(`Mi idea: ${suya}`, `My idea: ${suya}`));
    if (comprobar) lineas.push(t(`Sabría que ayudó si: ${comprobar}`, `I would know it helped if: ${comprobar}`));
    hoja("enviar").href = `https://wa.me/525616908570?text=${encodeURIComponent(lineas.join("\n"))}`;
  };
  caja.addEventListener("input", actualizar);
  caja.addEventListener("change", actualizar);
  // Los ejemplos llenan el campo con un toque, para no empezar en blanco
  caja.querySelectorAll("[data-para]").forEach((b) => b.addEventListener("click", () => {
    const destino = campo(b.dataset.para);
    destino.value = b.textContent;
    actualizar();
  }));
  actualizar();
})();

