// Piezas del plan integral. No se carga en UNBLIND ni en Órbita.
const quieto = matchMedia('(prefers-reduced-motion: reduce)');
const en = document.documentElement.lang === 'en';
const texto = (es, ingles) => en ? ingles : es;

// Si deja de caber una escena, esa visita continúa en lectura natural. No se vuelve
// a fijar a mitad de la lectura al rotar o ampliar la ventana.
const compacto=matchMedia('(max-width: 760px), (max-height: 699px)');
const lecturaNatural=()=>{
  const selectores=quieto.matches ? '.vo-reporte,.vo-crece,.st-galeria,.vo-operacion,.st-dentro' : '.vo-reporte,.vo-crece,.st-galeria';
  if(!compacto.matches && !quieto.matches) return;
  document.querySelectorAll(selectores).forEach(e=>{
    e.classList.add('corrida'); e.style.height='auto';
    e.querySelectorAll('[inert],[data-etapa],[data-paso],[data-panel]').forEach(n=>{n.inert=false;n.removeAttribute('aria-hidden');});
  });
  document.querySelectorAll('.st-baffle.guiada').forEach(e=>{e.classList.remove('guiada');e.style.height='auto';});
};
compacto.addEventListener('change',lecturaNatural); quieto.addEventListener('change',lecturaNatural); lecturaNatural();

// El presupuesto de avance es independiente de la altura visible. Al cambiar un texto,
// crece la composición y su sección por igual: el cociente de avance no se realimenta.
const escenas = [
  ['.vo-reporte:not(.corrida)', '.vo-pin', '.vo-grid', 1.3],
  ['.vo-crece:not(.corrida)', '.vo-pin', '.vo-grid', .9],
  ['.st-galeria:not(.corrida)', '.st-galeria-pin', '.st-intro-grid,.mision-grid', 1.97],
  ['.st-baffle.guiada', '.st-baffle-pin', '.mision-grid', .55],
  ['.surface-proceso', '.surface-pin', '.surface-pin > div:not(.surface-quieto)', 1.1],
];
escenas.forEach(([selector, selectorPin, selectorContenido, pantallas]) => {
  const seccion=document.querySelector(selector);
  if(!seccion || quieto.matches) return;
  const pin=seccion.querySelector(selectorPin);
  const contenido=[...seccion.querySelectorAll(selectorContenido)];
  let anterior='', pendiente=0;
  const medir=()=>{
    pendiente=0;
    if(seccion.classList.contains('corrida') || seccion.classList.contains('surface-flujo') || (seccion.matches('.surface-proceso') && innerHeight<700)) return;
    const estilo=getComputedStyle(pin);
    const superficie=seccion.matches('.surface-proceso');
    const altos=contenido.map(e=>e.getBoundingClientRect().height);
    const caja=superficie ? altos.reduce((s,h)=>s+h,0)+parseFloat(estilo.rowGap||0)*(altos.length-1) : Math.max(...altos);
    const borde=seccion.matches('.st-galeria') ? 96 : parseFloat(estilo.paddingTop)+parseFloat(estilo.paddingBottom);
    const alto=Math.ceil(caja+borde);
    const presupuesto=Math.round(innerHeight*pantallas);
    const clave=`${alto}/${presupuesto}`;
    if(clave===anterior) return;
    anterior=clave;
    const espacioDisponible=innerHeight-Math.max(0,parseFloat(estilo.top)||0);
    if(alto>espacioDisponible) {
      seccion.classList.add(superficie ? 'surface-flujo' : 'corrida');
      seccion.classList.remove('guiada'); seccion.style.height='auto';
      seccion.querySelectorAll('[inert]').forEach(e=>{e.inert=false;});
      dispatchEvent(new Event('scroll')); return;
    }
    seccion.classList.remove('surface-flujo');
    seccion.style.setProperty('--alto-pin',`${alto}px`);
    seccion.style.height=`${alto+presupuesto}px`;
    dispatchEvent(new Event('scroll'));
  };
  const pedir=()=>{if(!pendiente) pendiente=requestAnimationFrame(medir);};
  const observador=new ResizeObserver(pedir);
  contenido.forEach(e=>observador.observe(e));
  addEventListener('resize',pedir); document.fonts.ready.then(pedir); pedir();
});

// El formulario conserva sus valores y protege el foco sin recopilar datos.
const dialogo = document.querySelector('.piloto-dialogo');
if (dialogo) {
  const abrir = document.querySelector('[data-piloto-abrir]');
  const formulario = dialogo.querySelector('form');
  const resumen = dialogo.querySelector('[data-piloto-resumen]');
  let desborde = '';
  abrir.addEventListener('click', () => {
    desborde = document.body.style.overflow;
    dialogo.showModal(); document.body.style.overflow = 'hidden';
    (resumen.hidden ? formulario.querySelector('select') : dialogo.querySelector('[data-piloto-editar]')).focus({preventScroll:true});
  });
  const cerrar = () => dialogo.close();
  dialogo.addEventListener('keydown',e=>{
    if(e.key!=='Tab') return;
    const elementos=[...dialogo.querySelectorAll('button,input,select,textarea,a[href]')]
      .filter(n=>!n.disabled && n.getClientRects().length>0);
    const primero=elementos[0], ultimo=elementos.at(-1);
    if(e.shiftKey && document.activeElement===primero) {e.preventDefault();ultimo.focus();}
    else if(!e.shiftKey && document.activeElement===ultimo) {e.preventDefault();primero.focus();}
  });
  dialogo.querySelector('[data-piloto-cerrar]').addEventListener('click', cerrar);
  dialogo.addEventListener('click', e => {
    if (e.target !== dialogo) return;
    const r = dialogo.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) cerrar();
  });
  dialogo.addEventListener('close', () => {
    document.body.style.overflow = desborde; abrir.focus({preventScroll:true});
  });
  formulario.addEventListener('submit', e => {
    e.preventDefault(); if (!formulario.reportValidity()) return;
    formulario.hidden = true; resumen.hidden = false;
    dialogo.querySelector('[data-piloto-editar]').focus({preventScroll:true});
    dialogo.scrollTop = 0;
  });
  dialogo.querySelector('[data-piloto-editar]').addEventListener('click', () => {
    resumen.hidden = true; formulario.hidden = false;
    formulario.querySelector('select').focus({preventScroll:true}); dialogo.scrollTop = 0;
  });
}

// Una sola reproducción breve: se puede pausar, recorrer o repetir.
const momento = document.querySelector('[data-hallazgo]');
if (momento) {
  const figura = momento.closest('figure');
  const control = figura.querySelector('[data-hallazgo-control]');
  const play = figura.querySelector('[data-hallazgo-play]');
  const punto = momento.querySelector('.hallazgo-punto');
  const segundos = momento.querySelector('[data-hallazgo-segundos]');
  let cuadro = 0, inicio = 0, valor = 41, reproduciendo = false, usado = false;
  const pintar = v => {
    valor = Math.min(41,Math.max(0,v)); control.value = Math.round(valor);
    segundos.textContent = Math.round(valor);
    const p = valor/41;
    const x = p < .65 ? 950-70*(p/.65) : 880+590*((p-.65)/.35);
    const y = p < .65 ? 1000-350*(p/.65) : 650+120*((p-.65)/.35);
    punto.setAttribute('cx',x); punto.setAttribute('cy',y);
    momento.style.setProperty('--recorrido',p.toFixed(3));
    momento.classList.toggle('hallazgo-final',p >= .97);
    control.setAttribute('aria-valuetext',texto(`${Math.round(valor)} segundos de espera`,`${Math.round(valor)} seconds of waiting`));
  };
  const parar = () => {
    cancelAnimationFrame(cuadro); cuadro=0; reproduciendo=false;
    play.textContent=texto('Repetir el momento','Replay the moment');
  };
  const animar = ahora => {
    pintar((ahora-inicio)/5200*41);
    if (valor < 41) cuadro=requestAnimationFrame(animar); else parar();
  };
  const reproducir = () => {
    usado=true;
    if (quieto.matches) { pintar(41); return; }
    reproduciendo=true; inicio=performance.now(); pintar(0);
    play.textContent=texto('Pausar el momento','Pause the moment');
    cuadro=requestAnimationFrame(animar);
  };
  play.addEventListener('click',()=>reproduciendo ? parar() : reproducir());
  control.addEventListener('input',()=>{usado=true;parar();pintar(+control.value);});
  figura.addEventListener('focusin',e=>{usado=true;if(e.target !== play && reproduciendo) parar();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden) parar();});
  new IntersectionObserver(([e])=>{
    if(e.isIntersecting && !usado && !quieto.matches) reproducir();
    else if(!e.isIntersecting && reproduciendo) parar();
  },{threshold:.55}).observe(momento);
  quieto.addEventListener('change',()=>{parar();pintar(41);});
  pintar(41);
}

// CubeSat → instrumento: el modelo del sitio se reutiliza y sólo se carga al pedirlo.
const integracion = document.querySelector('[data-integracion]');
if (integracion) {
  const abrir = integracion.querySelector('[data-integracion-abrir]');
  const pieza = integracion.querySelector('.integracion-instrumento');
  const mision=document.querySelector('[data-mision]');
  const origen=document.createComment('posición de los controles en computadora');
  mision.before(origen);
  const movil=matchMedia('(max-width: 760px)');
  const ubicar=()=>{
    if(movil.matches) integracion.prepend(mision);
    else origen.parentNode.insertBefore(mision,origen.nextSibling);
  };
  movil.addEventListener('change',ubicar); ubicar();
  let visor = null, pedido = false;
  abrir.addEventListener('click',async()=>{
    const ampliado = abrir.getAttribute('aria-pressed') !== 'true';
    abrir.setAttribute('aria-pressed',String(ampliado));
    abrir.textContent=ampliado ? texto('Ver en el CubeSat','View in the CubeSat') : texto('Acercarme al instrumento','Explore the instrument');
    integracion.classList.toggle('instrumento-visible',ampliado); pieza.hidden=!ampliado;
    if(!ampliado || pedido || quieto.matches || document.documentElement.dataset.webgl === 'off') return;
    pedido=true;
    try {
      const m=await import('./space-3d.js?v=20261025e');
      visor=m.montarStarTracker({contenedor:pieza,lienzo:pieza.querySelector('canvas'),base:new URL('assets/space/',import.meta.url).href,modo:'armado',reducir:quieto.matches});
      await visor.listo; visor.fijar(integracion.dataset.funcion==='2' ? 1 : 0); pieza.classList.add('con-modelo');
    } catch { pieza.classList.add('sin-modelo'); }
  });
  document.querySelectorAll('[data-mision-opcion]').forEach((b,i)=>b.addEventListener('click',()=>{
    if(abrir.getAttribute('aria-pressed')!=='true') abrir.click();
    integracion.dataset.funcion=String(i); visor?.fijar(i===2 ? 1 : 0);
  }));
}

// El recorte sale de la misma imagen que se elige, con una transición corta de contexto.
const receta = document.querySelector('[data-receta]');
if (receta) {
  const fragmento=receta.querySelector('[data-receta-fragmento]');
  const poner = () => {
    const elegido=receta.querySelector('[data-receta-elegir]').getAttribute('aria-pressed')==='true';
    fragmento.hidden=!elegido; receta.classList.toggle('receta-elegida',elegido);
  };
  receta.addEventListener('click',poner);
  poner();
}

// Los estados de Surface se animan desde su geometría, sin cambiar sus medidas.
const surface=document.querySelector('[data-surface]');
if(surface) {
  const poner = () => surface.querySelector('.surface-vista').setAttribute('data-paso',surface.dataset.surfacePaso);
  new MutationObserver(poner).observe(surface,{attributes:true,attributeFilter:['data-surface-paso']});
  poner();
}
