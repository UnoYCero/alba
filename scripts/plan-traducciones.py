"""Conserva las traducciones previas y alinea las nuevas con el extractor."""
from pathlib import Path
import json
import re

root=Path(__file__).resolve().parents[1]
p=root/'scripts/version-en'
base=json.loads((root/'docs/plan-integral/traducciones-base.json').read_text(encoding='utf-8'))
es=json.loads((p/'textos-es.json').read_text(encoding='utf-8'))
nuevas={
    'Ver las cotas de ejemplo':'View the example dimensions',
    'Recorrido del contorno desde A, en el orden del plano. Son medidas ilustrativas.':'Follow the outline from A, in the order shown on the plan. These are illustrative measurements.',
    'Un cubo para CubeSats de 3U a 12U: 175 g con el mecanismo y 1.25 W. Elige una pieza para explorar el diseño.':'A cube for 3U to 12U CubeSats: 175 g including the mechanism and 1.25 W. Select a part to explore the design.',
    'Ark Light 1, separado del CubeSat para explorar su diseño':'Ark Light 1, separated from the CubeSat to explore its design',
    'Acercarme al instrumento':'Explore the instrument',
    'Exploración conceptual del diseño óptico.':'Conceptual exploration of the optical design.',
    'Del momento al hallazgo.':'From a moment to a finding.',
    'Esperó 41 segundos y se fue.':'They waited 41 seconds and left.',
    'Ver los 41 segundos':'Watch the 41 seconds',
    'Recorre el momento':'Explore the moment',
    'Preparar mi piloto':'Prepare my pilot',
    'Cerrar formulario':'Close form',
    'Tu operación.':'Your operation.',
    'Tu primera pregunta.':'Your first question.',
    'Elige lo que te gustaría entender. Lo revisaremos juntos antes de definir un piloto.':"Choose what you would like to understand. We will review it together before defining a pilot.",
    'Entre 1 y 50 cámaras. El alcance se confirma en el diagnóstico.':'Between 1 and 50 cameras. We confirm the scope in the assessment.',
    'Revisar mi idea':'Review my idea',
    'Editar mi idea':'Edit my idea',
    'Fragmento ilustrativo del manual elegido como contexto':'Illustrative crop of the manual selected as context',
    'Contexto elegido · Ilustración':'Selected context · Illustration',
    'Surface Ops, by Alba Vision':'Surface Ops, by Alba Vision',
}
en={}
for route,strings in es.items():
    en[route]=[base[route][s] if s in base[route] else (s if re.fullmatch(r'[A-Z](?:–[A-Z])?|[0-9.]+ m',s) else nuevas[s]) for s in strings]
(p/'textos_en.py').write_text('# Traducciones alineadas con extraer.py.\nEN = '+json.dumps(en,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
