// El audio 3D de UNBLIND, con el motor de Asion (asion-core.js). Mientras no hay voces grabadas,
// cada cosa tiene su propio sonido (persona, perro guía, puerta) y el LiDAR, su «tic». Todo se
// sintetiza aquí, sin archivos. El navegador sólo deja sonar después de que alguien toca algo,
// por eso el motor se crea dentro del toque.
import { AsionCore } from "./asion-core.js";

// Hace falta Web Audio con posiciones por fuente (todos los navegadores de los últimos años)
export const soportado = () => typeof PannerNode !== "undefined" && "positionX" in PannerNode.prototype;

let motor = null;
let actual = null; // la escena que suena; al empezar otra, ésta se calla
const memoria = {};

function abrirMotor() {
  if (!motor) {
    // En iPhone, que suene aunque el teléfono esté en silencio (como un video)
    if (navigator.audioSession) navigator.audioSession.type = "playback";
    motor = new AsionCore();
  }
  motor.init();
  actual?.detener();
  return motor;
}

// ── Los sonidos ──
function buffer(segundos, llenar) {
  const { ctx } = motor;
  const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * segundos), ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = llenar(i / ctx.sampleRate);
  return b;
}
// Una nota de madera, como de marimba: la fundamental y un armónico que se apaga antes
const nota = (t, f, caida) => (t < 0 ? 0 : Math.min(1, t / 0.004) *
  (Math.sin(2 * Math.PI * f * t) * Math.exp(-t / caida) + 0.25 * Math.sin(2 * Math.PI * f * 4 * t) * Math.exp(-t / (caida * 0.25))));
const RECETAS = {
  // Persona: dos notas que suben
  persona: () => buffer(0.9, (t) => 0.5 * (nota(t, 523.25, 0.22) + nota(t - 0.13, 659.25, 0.3))),
  // Perro guía: dos notas cortas, más agudas
  perro: () => buffer(0.6, (t) => 0.45 * (nota(t, 987.77, 0.08) + nota(t - 0.1, 987.77, 0.1))),
  // Puerta: una campana suave (parciales que no son armónicos)
  puerta: () => buffer(1.8, (t) => 0.32 * Math.min(1, t / 0.003) * (Math.sin(2 * Math.PI * 587.33 * t) * Math.exp(-t / 0.6)
    + 0.5 * Math.sin(2 * Math.PI * 1621 * t) * Math.exp(-t / 0.25) + 0.25 * Math.sin(2 * Math.PI * 3172 * t) * Math.exp(-t / 0.1))),
  // LiDAR: un tic seco
  tic: () => buffer(0.05, (t) => 0.5 * Math.sin(2 * Math.PI * 2600 * t) * Math.exp(-t * 350) + 0.3 * (Math.random() * 2 - 1) * Math.exp(-t * 1400)),
  // Pasos: dos pisadas, el golpe grave y el roce de la suela (como los pasos de Asion, más suaves)
  pasos: () => {
    let roce = 0;
    return buffer(1.1, (t) => {
      const p = t < 0.55 ? t : t - 0.55;
      roce += 0.2 * ((Math.random() * 2 - 1) - roce);
      return 0.55 * Math.sin(2 * Math.PI * 85 * p) * Math.exp(-p * 28) + 0.9 * roce * Math.exp(-p * 40);
    });
  },
};
const sonido = (nombre) => (memoria[nombre] ||= RECETAS[nombre]());

// Dónde suena: ángulo en grados (positivo, a la derecha), distancia y altura en metros
export const en = (angulo, distancia, alto = 0) => {
  const r = (angulo * Math.PI) / 180;
  return { x: Math.sin(r) * distancia, y: alto, z: -Math.cos(r) * distancia };
};

// Una escena: sus fuentes y sus relojes, para callarla de golpe
function escena(prefijo) {
  const ids = new Set(), relojes = [];
  let viva = true, cuadro = 0;
  const e = {
    fuente(nombre, son, pos, opciones = {}) {
      const id = prefijo + nombre;
      e.quitar(id);
      motor.addSource(id, sonido(son), { ...pos, ...opciones });
      ids.add(id);
      return id;
    },
    quitar(id) {
      const s = motor.sources.find((f) => f.id === id);
      if (!s) return;
      motor.removeSource(id);
      s.panner.disconnect();
    },
    sonar: (id) => viva && motor.playSound(id),
    mover: (id, pos) => motor.updateSourcePosition(id, pos.x, pos.y, pos.z),
    luego: (seg, fn) => relojes.push(setTimeout(() => viva && fn(), seg * 1000)),
    cada: (seg, fn) => relojes.push(setInterval(() => viva && fn(), seg * 1000)),
    cuadros(fn) { const paso = (ms) => { if (!viva) return; fn(ms); cuadro = requestAnimationFrame(paso); }; cuadro = requestAnimationFrame(paso); },
    detener() {
      if (!viva) return;
      viva = false;
      relojes.forEach((r) => { clearTimeout(r); clearInterval(r); });
      cancelAnimationFrame(cuadro);
      ids.forEach((id) => e.quitar(id));
      if (actual === e) actual = null;
      e.alDetener?.();
    },
  };
  actual = e;
  return e;
}

// ── El cuarto («Escucha dónde están las cosas»): la puerta, una persona que camina y la pared
// cercana, que el LiDAR avisa. Suena hasta que se detiene; quien escucha puede girar la cabeza.
export function cuarto({ alSonar = () => {}, alDetener } = {}) {
  const m = abrirMotor();
  m.setEnvironment("room");
  m.updateListener(0);
  const e = escena("cuarto-");
  e.alDetener = alDetener;
  const puerta = e.fuente("puerta", "puerta", en(-24, 4), { volume: 1.8 });
  const pared = e.fuente("pared", "tic", en(-80, 1.1), { volume: 0.45 });
  const persona = e.fuente("persona", "pasos", en(28, 3), { volume: 1.6, loop: true });
  e.luego(0.3, () => { e.sonar(puerta); alSonar("puerta"); });
  e.cada(2.6, () => { e.sonar(puerta); alSonar("puerta"); });
  // La pared: tres tics seguidos, de vez en cuando
  const tics = () => [0, 0.16, 0.32].forEach((s) => e.luego(s, () => { e.sonar(pared); alSonar("pared"); }));
  e.luego(1.6, tics);
  e.luego(1.6, () => e.cada(3.2, tics));
  // La persona camina de un lado a otro, a la derecha
  e.luego(0.9, () => {
    e.sonar(persona);
    alSonar("persona");
    e.cada(0.55, () => alSonar("persona"));
    const inicio = performance.now();
    e.cuadros((ms) => {
      const ida = ((ms - inicio) / 7000) % 2, s = ida < 1 ? ida : 2 - ida;
      e.mover(persona, en(24 + 12 * s, 3 + 1.4 * s));
    });
  });
  return { girar: (grados) => m.updateListener(grados), detener: e.detener };
}

// ── La calle («Te lo dice»): el LiDAR avisa que algo se acerca de frente y luego cada cosa que
// reconoció suena desde donde está. Dura unos segundos.
// cosas: [{ tipo: "persona" | "perro", angulo, distancia, alto }]
export function calle({ cosas, alSonar = () => {}, alDetener } = {}) {
  const m = abrirMotor();
  m.setEnvironment("studio");
  m.updateListener(0);
  const e = escena("calle-");
  e.alDetener = alDetener;
  const lidar = e.fuente("lidar", "tic", en(0, 4), { volume: 3 });
  [0, 0.45, 0.85, 1.2, 1.5, 1.75, 1.97].forEach((s, i) => e.luego(s, () => {
    e.mover(lidar, en(0, 4 - i * 0.3));
    e.sonar(lidar);
    alSonar("lidar");
  }));
  cosas.forEach((c, i) => {
    const id = e.fuente(`cosa-${i}`, c.tipo, en(c.angulo, c.distancia, c.alto), { volume: 2.2 });
    e.luego(2.6 + i * 0.95, () => { e.sonar(id); alSonar(i); });
  });
  e.luego(2.6 + cosas.length * 0.95 + 0.6, () => { alSonar(null); e.detener(); });
  return { detener: e.detener };
}
