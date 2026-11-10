"""Comprueba los diez HTML finales y las fronteras de protección contra la base."""
from html.parser import HTMLParser
from pathlib import Path
import json
import subprocess
from urllib.parse import urlsplit,unquote

root=Path(__file__).resolve().parents[2]
publico=root/'public'
rutas=['index.html','visionops/index.html','AlbaSpace/index.html','AlbaLabs/index.html','surfaceops/index.html',
       'en/index.html','en/visionops/index.html','en/albaspace/index.html','en/albalabs/index.html','en/surfaceops/index.html']
archivos={p.relative_to(publico).as_posix().lower() for p in publico.rglob('*') if p.is_file()}
errores=[]; resultados=[]
class Pagina(HTMLParser):
    def __init__(self): super().__init__();self.ids=[];self.h1=0;self.recursos=[]
    def handle_starttag(self,tag,atributos):
        a=dict(atributos)
        if tag=='h1': self.h1+=1
        if a.get('id'): self.ids.append(a['id'])
        if tag in ['img','script','source'] and a.get('src'): self.recursos.append(a['src'])
        if tag=='link' and a.get('rel') in ['stylesheet','icon','apple-touch-icon']: self.recursos.append(a['href'])
        if tag=='source' and a.get('srcset'): self.recursos += [x.strip().split()[0] for x in a['srcset'].split(',')]
for ruta in rutas:
    p=publico/ruta; pagina=Pagina();pagina.feed(p.read_text(encoding='utf-8'))
    if pagina.h1!=1: errores.append(f'{ruta}: {pagina.h1} titulares h1')
    if len(pagina.ids)!=len(set(pagina.ids)): errores.append(f'{ruta}: identificador duplicado')
    for src in pagina.recursos:
        url=urlsplit(src)
        if url.scheme or src.startswith('//'): continue
        recurso=(publico/unquote(url.path).lstrip('/')) if url.path.startswith('/') else p.parent/unquote(url.path)
        relativo=recurso.resolve().relative_to(publico.resolve()).as_posix().lower()
        if relativo not in archivos: errores.append(f'{ruta}: recurso inexistente {src}')
    resultados.append({'ruta':ruta,'h1':pagina.h1,'ids':len(pagina.ids),'recursos':len(pagina.recursos)})
protegidos=['public/Unblind','public/en/unblind','public/orbita','public/en/orbita','public/subpagina.css','public/subpagina.js','public/landing.css','public/amanecer.css']
diff=subprocess.check_output(['git','diff','--name-only','87e8c10','--',*protegidos],cwd=root,text=True).strip()
if diff: errores.append('Se modificaron recursos protegidos: '+diff)
informe={'paginas':resultados,'frontera_protegida':protegidos,'errores':errores}
(root/'docs/plan-integral/archivos.json').write_text(json.dumps(informe,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(informe,ensure_ascii=False,indent=2))
raise SystemExit(bool(errores))
