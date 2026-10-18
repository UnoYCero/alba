// Portada de Alba Vision: menú flotante, origen y Alba Vision en pantallas fijas
// que cambian al bajar, collage de hitos explorable, y el 3D cargado sólo cuando se va a ver.

const prefMovimiento = matchMedia("(prefers-reduced-motion: reduce)");
const punteroFino = matchMedia("(pointer: fine)").matches;
const celular = matchMedia("(max-width: 760px)");
const anchoMenu = matchMedia("(max-width: 1080px)");
let reducir = prefMovimiento.matches;
document.documentElement.classList.toggle("reduce", reducir);
const limitar = (v) => Math.min(1, Math.max(0, v));
// La misma página sirve en español y en inglés (public/en/): el idioma sale de <html lang>.
const EN = document.documentElement.lang === "en";
const t = (es, en) => (EN ? en : es);

document.querySelectorAll("[data-year]").forEach((el) => { el.textContent = new Date().getFullYear(); });
// El titular entra al cargar o, si hay apertura de ojos, cuando los ojos se abren
const mostrarPortada = () => document.querySelector(".hero")?.classList.add("listo");

// ── Menú: se compacta al bajar y marca la sección en la que estás ──
const nav = document.querySelector("[data-nav]");
const marcador = nav.querySelector(".nav-marker");
const enlacesSpy = [...nav.querySelectorAll("[data-spy]")];
const seccionesSpy = enlacesSpy.map((a) => document.getElementById(a.dataset.spy));
function espiar() {
  nav.classList.toggle("scrolled", scrollY > 40);
  let activo = null;
  seccionesSpy.forEach((s, i) => {
    const r = s.getBoundingClientRect();
    if (r.top < innerHeight * 0.45 && r.bottom > innerHeight * 0.45) activo = enlacesSpy[i];
  });
  enlacesSpy.forEach((a) => a.classList.toggle("activo", a === activo));
  if (activo) {
    marcador.style.setProperty("--mx", `${activo.offsetLeft}px`);
    marcador.style.setProperty("--mw", (activo.offsetWidth / 100).toFixed(3));
    marcador.style.opacity = "1";
  } else {
    marcador.style.opacity = "0";
  }
}

// ── Menú del celular: se cierra con Escape, al elegir y al cambiar de ancho ──
const boton = document.querySelector("[data-nav-toggle]");
const panelMenu = document.querySelector("[data-nav-panel]");
const menuAbierto = () => boton.getAttribute("aria-expanded") === "true";
function cerrarMenu({ devolverFoco = false } = {}) {
  boton.setAttribute("aria-expanded", "false");
  boton.setAttribute("aria-label", t("Abrir menú", "Open menu"));
  panelMenu.classList.remove("abierto");
  nav.classList.remove("abierto");
  document.body.style.overflow = "";
  if (devolverFoco && anchoMenu.matches) boton.focus();
}
boton.addEventListener("click", () => {
  if (menuAbierto()) return cerrarMenu();
  boton.setAttribute("aria-expanded", "true");
  boton.setAttribute("aria-label", t("Cerrar menú", "Close menu"));
  panelMenu.classList.add("abierto");
  nav.classList.add("abierto");
  document.body.style.overflow = "hidden";
});
panelMenu.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => cerrarMenu()));
addEventListener("keydown", (e) => { if (e.key === "Escape" && menuAbierto()) cerrarMenu({ devolverFoco: true }); });
anchoMenu.addEventListener("change", () => { if (menuAbierto()) cerrarMenu(); });

// ── Apariciones ──
const grupos = new Map();
document.querySelectorAll(".reveal").forEach((el) => {
  const n = grupos.get(el.parentElement) || 0;
  el.style.setProperty("--i", n);
  grupos.set(el.parentElement, n + 1);
});
const aparecer = new IntersectionObserver((entradas) => {
  entradas.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); aparecer.unobserve(e.target); } });
}, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
document.querySelectorAll(".reveal").forEach((el) => aparecer.observe(el));

// Avance de una sección fija: 0 al llegar, 1 al terminar
const avanceFijo = (seccion) => {
  const r = seccion.getBoundingClientRect();
  return limitar(-r.top / (r.height - innerHeight));
};

// ── Origen: se lee desde el inicio; las palabras se encienden y la misión y la visión llegan pronto ──
const origen = document.querySelector(".origen");
const scrub = origen.querySelector("[data-scrub]");
scrub.innerHTML = scrub.textContent.trim().split(/\s+/).map((p) => `<span class="w">${p}</span>`).join(" ");
const palabras = [...scrub.querySelectorAll(".w")];
function encender() {
  if (reducir) {
    palabras.forEach((w) => w.classList.add("on"));
    origen.classList.add("fin");
    return;
  }
  const p = avanceFijo(origen);
  const hasta = Math.round(limitar(p / 0.5) * palabras.length);
  palabras.forEach((w, i) => w.classList.toggle("on", i < hasta));
  origen.classList.toggle("fin", p > 0.35);
}

// ── Misión y visión: al bajar, la línea recorre la foto de «lo que ves» a «lo que ve Alba».
// También se arrastra (dedo, mouse o flechas). En teléfonos bajitos o quieta, sólo se arrastra ──
const masAlla = document.querySelector("[data-cortina]");
if (masAlla) {
  const marco = masAlla.querySelector(".cortina");
  const control = masAlla.querySelector("[data-cortina-control]");
  const textos = [...masAlla.querySelectorAll("[data-mv]")];
  const corrida = () => reducir || (matchMedia("(max-width: 760px)").matches && innerHeight < 700);
  let avanceAlArrastrar = null;
  const poner = (v) => {
    marco.style.setProperty("--corte", `${v}%`);
    control.value = String(Math.round(v));
    textos.forEach((t, i) => t.classList.toggle("activa", i === (v > 50 ? 0 : 1)));
  };
  const alBajarCortina = () => {
    masAlla.classList.toggle("corrida", corrida());
    if (corrida()) return;
    const p = avanceFijo(masAlla);
    // Si la persona la arrastró, se respeta hasta que vuelva a bajar un buen tramo
    if (avanceAlArrastrar !== null && Math.abs(p - avanceAlArrastrar) < 0.06) return;
    avanceAlArrastrar = null;
    poner(92 - limitar((p - 0.1) / 0.72) * 84);
  };
  control.addEventListener("input", () => {
    avanceAlArrastrar = corrida() ? null : avanceFijo(masAlla);
    poner(Number(control.value));
  });
  addEventListener("scroll", () => requestAnimationFrame(alBajarCortina), { passive: true });
  addEventListener("resize", alBajarCortina);
  if (corrida()) poner(50);
  alBajarCortina();
}

// ── Alba Vision: los proyectos como lista; el que se toca (o se señala sobre su nombre) se abre
// y su imagen aparece en el visor ──
const proyectos = [...document.querySelectorAll("[data-proyecto]")];
const visuales = [...document.querySelectorAll("[data-visual]")];
const textoVisor = document.querySelector("[data-visor-texto]");
const escritorio = matchMedia("(min-width: 1081px)");
// En escritorio la descripción va junto a la imagen, así la lista no cambia de alto bajo el cursor
function abrirProyecto(i) {
  if (textoVisor) textoVisor.innerHTML = proyectos[i].querySelector(".proyecto-detalle > div").innerHTML;
  proyectos.forEach((p, j) => {
    p.classList.toggle("activo", j === i);
    p.querySelector(".proyecto-nombre").setAttribute("aria-expanded", String(j === i));
  });
  visuales.forEach((v, j) => v.classList.toggle("activa", j === i));
}
proyectos.forEach((p, j) => {
  const nombre = p.querySelector(".proyecto-nombre");
  nombre.addEventListener("click", () => abrirProyecto(j));
  // En escritorio también se abre con el mouse, pero sólo sobre la palabra (no toda la fila)
  // y tras una pausa corta: así, al ir hacia «Conoce…», rozar otro nombre no cambia nada
  const palabra = nombre.querySelector("span");
  let espera = 0;
  palabra.addEventListener("pointerenter", (e) => {
    if (e.pointerType !== "mouse" || !escritorio.matches) return;
    espera = setTimeout(() => abrirProyecto(j), 160);
  });
  palabra.addEventListener("pointerleave", () => clearTimeout(espera));
});
// Las imágenes del visor se piden en cuanto termina de cargar la página, para que ninguna aparezca vacía
const pedirImagenesProyectos = () => document.querySelectorAll('.proyectos-visor img[loading="lazy"]').forEach((img) => { img.loading = "eager"; });
if (document.readyState === "complete") pedirImagenesProyectos();
else addEventListener("load", pedirImagenesProyectos, { once: true });
abrirProyecto(0);

// Un solo manejador de desplazamiento, una vez por cuadro
let pendiente = false;
function alDesplazar() {
  if (pendiente) return;
  pendiente = true;
  requestAnimationFrame(() => { pendiente = false; espiar(); encender(); });
}
addEventListener("scroll", alDesplazar, { passive: true });
addEventListener("resize", alDesplazar);
espiar(); encender();

// ── Collage de hitos: desfila solo y sin fin; al pasar el mouse va más rápido.
// Se puede deslizar con el dedo o el touchpad, mover con las flechas del teclado y pausar. ──
const collage = document.querySelector("[data-collage]");
const filaHitos = collage.querySelector("[data-marquee]");
const pausa = document.querySelector("[data-pausa]");
// Una copia de la fila, oculta para lectores de pantalla, hace que el desfile no tenga fin
const originales = [...filaHitos.children];
originales.forEach((li) => {
  const copia = li.cloneNode(true);
  copia.setAttribute("aria-hidden", "true");
  copia.querySelectorAll("img").forEach((img) => { img.alt = ""; });
  copia.querySelectorAll("a, button").forEach((el) => el.setAttribute("tabindex", "-1"));
  filaHitos.append(copia);
});
const VELOCIDAD = 32, VELOCIDAD_ENCIMA = 140; // píxeles por segundo
let pausadoPorPersona = false, encima = false, collageVisible = false, tocando = false;
let posicion = 0, ultimo = 0, soltado = 0;
const mitad = () => filaHitos.children[originales.length].offsetLeft - originales[0].offsetLeft;
function ponerPausa(valor) {
  pausadoPorPersona = valor;
  pausa.setAttribute("aria-pressed", String(valor));
  pausa.textContent = valor ? t("Reanudar", "Resume") : t("Pausar", "Pause");
}
pausa.addEventListener("click", () => ponerPausa(!pausadoPorPersona));
collage.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") encima = true; });
collage.addEventListener("pointerleave", () => { encima = false; });
collage.addEventListener("touchstart", () => { tocando = true; }, { passive: true });
collage.addEventListener("touchend", () => { tocando = false; soltado = performance.now(); }, { passive: true });
collage.addEventListener("keydown", (e) => {
  if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
  e.preventDefault();
  const paso = originales[0].offsetWidth + parseFloat(getComputedStyle(filaHitos).gap || 0);
  collage.scrollBy({ left: e.key === "ArrowRight" ? paso : -paso, behavior: reducir ? "auto" : "smooth" });
});
new IntersectionObserver(([e]) => { collageVisible = e.isIntersecting; }).observe(collage);
function desfilar(t) {
  const dt = ultimo ? Math.min(0.05, (t - ultimo) / 1000) : 0;
  ultimo = t;
  // Si la persona lo movió con el dedo o el touchpad, seguimos desde donde lo dejó
  if (Math.abs(collage.scrollLeft - posicion) > 2) posicion = collage.scrollLeft;
  const quieto = pausadoPorPersona || tocando || t - soltado < 1500 || !collageVisible || document.hidden || collage.matches(":focus-visible, :has(:focus-visible)");
  if (!quieto) {
    posicion += (encima ? VELOCIDAD_ENCIMA : VELOCIDAD) * dt;
    const m = mitad();
    if (m > 0 && posicion >= m) posicion -= m;
    collage.scrollLeft = posicion;
  } else {
    const m = mitad();
    if (m > 0 && collage.scrollLeft >= m) { collage.scrollLeft -= m; }
    posicion = collage.scrollLeft;
  }
  requestAnimationFrame(desfilar);
}
if (reducir) ponerPausa(true);
requestAnimationFrame(desfilar);

// ── Botón magnético (sólo con mouse) ──
if (punteroFino) {
  document.querySelectorAll(".magnetic").forEach((el) => {
    el.addEventListener("pointermove", (e) => {
      if (reducir) return;
      const r = el.getBoundingClientRect();
      el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.2}px, ${(e.clientY - r.top - r.height / 2) * 0.3}px)`;
    });
    el.addEventListener("pointerleave", () => { el.style.transform = ""; });
  });
}

// ── 3D: cada lienzo se monta cuando su sección está cerca ──
const lienzos = [...document.querySelectorAll("canvas[data-3d]")];
let modulo;
const montar = async (canvas) => {
  try {
    modulo ||= import("./landing-3d.js");
    (await modulo).montar(canvas, canvas.dataset["3d"], { reducir, punteroFino });
  } catch (err) {
    canvas.remove();
    console.warn("No se pudo cargar el 3D:", err);
  }
};
const cerca = new IntersectionObserver((entradas) => {
  entradas.forEach((e) => { if (e.isIntersecting) { cerca.unobserve(e.target); montar(e.target); } });
}, { rootMargin: "400px 0px" });
lienzos.forEach((c) => cerca.observe(c));

// ── «Menos movimiento» que responde aunque se cambie con la página abierta ──
prefMovimiento.addEventListener("change", (e) => {
  reducir = e.matches;
  document.documentElement.classList.toggle("reduce", reducir);
  lienzos.forEach((c) => { c.pausado = reducir; });
  ponerPausa(reducir);
  alDesplazar();
});

// ═══ Propuesta «amanecer» ═══

// ── El cielo amanece al bajar: cada sección tiene su color y se mezclan en la frontera ──
const cieloAlba = document.querySelector("[data-cielo-alba]");
const coloresCielo = { inicio: "#03081a", origen: "#0b2142", mision: "#0e2a55", "quienes-somos": "#13366c", capacidades: "#e3ecf8", "alba-vision": "#f4f6fa", "alba-space": "#03081a", reconocidos: "#03081a", contacto: "#050d1c" };
const seccionesCielo = Object.keys(coloresCielo).map((id) => document.getElementById(id)).filter(Boolean);
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
function amanecer() {
  const y = scrollY + innerHeight * 0.55;
  let i = seccionesCielo.findIndex((s) => y >= s.offsetTop && y < s.offsetTop + s.offsetHeight);
  if (i < 0) i = y < seccionesCielo[0].offsetTop ? 0 : seccionesCielo.length - 1;
  const s = seccionesCielo[i];
  const sig = seccionesCielo[Math.min(i + 1, seccionesCielo.length - 1)];
  const zona = Math.min(innerHeight * 0.6, s.offsetHeight * 0.4);
  const f = limitar((y - (s.offsetTop + s.offsetHeight - zona)) / zona);
  const a = hexRgb(coloresCielo[s.id]), b = hexRgb(coloresCielo[sig.id]);
  const c = a.map((v, k) => Math.round(v + (b[k] - v) * f));
  cieloAlba.style.backgroundColor = `rgb(${c.join(",")})`;
  // El menú flotante se aclara cuando pasa sobre una sección de día
  const bajoMenu = seccionesCielo.find((x) => scrollY + 40 >= x.offsetTop && scrollY + 40 < x.offsetTop + x.offsetHeight);
  nav.classList.toggle("claro", !!bajoMenu && bajoMenu.classList.contains("tema-dia"));
}
addEventListener("scroll", () => requestAnimationFrame(amanecer), { passive: true });
addEventListener("resize", amanecer);
amanecer();

// ── El ojo 3D (se carga aparte: si falla, queda el símbolo fijo y la página sigue) ──
let ojo = null;
const ojoListo = import("./ojo.js").then((m) => { ojo = m.montarOjo(); return ojo; }).catch((err) => { console.warn("No se pudo cargar el ojo 3D:", err); return null; });

// ── La presentación de marca: sólo en la primera visita de la sesión ──
// Negro → se abren los ojos sobre el ojo de Alba → aparecen las letras →
// el ojo viaja a su lugar, las letras suben al menú y la página se despliega.
function primeraVisita() {
  try {
    if (sessionStorage.getItem("alba-ojos")) return false;
    sessionStorage.setItem("alba-ojos", "1");
    return true;
  } catch { return true; }
}
function presentarMarca() {
  const raiz = document.documentElement;
  raiz.classList.add("intro");
  const capa = document.createElement("div");
  capa.className = "apertura";
  capa.setAttribute("aria-hidden", "true");
  capa.innerHTML = '<svg><defs><mask id="mascara-ojos"><rect width="100%" height="100%" fill="#fff"/><path fill="#000"/></mask></defs><rect width="100%" height="100%" fill="#000" mask="url(#mascara-ojos)"/></svg><button type="button" class="apertura-saltar">Saltar</button>';
  const letras = document.createElement("img");
  letras.className = "intro-letras";
  letras.src = "assets/alba-vision-letras.webp";
  letras.alt = "";
  letras.setAttribute("aria-hidden", "true");
  document.body.append(capa, letras);
  const almendra = capa.querySelector("path");
  const logoMenu = nav.querySelector(".nav-brand");

  const DURACION = 3800;
  let avance = 0, ultimo = performance.now(), velocidad = 1, terminado = false;
  const hitos = new Set();
  const una = (nombre, fn) => { if (!hitos.has(nombre)) { hitos.add(nombre); fn(); } };
  const suave = (x) => 1 - Math.pow(1 - x, 3);
  const enSuave = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const tramo = (x, a, b) => limitar((x - a) / (b - a));
  ojoListo.then((o) => o?.presentar(1));

  // Dónde empiezan las letras (bajo el ojo) y a dónde vuelan (las letras del logo del menú)
  const PROP = 26 / 353;
  const inicioLetras = () => {
    const movil = innerWidth <= 760;
    const w = Math.min(innerWidth * (movil ? 0.62 : 0.34), 400);
    return { x: (innerWidth - w) / 2, y: innerHeight * (movil ? 0.53 : 0.6), w };
  };
  const destinoLetras = () => {
    const r = logoMenu.querySelector("img").getBoundingClientRect();
    return { x: r.left + 0.2956 * r.width, y: r.top + 0.2899 * r.height, w: (0.996 - 0.2956) * r.width };
  };

  function dibujar(x) {
    const w = innerWidth, h = innerHeight, cx = w / 2, cy = h * (w <= 760 ? 0.36 : 0.4);
    // 1 · Se entreabre, parpadea y se abre sobre el ojo
    let alto = 0.05 * suave(tramo(x, 0.017, 0.084));
    alto -= 0.035 * suave(tramo(x, 0.093, 0.126));
    alto += 0.17 * suave(tramo(x, 0.143, 0.253));
    const ancho = w <= 760 ? 0.44 : 0.24;
    // 2 · La almendra crece hasta cubrir todo y el negro se va
    const crece = 1 + 8 * Math.pow(tramo(x, 0.27, 0.44), 2);
    const aw = w * ancho * crece, ah = h * Math.max(0, alto) * crece;
    almendra.setAttribute("d", `M${cx - aw} ${cy} Q${cx} ${cy - 2 * ah} ${cx + aw} ${cy} Q${cx} ${cy + 2 * ah} ${cx - aw} ${cy} Z`);
    capa.style.opacity = String(1 - tramo(x, 0.35, 0.45));
    if (x > 0.05) una("despierta", () => ojoListo.then((o) => o?.despertar(900)));

    // 3 · Las letras entran bajo el ojo, se quedan un momento y vuelan al menú
    const a = inicioLetras();
    const vuelo = enSuave(tramo(x, 0.71, 0.94));
    let pos = a;
    if (vuelo > 0) {
      const b = destinoLetras();
      pos = { x: a.x + (b.x - a.x) * vuelo, y: a.y + (b.y - a.y) * vuelo, w: a.w + (b.w - a.w) * vuelo };
    }
    const entra = suave(tramo(x, 0.29, 0.41));
    letras.style.width = `${a.w}px`;
    letras.style.height = `${a.w * PROP}px`;
    letras.style.opacity = String(entra);
    letras.style.transform = `translate(${pos.x}px, ${pos.y + (1 - entra) * 14}px) scale(${pos.w / a.w})`;

    // 4 · El ojo viaja a su lugar y la página se despliega desde el logo
    ojoListo.then((o) => o?.presentar(1 - enSuave(tramo(x, 0.71, 0.95))));
    if (x > 0.73) una("despliega", () => raiz.classList.remove("intro"));
    if (x > 0.78) una("portada", mostrarPortada);
  }
  function cuadro(ahora) {
    avance += ((ahora - ultimo) / DURACION) * velocidad;
    ultimo = ahora;
    dibujar(limitar(avance));
    if (avance < 1) requestAnimationFrame(cuadro);
    else terminar();
  }
  function terminar() {
    if (terminado) return;
    terminado = true;
    raiz.classList.remove("intro");
    mostrarPortada();
    ojoListo.then((o) => o?.presentar(0));
    capa.remove();
    letras.remove();
    ["pointerdown", "keydown", "wheel", "touchstart"].forEach((ev) => removeEventListener(ev, apurar));
  }
  function apurar() { velocidad = 6; }
  ["pointerdown", "keydown", "wheel", "touchstart"].forEach((ev) => addEventListener(ev, apurar, { passive: true }));
  capa.querySelector(".apertura-saltar").addEventListener("click", () => { velocidad = 10; });
  dibujar(0);
  requestAnimationFrame(cuadro);
}
if (!reducir && primeraVisita()) presentarMarca();
else requestAnimationFrame(mostrarPortada);
