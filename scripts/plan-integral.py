"""Migración inicial del plan integral. Se ejecuta una vez sobre la base R24."""
from pathlib import Path
import re
import shutil

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'

for route in ['index.html', 'visionops/index.html', 'AlbaSpace/index.html', 'AlbaLabs/index.html', 'surfaceops/index.html']:
    path = PUBLIC / route
    html = path.read_text(encoding='utf-8')
    prefix = '' if route == 'index.html' else '../'
    needle = f'<link rel="stylesheet" href="{prefix}ronda24.css?v=20261025c">'
    assert needle in html, route
    html = html.replace(needle, needle + f'\n  <link rel="stylesheet" href="{prefix}ritmo.css?v=20261025a">')
    path.write_text(html, encoding='utf-8')

# Las firmas oficiales se copian sin modificar sus maestros.
kit = ROOT.parent / 'marca/propuestas/2026-10-17-firma-de-familia/kit-final/surface-ops'
dest = PUBLIC / 'assets/marcas/surface-ops'
dest.mkdir(parents=True, exist_ok=True)
for name in ['menu-claro.svg', 'menu-oscuro.svg', 'favicon.svg', 'favicon-32.png', 'favicon-16.png', 'favicon.ico', 'apple-touch-icon-180.png', 'compartir-1200x630.png', 'firma-horizontal-claro.svg', 'firma-horizontal-oscuro.svg']:
    if (kit / name).exists():
        shutil.copy2(kit / name, dest / name)

path = PUBLIC / 'surfaceops/index.html'
html = path.read_text(encoding='utf-8')
old = '<a class="nav-brand nav-brand-texto" href="./" translate="no">Surface Ops</a>'
viewbox = re.search(r'viewBox="([^"]+)"', (dest/'menu-claro.svg').read_text(encoding='utf-8')).group(1).split()
html = html.replace(old, f'''<a class="nav-brand nav-brand-hija" href="./" aria-label="Surface Ops, by Alba Vision">
        <img class="logo-noche" src="../assets/marcas/surface-ops/menu-oscuro.svg" alt="" width="{viewbox[2]}" height="{viewbox[3]}">
        <img class="logo-dia" src="../assets/marcas/surface-ops/menu-claro.svg" alt="" width="{viewbox[2]}" height="{viewbox[3]}">
      </a>''')
html = re.sub(r'<link rel="icon"[^>]+>', '<link rel="icon" type="image/svg+xml" href="../assets/marcas/surface-ops/favicon.svg">', html)
html = re.sub(r'<link rel="apple-touch-icon"[^>]+>', '<link rel="apple-touch-icon" href="../assets/marcas/surface-ops/apple-touch-icon-180.png">', html)
assert old not in html
if 'assets/marcas/menu.css' not in html:
    html = html.replace('</head>', '  <link rel="stylesheet" href="../assets/marcas/menu.css">\n</head>')
path.write_text(html, encoding='utf-8')

# La operación y el despiece se exploran con controles; no consumen varias pantallas vacías.
path = PUBLIC / 'visionops.js'
js = path.read_text(encoding='utf-8')
start = js.index('  // El avance cuenta el tramo en que la escena está fija')
end = js.index('  let etapaActual', start)
js = js[:start] + '''  let elegido = 0;
  const avance = () => elegido;
  const controles = document.createElement("div");
  controles.className = "ritmo-controles";
  controles.setAttribute("role", "group");
  controles.setAttribute("aria-label", t("Explora de video a datos", "Explore video to data"));
  const nombres = [t("El video", "Video"), ...etapas.slice(1).map(e => e.querySelector("b").textContent)];
  const selectores = etapas.map((e, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = nombres[i]; b.setAttribute("aria-pressed", String(i === 0));
    b.addEventListener("click", () => { elegido = (i + .15) / etapas.length; visor?.avanzar(elegido); });
    controles.append(b); return b;
  });
  seccion.querySelector(".vo-texto").append(controles);
''' + js[end:]
js = js.replace('etapas.forEach((e) => e.classList.toggle("activa", e.dataset.etapa === etapa));', '''etapas.forEach((e, i) => {
        const activa = e.dataset.etapa === etapa;
        e.classList.toggle("activa", activa); e.inert = !activa;
        e.setAttribute("aria-hidden", String(!activa)); selectores[i].setAttribute("aria-pressed", String(activa));
      });''')
js = js.replace('if (reducir || innerHeight < 600) { seccion.classList.add("corrida"); return; }', 'if (reducir || matchMedia("(max-width: 760px), (max-height: 699px)").matches) { seccion.classList.add("corrida"); return; }')
# El camino también tiene lectura natural en pantallas pequeñas.
needle = '  const seccion = document.querySelector("[data-camino]");\n  if (!seccion) return;'
js = js.replace(needle, needle + '\n  if (matchMedia("(max-width: 760px), (max-height: 699px)").matches) { seccion.classList.add("corrida"); return; }')
path.write_text(js, encoding='utf-8')

path = PUBLIC / 'space.js'
js = path.read_text(encoding='utf-8')
js = js.replace('if (reducir || innerHeight < 600)', 'if (reducir || matchMedia("(max-width: 760px), (max-height: 699px)").matches)')
js = js.replace('const PESOS = [0.3, 0.45, 0.9, 0.45, 0.7, 0.45, 0.8];', 'const PESOS = [0.18, 0.18, 0.45, 0.18, 0.4, 0.18, 0.4];')
js = js.replace('const guiada = !!seccion && !reducir && innerHeight >= 600;', 'const guiada = !!seccion && !reducir && !matchMedia("(max-width: 760px), (max-height: 699px)").matches;')
start = js.index('  const avance = () => {', js.index('(function porDentro()'))
end = js.index('  let actual', start)
js = js[:start] + '''  let elegido = 0;
  const avance = () => elegido;
  const controles = document.createElement("div");
  controles.className = "ritmo-controles"; controles.setAttribute("role", "group");
  controles.setAttribute("aria-label", document.documentElement.lang === "en" ? "Explore the instrument" : "Explora el instrumento");
  const selectores = pasos.map((li, i) => {
    const b = document.createElement("button"); b.type = "button"; b.textContent = li.querySelector("b").textContent;
    b.setAttribute("aria-pressed", String(i === 0)); controles.append(b);
    b.addEventListener("click", () => { elegido = (i + .3) / pasos.length; visor?.avanzar(elegido); });
    return b;
  });
  seccion.querySelector(".st-texto").append(controles);
''' + js[end:]
js = js.replace('pasos.forEach((li) => li.classList.toggle("activa", li.dataset.paso === paso));', '''pasos.forEach((li, i) => {
      const activa = li.dataset.paso === paso; li.classList.toggle("activa", activa);
      li.inert = !activa; li.setAttribute("aria-hidden", String(!activa)); selectores[i].setAttribute("aria-pressed", String(activa));
    });''')
path.write_text(js, encoding='utf-8')
