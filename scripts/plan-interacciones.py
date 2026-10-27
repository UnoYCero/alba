"""Construye las piezas acordadas, conservando el contenido y los recursos R24."""
from pathlib import Path
import re

P = Path(__file__).resolve().parents[1] / 'public'

def guardar(ruta, html):
    (P/ruta).write_text(html, encoding='utf-8')

for ruta in ['index.html','visionops/index.html','AlbaSpace/index.html','AlbaLabs/index.html','surfaceops/index.html']:
    html=(P/ruta).read_text(encoding='utf-8')
    prefijo='' if ruta=='index.html' else '../'
    html=html.replace('</head>',f'  <script type="module" src="{prefijo}integral.js?v=20261025a"></script>\n</head>')
    guardar(ruta,html)

ruta='visionops/index.html'
h=(P/ruta).read_text(encoding='utf-8')
a=h.index('      <div class="wrap vo-piloto"');b=h.index('\n    </section>',a)
viejo=h[a:b]
form=re.search(r'(<form.*?</form>)',viejo,re.S).group(1)
resumen=re.search(r'(<div class="vo-piloto-resumen.*)</div>\s*$',viejo,re.S).group(1)
form=form.replace('class="vo-piloto-form reveal"','class="vo-piloto-form" id="piloto-campos"')
form=form.replace('<h3>El piloto empieza <em>con una pregunta.</em></h3>','<p class="piloto-ayuda">Elige lo que te gustaría entender. Lo revisaremos juntos antes de definir un piloto.</p>')
form=form.replace('input type="number"','input required aria-describedby="piloto-limite" type="number"')
form=form.replace('</form>','<p class="piloto-ayuda" id="piloto-limite">Entre 1 y 50 cámaras. El alcance se confirma en el diagnóstico.</p><button class="btn btn-solid" type="submit" data-piloto-resumir>Revisar mi idea</button></form>')
form=form.replace(' onsubmit="return false"','')
resumen=resumen.replace('class="vo-piloto-resumen reveal" aria-live="polite"','class="vo-piloto-resumen" data-piloto-resumen hidden')
resumen=resumen.replace('<a class="btn btn-solid" data-r="enviar"','<button class="btn-text r24-reiniciar" type="button" data-piloto-editar>Editar mi idea</button>\n          <a class="btn btn-solid" data-r="enviar"')
nuevo=f'''      <div class="wrap piloto-entrada">
        <h3>El piloto empieza <em>con una pregunta.</em></h3>
        <button type="button" class="btn btn-solid" data-piloto-abrir aria-haspopup="dialog">Preparar mi piloto</button>
      </div>
      <dialog class="piloto-dialogo" data-piloto aria-labelledby="piloto-titulo">
        <button type="button" class="piloto-cerrar" data-piloto-cerrar aria-label="Cerrar formulario"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
        <h2 id="piloto-titulo">Tu operación.<br><em>Tu primera pregunta.</em></h2>
        {form}
        {resumen}
      </dialog>'''
h=h[:a]+nuevo+h[b:]
# La foto mantiene el mismo encuadre para que las marcas coincidan en los dos tamaños.
h=h.replace('<picture><source media="(max-width: 760px)" srcset="../assets/visionops/paleteria-camara-vertical.webp">','<div class="hallazgo-escena" data-hallazgo>')
h=h.replace('alt="Ilustración de una paletería con personas en la fila y una persona que sale"></picture>', '''alt="Ilustración de una paletería con personas en la fila y una persona que sale">
            <svg class="hallazgo-trazos" viewBox="0 0 1800 1200" aria-hidden="true">
              <path class="hallazgo-zona" d="m720 570 240-230 540 360-230 260Z"/>
              <path class="hallazgo-ruta" d="M950 1000Q760 800 880 650T1470 770" pathLength="1"/>
              <circle class="hallazgo-punto" cx="950" cy="1000" r="19"/>
              <g class="hallazgo-reloj"><rect x="1100" y="85" width="560" height="150" rx="12"/><text x="1140" y="183"><tspan data-hallazgo-segundos>41</tspan> s</text></g>
            </svg>
            <div class="hallazgo-reporte"><p>Del momento al hallazgo.</p><p><em>Esperó 41 segundos y se fue.</em></p></div>
          </div>''')
h=h.replace('<p class="r24-dato">41 <span>segundos de espera</span></p>', '''<div class="hallazgo-control"><button type="button" data-hallazgo-play>Ver los 41 segundos</button><label>Recorre el momento<input type="range" min="0" max="41" value="41" step="1" data-hallazgo-control></label></div>''')
guardar(ruta,h)

# Evitar que un campo vacío genere un mensaje con un número supuesto.
p=P/'visionops.js';s=p.read_text(encoding='utf-8')
s=s.replace('    if (campo("camaras").value !== "" && +campo("camaras").value !== n) campo("camaras").value = String(n);','')
p.write_text(s,encoding='utf-8')

ruta='AlbaSpace/index.html';h=(P/ruta).read_text(encoding='utf-8')
h=h.replace('<figure class="sub-visual r24-space-visual reveal">','<figure class="sub-visual r24-space-visual reveal" data-integracion data-funcion="0">\n          <div class="integracion-escena">')
needle='<figcaption>Concepto · Ilustración de integración; no muestra una misión real</figcaption>'
h=h.replace(needle,'''<div class="integracion-instrumento" hidden>
            <img src="../assets/space/star-tracker-armado.webp" alt="Ark Light 1, separado del CubeSat para explorar su diseño" width="1047" height="1100" loading="lazy">
            <canvas aria-hidden="true"></canvas>
          </div>
          <svg class="integracion-optica" viewBox="0 0 900 600" aria-hidden="true">
            <g class="optica-estrellas"><path d="M110 90 180 180 285 140 385 230 480 100"/><circle cx="110" cy="90" r="5"/><circle cx="180" cy="180" r="7"/><circle cx="285" cy="140" r="5"/><circle cx="385" cy="230" r="6"/><circle cx="480" cy="100" r="5"/></g>
            <g class="optica-movimiento"><path d="M90 220 350 150"/><circle cx="350" cy="150" r="8"/></g>
            <g class="optica-objetivo"><rect x="190" y="100" width="140" height="140"/><path d="M160 170H360M260 70V270"/></g>
          </svg>
          </div>
          <button class="btn-text integracion-abrir" type="button" data-integracion-abrir aria-pressed="false">Acercarme al instrumento</button>
          <p class="integracion-nota">Exploración conceptual del diseño óptico.</p>
          '''+needle)
guardar(ruta,h)

ruta='AlbaLabs/index.html';h=(P/ruta).read_text(encoding='utf-8')
needle='<div class="r24-receta-lectura">'
h=h.replace(needle,'''<div class="r24-receta-lectura">
            <figure class="receta-fragmento" hidden data-receta-fragmento>
              <div><img src="../assets/labs/lo-que-ven-mesa.webp" alt="Fragmento ilustrativo del manual elegido como contexto" width="1200" height="800" loading="lazy"></div>
              <figcaption>Contexto elegido · Ilustración</figcaption>
            </figure>''')
# El recorte siempre parte del mismo archivo que la escena; no puede cambiar el manual.
fuente=re.search(r'class="r24-manual-foto".*?<img src="([^"]+)"',h,re.S).group(1)
h=h.replace('../assets/labs/lo-que-ven-mesa.webp',fuente)
guardar(ruta,h)

# Misma geometría en la foto y el plano; mismas cotas exteriores de ejemplo.
ruta='surfaceops/index.html';h=(P/ruta).read_text(encoding='utf-8')
a=h.index('<div class="surface-plano"');b=h.index('</div>',a)+6
contorno=re.search(r'<path class="surface-contorno" d="([^"]+)"',h).group(1)
h=h[:a]+f'''<div class="surface-plano" aria-hidden="true"><svg viewBox="0 0 1536 1024"><path d="{contorno}"/><rect class="plano-corte" x="195" y="242" width="1130" height="505"/><g class="plano-cotas"><path d="M195 205H1325M195 190V220M1325 190V220M1360 242V747M1345 242H1375M1345 747H1375"/><text x="650" y="175">1.20 m</text><text x="1380" y="500" transform="rotate(90 1380 500)">0.55 m</text></g></svg></div>'''+h[b:]
guardar(ruta,h)
