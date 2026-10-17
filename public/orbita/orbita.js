// Órbita: la conversación de ejemplo se arma conforme se baja, paso por paso.
// En teléfonos bajitos o con «menos movimiento» se vuelve contenido corrido y se ve completa.

const reducir = matchMedia("(prefers-reduced-motion: reduce)").matches;
const celular = matchMedia("(max-width: 760px)");
const seccion = document.querySelector("[data-pasos-chat]");

if (seccion) {
  const botones = [...seccion.querySelectorAll("[data-paso]")];
  const mensajes = [...seccion.querySelectorAll("[data-en]")];
  const corrida = () => reducir || (celular.matches && innerHeight < 700);
  let actual = -1;

  const mostrar = (i) => {
    if (i === actual) return;
    actual = i;
    botones.forEach((b, j) => b.setAttribute("aria-current", j === i ? "true" : "false"));
    mensajes.forEach((m) => m.classList.toggle("visto", Number(m.dataset.en) <= i));
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
