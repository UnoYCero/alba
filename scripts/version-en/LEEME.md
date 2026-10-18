# La versión en inglés de albavision.tech

Las páginas en inglés (`public/en/`) **se generan** a partir de las páginas en
español; no se editan a mano.

- `extraer.py` saca los textos visibles de las páginas en español a `textos-es.json`.
- `textos_en.py` tiene la traducción, en el mismo orden que `textos-es.json`.
- `generar_en.py` arma `public/en/` y agrega a las páginas en español el botón EN y
  los avisos de idioma para buscadores (`hreflang`). Se puede correr varias veces.
- `revisar_en.py` avisa si quedó texto en español en las páginas en inglés.

Cuando cambie un texto en español: corre `extraer.py`, agrega o corrige la línea
correspondiente en `textos_en.py`, corre `generar_en.py` y luego `revisar_en.py`.
`generar_en.py` se niega a seguir si las dos listas no tienen el mismo largo.

Los textos de los scripts (`landing.js`, `space.js`, `orbita/orbita.js`, …) eligen
el idioma con `document.documentElement.lang`. El aviso de privacidad y la página
para eliminar datos de Órbita sólo existen en español.
