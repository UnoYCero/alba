// Alba Labs: «Ve. Recuerda. Actúa.» como una pantalla fija que cambia al bajar.
// En teléfonos bajitos o con «menos movimiento» se vuelve contenido corrido y los pasos se tocan.

const reducir = matchMedia("(prefers-reduced-motion: reduce)").matches;
const celular = matchMedia("(max-width: 760px)");
const seccion = document.querySelector("[data-tiempos]");

if (seccion) {
  const botones = [...seccion.querySelectorAll("[data-tiempo]")];
  const capas = [...seccion.querySelectorAll("[data-capa]")];
  const corrida = () => reducir || (celular.matches && innerHeight < 700);
  let actual = -1;

  const mostrar = (i) => {
    if (i === actual) return;
    actual = i;
    botones.forEach((b, j) => b.setAttribute("aria-current", j === i ? "true" : "false"));
    capas.forEach((c, j) => c.classList.toggle("activa", j === i));
  };

  const alBajar = () => {
    seccion.classList.toggle("corrida", corrida());
    if (corrida()) return;
    const r = seccion.getBoundingClientRect();
    const avance = Math.min(1, Math.max(0, -r.top / (r.height - innerHeight)));
    mostrar(Math.min(botones.length - 1, Math.floor(avance * botones.length)));
  };

  botones.forEach((b, j) => b.addEventListener("click", () => {
    if (corrida()) { mostrar(j); return; }
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
  mostrar(0);
  alBajar();
}
