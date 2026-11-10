"""Avisa si quedó texto en español en las páginas en inglés (ver LEEME.md)."""
import os, re, sys

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
from extraer import PUBLICO, textos

PAGINAS = ["en/index.html", "en/unblind/index.html", "en/albaspace/index.html", "en/albalabs/index.html", "en/orbita/index.html", "en/visionops/index.html", "en/surfaceops/index.html"]
# Nombres propios con acento que sí van igual en inglés
NOMBRES = ("Anáhuac", "México", "Simón", "Querétaro", "Órbita", "Álvaro Obregón", "Lucía", "Ramírez", "Andrés", "Salinas", "Vasconcelos", "Sankalpa", "Ilumina")
PERMITIDOS = {"Versión en español"}
PALABRAS = re.compile(r"\b(de|la|el|los|las|que|con|para|por|una|del|tu|tus|es|lo|se|más|sin)\b", re.I)

restos = []
for p in PAGINAS:
    for t in textos(os.path.join(PUBLICO, p)):
        limpio = t
        for n in NOMBRES:
            limpio = limpio.replace(n, "")
        if t not in PERMITIDOS and (re.search(r"[áéíóúñ¿¡]", limpio) or len(PALABRAS.findall(limpio)) >= 2):
            restos.append(f"{p} | {t}")
print("\n".join(restos) if restos else "Sin texto en español en las páginas en inglés.")
sys.exit(1 if restos else 0)
