"""Servidor local de pruebas: respaldo 3D o fuente demorada. No se despliega.

python scripts/plan-integral/servidor-pruebas.py --modo sin-webgl --puerto 8772
python scripts/plan-integral/servidor-pruebas.py --modo fuente-lenta --puerto 8773
"""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
import io
import time

parser=argparse.ArgumentParser()
parser.add_argument('--modo',choices=['sin-webgl','fuente-lenta'],required=True)
parser.add_argument('--puerto',type=int,required=True)
opciones=parser.parse_args()
publico=Path(__file__).resolve().parents[2]/'public'

class Pruebas(SimpleHTTPRequestHandler):
    def send_head(self):
        path=Path(self.translate_path(self.path))
        if path.is_dir(): path=path/'index.html'
        if opciones.modo=='fuente-lenta' and path.suffix=='.woff2': time.sleep(12)
        if opciones.modo=='sin-webgl' and path.suffix=='.html' and path.is_file():
            html=path.read_text(encoding='utf-8').replace('<html lang=', '<html data-webgl="off" lang=',1)
            contenido=html.encode('utf-8')
            self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8')
            self.send_header('Content-Length',str(len(contenido)));self.end_headers()
            return io.BytesIO(contenido)
        return super().send_head()

ThreadingHTTPServer(('127.0.0.1',opciones.puerto),partial(Pruebas,directory=str(publico))).serve_forever()
