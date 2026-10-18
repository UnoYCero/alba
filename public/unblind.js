// UNBLIND: la demo de audio 3D y la calle contada de cinco maneras.

const reducir = matchMedia("(prefers-reduced-motion: reduce)").matches;
// La misma página sirve en español y en inglés (public/en/): el idioma sale de <html lang>.
const EN = document.documentElement.lang === "en";
const t = (es, en) => (EN ? en : es);

// ── La demo de audio 3D: un botón que reproduce y pausa, con su avance ──
(function demoAudio() {
  const audio = document.getElementById("audioDemo");
  const boton = document.getElementById("botonAudio");
  const avance = document.getElementById("avanceAudio");
  if (!audio || !boton) return;
  const texto = boton.querySelector("span");
  const poner = (sonando) => {
    boton.setAttribute("aria-pressed", String(sonando));
    texto.textContent = sonando ? t("Pausar la demo", "Pause the demo") : (audio.currentTime > 0 && !audio.ended ? t("Seguir escuchando", "Keep listening") : t("Escuchar la demo", "Play the demo"));
  };
  boton.addEventListener("click", () => {
    if (audio.paused) audio.play().catch(() => { texto.textContent = t("No se pudo reproducir", "Could not play"); });
    else audio.pause();
  });
  audio.addEventListener("play", () => poner(true));
  audio.addEventListener("pause", () => poner(false));
  audio.addEventListener("ended", () => { audio.currentTime = 0; poner(false); });
  audio.addEventListener("timeupdate", () => {
    if (audio.duration) avance.style.transform = `scaleX(${audio.currentTime / audio.duration})`;
  });
})();

// ── Lo que hace: cada función enciende su capa sobre la misma foto ──
(function escenas() {
  const botones = [...document.querySelectorAll("[data-funcion]")];
  const capas = [...document.querySelectorAll(".ub-escena [data-capa]")];
  const escena = document.querySelector(".ub-escena");
  if (!botones.length || !capas.length) return;
  let actual = 0, tocado = false, visible = false;
  const mostrar = (i) => {
    actual = i;
    botones.forEach((b, j) => b.setAttribute("aria-current", j === i ? "true" : "false"));
    capas.forEach((c, j) => c.classList.toggle("activa", j === i));
  };
  botones.forEach((b, j) => b.addEventListener("click", () => { tocado = true; mostrar(j); }));
  mostrar(0);
  if (reducir) return;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.3 }).observe(escena);
  setInterval(() => {
    if (visible && !tocado && !document.hidden) mostrar((actual + 1) % botones.length);
  }, 4200);
})();
