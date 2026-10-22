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
  // Con «menos movimiento» se lee completo desde el principio
  if (reducir) {
    palabras.forEach((w) => w.classList.add("on"));
    origen.classList.add("fin");
    return;
  }
  // En celular el origen no es pantalla fija: las palabras se encienden mientras el párrafo
  // sube por la pantalla (del 85 % al 35 % del alto)
  let p;
  if (celular.matches) {
    const r = scrub.getBoundingClientRect();
    p = limitar((innerHeight * 0.85 - r.top) / (innerHeight * 0.5 + r.height)) * 0.5;
  } else p = avanceFijo(origen);
  const hasta = Math.round(limitar(p / 0.5) * palabras.length);
  palabras.forEach((w, i) => w.classList.toggle("on", i < hasta));
  origen.classList.toggle("fin", p > 0.35);
}

// ── Misión y visión: «lo que Alba va encontrando». Se ve la foto normal; luego aparecen, uno a
// uno, los recuadros de lo que Alba reconoce y al final la frase que diría UNBLIND. Se repite
// mientras está a la vista. Dos botones dejan fija una de las dos vistas. Con «menos
// movimiento» se queda en la vista de Alba, completa y quieta. ──
const masAlla = document.querySelector("[data-cortina]");
if (masAlla) {
  const marco = masAlla.querySelector(".cortina");
  const textos = [...masAlla.querySelectorAll("[data-mv]")];
  const botones = [...masAlla.querySelectorAll("button[data-vista]")];
  let fija = null, aLaVista = false, espera = 0;
  const ponerVista = (v) => {
    marco.dataset.vista = v;
    botones.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.vista === v)));
    textos.forEach((t, i) => t.classList.toggle("activa", i === (v === "ves" ? 0 : 1)));
  };
  // «Lo que ves» 3 s; «lo que ve Alba» 7 s (los recuadros tardan ~2.5 s en aparecer todos)
  const seguir = () => {
    if (fija || !aLaVista || reducir) return;
    const v = marco.dataset.vista === "alba" ? "ves" : "alba";
    ponerVista(v);
    espera = setTimeout(seguir, v === "alba" ? 7000 : 3000);
  };
  botones.forEach((b) => b.addEventListener("click", () => { fija = b.dataset.vista; clearTimeout(espera); ponerVista(fija); }));
  new IntersectionObserver(([e]) => {
    aLaVista = e.isIntersecting;
    clearTimeout(espera);
    if (aLaVista && !fija && !reducir) espera = setTimeout(seguir, 1200);
  }, { threshold: 0.5 }).observe(marco);
  ponerVista(reducir ? "alba" : "ves");
}

// ── Alba Vision: los proyectos como lista; el que se toca (o se señala sobre su nombre) se abre
// y su imagen aparece en el visor ──
const proyectos = [...document.querySelectorAll("[data-proyecto]")];
const visuales = [...document.querySelectorAll("[data-visual]")];
const textoVisor = document.querySelector("[data-visor-texto]");
const escritorio = matchMedia("(min-width: 1081px)");
// En escritorio la descripción va junto a la imagen, así la lista no cambia de alto bajo el cursor
function abrirProyecto(i) {
  // (En celular el visor no se usa y la imagen vive dentro del detalle: no se copia)
  const acordeon = document.querySelector(".proyectos")?.classList.contains("acordeon");
  if (textoVisor) textoVisor.innerHTML = acordeon ? "" : proyectos[i].querySelector(".proyecto-detalle > div").innerHTML;
  proyectos.forEach((p, j) => {
    p.classList.toggle("activo", j === i);
    p.querySelector(".proyecto-nombre").setAttribute("aria-expanded", String(j === i));
  });
  visuales.forEach((v, j) => v.classList.toggle("activa", j === i));
}
const seccionProyectos = document.querySelector(".proyectos");
const visorImagenes = document.querySelector(".visor-imagenes");
proyectos.forEach((p, j) => {
  const nombre = p.querySelector(".proyecto-nombre");
  nombre.addEventListener("click", () => {
    if (!enAcordeon()) return abrirProyecto(j);
    const yaAbierto = p.classList.contains("activo");
    abrirProyecto(j);
    // Si se cerró uno que estaba arriba, la lista se recorre: al terminar, el abierto queda a la vista
    if (!yaAbierto) setTimeout(() => {
      const r = nombre.getBoundingClientRect();
      if (r.top < 90 || r.top > innerHeight * 0.6) nombre.scrollIntoView({ behavior: reducir ? "auto" : "smooth", block: "start" });
    }, 640);
  });
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

// En celular los proyectos son una lista que se despliega: cada renglón lleva una miniatura,
// su nombre y su estado; al tocarlo se abre y adentro aparece su imagen (en el mismo marco
// para todos), su descripción y sus enlaces. Uno abierto a la vez. Al volver a una pantalla
// ancha, las imágenes regresan al visor y las miniaturas se quitan.
const MINI_COCINA = '<svg viewBox="0 0 48 48"><path d="M24 9 43 22 24 35 5 22Z" fill="#fff" stroke="#c9d6ea"/><path d="M15 17l6 4-6 4-6-4Z" fill="#2563eb" opacity=".55"/><path d="M27 19l8 5-5 3-8-5Z" fill="#2563eb" opacity=".8"/><path d="M20 26l6 4-4 3-6-4Z" fill="#2563eb" opacity=".35"/></svg>';
const MINI_CHAT = '<svg viewBox="0 0 48 48"><rect x="15" y="6" width="18" height="36" rx="4" fill="#fff" stroke="#1b3152" stroke-width="2"/><rect x="22" y="14" width="9" height="5" rx="2.5" fill="#0b1f3b"/><rect x="17" y="21" width="10" height="5" rx="2.5" fill="#cfdcf5"/><rect x="21" y="28" width="10" height="5" rx="2.5" fill="#0b1f3b"/></svg>';
function miniatura(v) {
  const m = document.createElement("span");
  m.className = "miniatura";
  m.setAttribute("aria-hidden", "true");
  const img = v.querySelector("img");
  if (img) m.innerHTML = `<img src="${img.getAttribute("src")}" alt="" loading="lazy" decoding="async">`;
  else m.innerHTML = v.querySelector(".chat") ? MINI_CHAT : MINI_COCINA;
  return m;
}
const enAcordeon = () => seccionProyectos.classList.contains("acordeon");
function modoAcordeon() {
  const acordeon = celular.matches;
  if (acordeon === enAcordeon()) return;
  seccionProyectos.classList.toggle("acordeon", acordeon);
  visuales.forEach((v, j) => {
    const nombre = proyectos[j].querySelector(".proyecto-nombre");
    if (acordeon) {
      v.setAttribute("aria-hidden", "true");
      proyectos[j].querySelector(".proyecto-detalle > div").prepend(v);
      nombre.prepend(miniatura(v));
    } else {
      v.removeAttribute("aria-hidden");
      visorImagenes.append(v);
      nombre.querySelector(".miniatura")?.remove();
    }
  });
  abrirProyecto(0);
}
modoAcordeon();
celular.addEventListener("change", () => { modoAcordeon(); encender(); });

// ── Lo que hacemos, en celular: una sola imagen grande que cambia sola cada 5 s, con cuatro
// botones debajo (Ver · Detectar · Medir · Orientarse). Tocar uno la deja fija. En escritorio
// los botones no se ven y las cuatro tarjetas siguen en fila. ──
const capsGrid = document.querySelector(".caps-grid");
if (capsGrid) {
  const caps = [...capsGrid.children];
  const barra = document.createElement("div");
  barra.className = "caps-botones";
  barra.setAttribute("role", "group");
  barra.setAttribute("aria-label", t("Elige qué capacidad ver", "Choose which capability to see"));
  let actual = 0, elegida = false, aLaVista = false;
  const mostrarCap = (i) => {
    actual = i;
    caps.forEach((c, j) => c.classList.toggle("cap-activa", j === i));
    [...barra.children].forEach((b, j) => b.setAttribute("aria-pressed", String(j === i)));
    // Los botones van justo debajo de la imagen de la capacidad elegida
    caps[i].querySelector(".viz")?.after(barra);
  };
  caps.forEach((c, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = c.querySelector("h3").textContent.trim().split(/\s+/)[0];
    b.addEventListener("click", () => { elegida = true; mostrarCap(i); b.focus(); });
    barra.append(b);
  });
  mostrarCap(0);
  new IntersectionObserver(([e]) => { aLaVista = e.isIntersecting; }, { threshold: 0.4 }).observe(capsGrid);
  setInterval(() => {
    if (!celular.matches || reducir || elegida || !aLaVista || document.hidden) return;
    mostrarCap((actual + 1) % caps.length);
  }, 5000);
}

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
// El amanecer: un solo fondo continuo pintado a lo largo de la página (no fijo a la pantalla).
// Cada sección tiene su color y el paso entre una y otra es un degradado suave, sin líneas:
// entre dos oscuras (o dos claras) es largo y va centrado en el borde; entre oscura y clara va
// dentro del margen final de la primera, para que ningún texto quede sobre el color de otra.
// El orden de las llaves es el orden de la página; «pie» es el pie de página.
const coloresCielo = { inicio: "#03081a", origen: "#02050e", mision: "#0e2a55", "quienes-somos": "#13366c", capacidades: "#e3ecf8", "alba-vision": "#f4f6fa", "alba-space": "#03081a", contacto: "#050d1c", pie: "#03081a" };
const seccionesCielo = Object.keys(coloresCielo).map((id) => (id === "pie" ? document.querySelector(".footer") : document.getElementById(id))).filter(Boolean);
const idDe = (s) => (s.classList.contains("footer") ? "pie" : s.id);
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const luz = (c) => (c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11) / 255;
document.body.classList.add("portada-continua");
cieloAlba.classList.add("cielo-pagina");
function pintarCielo() {
  const alto = document.documentElement.scrollHeight;
  const paradas = [];
  const parada = (c, y) => paradas.push(`rgb(${c.join(",")}) ${Math.round(y)}px`);
  seccionesCielo.forEach((s, i) => {
    const a = hexRgb(coloresCielo[idDe(s)]);
    if (i === 0) parada(a, 0);
    const sig = seccionesCielo[i + 1];
    if (!sig) return parada(a, alto);
    const b = hexRgb(coloresCielo[idDe(sig)]);
    const borde = sig.getBoundingClientRect().top + scrollY;
    const cambiaTema = (luz(a) > 0.5) !== (luz(b) > 0.5);
    const largo = cambiaTema ? (celular.matches ? 110 : 120) : Math.min(innerHeight * 0.5, 380);
    const desde = cambiaTema ? borde - largo : borde - largo / 2;
    // 11 paradas sobre una curva seno: el cambio empieza y termina sin que se note
    for (let k = 0; k <= 10; k++) {
      const t = k / 10, e = (1 - Math.cos(Math.PI * t)) / 2;
      parada(a.map((v, n) => Math.round(v + (b[n] - v) * e)), desde + largo * t);
    }
  });
  cieloAlba.style.height = `${alto}px`;
  cieloAlba.style.background = `linear-gradient(180deg, ${paradas.join(", ")})`;
}
// El menú flotante se aclara cuando pasa sobre una sección de día
function menuSobreElDia() {
  const bajoMenu = seccionesCielo.find((x) => { const r = x.getBoundingClientRect(); return r.top <= 40 && r.bottom > 40; });
  nav.classList.toggle("claro", !!bajoMenu && bajoMenu.classList.contains("tema-dia"));
}
addEventListener("scroll", () => requestAnimationFrame(menuSobreElDia), { passive: true });
// Se vuelve a pintar cuando cambia el alto de la página (imágenes que cargan, un proyecto que se abre, otro tamaño)
let repintar = 0;
new ResizeObserver(() => { cancelAnimationFrame(repintar); repintar = requestAnimationFrame(pintarCielo); }).observe(document.body);
pintarCielo();
menuSobreElDia();

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
