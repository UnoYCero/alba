"""Saca los textos visibles de las páginas en español a textos-es.json (ver LEEME.md)."""
import io, json, os, re
from html.parser import HTMLParser

AQUI = os.path.dirname(os.path.abspath(__file__))
PUBLICO = os.path.join(AQUI, "..", "..", "public")
PAGINAS = ["index.html", "Unblind/index.html", "AlbaSpace/index.html", "visionops/index.html", "AlbaLabs/index.html", "orbita/index.html"]
ATRS = {"alt", "aria-label", "title", "content", "placeholder", "data-label"}
# El botón de idioma que agrega generar_en.py no se traduce
OMITIR = {"EN", "English version"}


class Saca(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.textos, self.pila = [], []

    def handle_starttag(self, tag, attrs):
        self.pila.append(tag)
        for k, v in attrs:
            if v and k in ATRS and re.search(r"[A-Za-zÁÉÍÓÚáéíóúñÑ]{2}", v) and not v.startswith(("http", "width=", "#")):
                if k == "content" and dict(attrs).get("name") in ("viewport", "theme-color", "twitter:card"):
                    continue
                if k == "content" and dict(attrs).get("property") in ("og:type", "og:locale", "og:site_name", "og:url", "og:image", "og:image:width", "og:image:height"):
                    continue
                self.textos.append(v)

    def handle_endtag(self, tag):
        if self.pila:
            self.pila.pop()

    def handle_data(self, d):
        if self.pila and self.pila[-1] in ("script", "style"):
            return
        t = " ".join(d.split())
        if re.search(r"[A-Za-zÁÉÍÓÚáéíóúñÑ¿¡]{2}", t):
            self.textos.append(t)


def textos(ruta):
    s = Saca()
    s.feed(io.open(ruta, encoding="utf-8").read())
    return list(dict.fromkeys(t for t in s.textos if t not in OMITIR))


if __name__ == "__main__":
    todo = {}
    for p in PAGINAS:
        todo[p] = textos(os.path.join(PUBLICO, p))
        print(p, len(todo[p]))
    io.open(os.path.join(AQUI, "textos-es.json"), "w", encoding="utf-8").write(json.dumps(todo, ensure_ascii=False, indent=1))
