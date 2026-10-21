"""Arma la versión en inglés de albavision.tech en public/en/ a partir de las páginas en español.

Las páginas en español son la fuente: si cambian, se vuelve a correr este script.
Traduce sólo nodos de texto completos y atributos (alt, aria-label, title, content,
placeholder), según textos_en.py, que está alineado con lo que saca extraer.py.
"""
import io, json, os, posixpath, re, sys, urllib.parse as up

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
from textos_en import EN

PUBLICO = os.path.join(AQUI, "..", "..", "public")
ES = json.load(open(os.path.join(AQUI, "textos-es.json"), encoding="utf-8"))
SITIO = "https://albavision.tech/"

# página en español → (ruta del archivo en inglés, dirección pública en español, en inglés)
PAGINAS = {
    "index.html": ("en/index.html", "", "en/"),
    "Unblind/index.html": ("en/unblind/index.html", "unblind/", "en/unblind/"),
    "AlbaSpace/index.html": ("en/albaspace/index.html", "albaspace/", "en/albaspace/"),
    "AlbaLabs/index.html": ("en/albalabs/index.html", "albalabs/", "en/albalabs/"),
    "orbita/index.html": ("en/orbita/index.html", "orbita/index.html", "en/orbita/"),
}

WA = {
    "Hola, vengo de albavision.tech y me gustaría colaborar con Alba Labs.": "Hi, I'm coming from albavision.tech and I'd like to collaborate with Alba Labs.",
    "Hola, vengo de albavision.tech y me gustaría platicar.": "Hi, I'm coming from albavision.tech and I'd like to talk.",
    "Hola, vengo de albavision.tech y me interesa UNBLIND.": "Hi, I'm coming from albavision.tech and I'm interested in UNBLIND.",
    "Hola, vengo de albavision.tech y me interesa Vision Ops para mi negocio.": "Hi, I'm coming from albavision.tech and I'm interested in Vision Ops for my business.",
    "Hola, vengo de albavision.tech y me interesa el Vision Core de Alba Labs.": "Hi, I'm coming from albavision.tech and I'm interested in the Alba Labs Vision Core.",
    "Hola, vengo de albavision.tech y me interesa un piloto de lentes para mi empresa.": "Hi, I'm coming from albavision.tech and I'm interested in a glasses pilot for my company.",
    "Hola, vengo de albavision.tech y me interesa una prueba de Surface Ops para medir baches.": "Hi, I'm coming from albavision.tech and I'm interested in a Surface Ops trial to measure potholes.",
    "Hola, vengo de albavision.tech y me interesa Órbita para mi negocio.": "Hi, I'm coming from albavision.tech and I'm interested in Órbita for my business.",
    "Hola, vengo de albavision.tech y quiero comprar el Dev Kit de Alba Labs.": "Hi, I'm coming from albavision.tech and I want to buy the Alba Labs Dev Kit.",
    "Hola, vengo de albavision.tech y quiero platicar de una misión con Alba Space.": "Hi, I'm coming from albavision.tech and I want to talk about a mission with Alba Space.",
    "Hola, vengo de albavision.tech y quiero que me avisen cuando esté el Alba Rover.": "Hi, I'm coming from albavision.tech and I'd like to know when the Alba Rover is ready.",
    "Hola, vengo de albavision.tech y quiero que me avisen cuando esté el módulo de cámara Edge.": "Hi, I'm coming from albavision.tech and I'd like to know when the Edge camera module is ready.",
    "Hola, vengo de albavision.tech y tengo preguntas sobre el Dev Kit de Alba Labs.": "Hi, I'm coming from albavision.tech and I have questions about the Alba Labs Dev Kit.",
    "Hola, vengo de albavision.tech y tengo un reto que quizá se resuelva con visión.": "Hi, I'm coming from albavision.tech and I have a challenge that vision might solve.",
    "Hola, vengo de albavision.tech.": "Hi, I'm coming from albavision.tech.",
}

EXT = (".css", ".js", ".png", ".jpg", ".jpeg", ".webp", ".svg", ".mp3", ".mp4", ".webm", ".ico", ".json", ".woff2", ".pdf")


def es_activo(url):
    limpio = url.split("#")[0].split("?")[0]
    return limpio.startswith(("assets/", "../assets/")) or limpio.lower().endswith(EXT)


def raiz(url, carpeta):
    """Convierte la ruta de un archivo (imagen, hoja, script) en ruta desde la raíz del sitio."""
    return "/" + posixpath.normpath(posixpath.join(carpeta, url)).lstrip("./")


def selector(html, a_href, lang_otro, texto_corto, texto_largo):
    """Agrega el cambio de idioma al menú flotante y al menú del celular."""
    corto = f'<a class="nav-idioma" href="{a_href}" hreflang="{lang_otro}" lang="{lang_otro}" aria-label="{texto_largo}">{texto_corto}</a>'
    largo = f'<a href="{a_href}" hreflang="{lang_otro}" lang="{lang_otro}">{texto_largo}</a>'
    html, n = re.subn(r'(\s*)(<button class="nav-toggle")', lambda m: f"{m.group(1)}{corto}{m.group(1)}{m.group(2)}", html, count=1)
    assert n == 1, "no encontré el botón del menú"
    html, n = re.subn(r'(<div class="nav-panel"[^>]*>)', lambda m: m.group(1) + "\n      " + largo, html, count=1)
    assert n == 1, "no encontré el menú del celular"
    return html


def alternos(html, es_url, en_url):
    bloque = (f'\n  <link rel="alternate" hreflang="es" href="{es_url}">'
              f'\n  <link rel="alternate" hreflang="en" href="{en_url}">'
              f'\n  <link rel="alternate" hreflang="x-default" href="{es_url}">')
    html, n = re.subn(r'(<link rel="canonical" href="[^"]+">)', lambda m: m.group(1) + bloque, html, count=1)
    assert n == 1
    return html


def traducir(origen, destino, es_pub, en_pub):
    html = io.open(os.path.join(PUBLICO, origen), encoding="utf-8").read()
    # Si la página en español ya trae el cambio de idioma, se quita antes de traducir
    html = re.sub(r'\s*<a class="nav-idioma"[^>]*>EN</a>', "", html)
    html = re.sub(r'\n\s*<a href="/en/[^"]*" hreflang="en" lang="en">English version</a>', "", html)
    html = re.sub(r'\n  <link rel="alternate" hreflang="[^"]+" href="[^"]+">', "", html)
    es_txt, en_txt = ES[origen], EN[origen]
    assert len(es_txt) == len(en_txt), f"{origen}: {len(es_txt)} en español contra {len(en_txt)} en inglés"
    faltan = []
    for es, en in sorted(zip(es_txt, en_txt), key=lambda p: -len(p[0])):
        if es == en:
            continue
        patron = re.escape(es).replace(r"\ ", r"\s+")
        html, n1 = re.subn(r"(>\s*)" + patron + r"(\s*<)", lambda m: m.group(1) + en + m.group(2), html)
        html, n2 = re.subn(r'(\s(?:alt|aria-label|title|content|placeholder)=")' + patron + '(")', lambda m: m.group(1) + en.replace('"', "&quot;") + m.group(2), html)
        if n1 + n2 == 0:
            faltan.append(es)
    # Conectores sueltos entre enlaces que no son texto completo
    html = html.replace("</a> y <a", "</a> and <a")

    carpeta_es = posixpath.dirname(origen)
    html = re.sub(r'(\s(?:src|href)=")([^"]+)(")',
                  lambda m: m.group(1) + (raiz(m.group(2), carpeta_es) if not re.match(r"^(https?:|#|mailto:|tel:|data:|/)", m.group(2)) and es_activo(m.group(2)) else m.group(2)) + m.group(3), html)
    # Páginas legales de Órbita: sólo existen en español
    html = html.replace('href="privacy.html"', 'href="/orbita/privacy.html" hreflang="es"').replace('href="data-deletion.html"', 'href="/orbita/data-deletion.html" hreflang="es"')
    # El aviso de privacidad de Alba también sólo existe en español
    html = html.replace('href="/privacidad/"', 'href="/privacidad/" hreflang="es"')
    html = html.replace('href="index.html"', 'href="./"').replace('href="index.html#', 'href="./#')
    # La firma de cada hija vuelve a su página conservando el idioma elegido.
    html = re.sub(r'(<a class="nav-brand nav-brand-hija" href=")[^"]+',
                  lambda m: m.group(1) + "/" + en_pub, html, count=1)
    # Vision Ops en inglés
    html = html.replace('href="https://ops.albavision.tech"', 'href="https://ops.albavision.tech/en"')
    # Mensajes de WhatsApp en inglés
    def wa(m):
        texto = up.unquote(m.group(1))
        assert texto in WA, f"falta traducir el mensaje de WhatsApp: {texto}"
        return "wa.me/525616908570?text=" + up.quote(WA[texto], safe="")
    html = re.sub(r'wa\.me/525616908570\?text=([^"]+)', wa, html)

    html = html.replace('<html lang="es">', '<html lang="en">', 1)
    html = html.replace('content="es_MX"', 'content="en_US"')
    html = html.replace(f'<link rel="canonical" href="{SITIO}{es_pub}">', f'<link rel="canonical" href="{SITIO}{en_pub}">')
    html = html.replace(f'<meta property="og:url" content="{SITIO}{es_pub}">', f'<meta property="og:url" content="{SITIO}{en_pub}">')
    html = alternos(html, SITIO + es_pub, SITIO + en_pub)
    html = selector(html, "/" + (es_pub if es_pub != "orbita/index.html" else "orbita/"), "es", "ES", "Versión en español")

    ruta = os.path.join(PUBLICO, destino)
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    io.open(ruta, "w", encoding="utf-8", newline="\n").write(html)
    return faltan


def preparar_espanol(origen, es_pub, en_pub):
    """En la página en español: los alternos de idioma y el botón EN (una sola vez)."""
    ruta = os.path.join(PUBLICO, origen)
    html = io.open(ruta, encoding="utf-8").read()
    if 'hreflang="en"' in html:
        return
    html = alternos(html, SITIO + es_pub, SITIO + en_pub)
    html = selector(html, "/" + en_pub, "en", "EN", "English version")
    io.open(ruta, "w", encoding="utf-8", newline="").write(html)


if __name__ == "__main__":
    for origen, (destino, es_pub, en_pub) in PAGINAS.items():
        faltan = traducir(origen, destino, es_pub, en_pub)
        print(destino, "· sin colocar:", faltan if faltan else "ninguno")
    for origen, (destino, es_pub, en_pub) in PAGINAS.items():
        preparar_espanol(origen, es_pub, en_pub)
    print("español con alternos y botón EN")
