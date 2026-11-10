// Piezas del plan integral. No se carga en UNBLIND ni en Órbita.
const quieto = matchMedia('(prefers-reduced-motion: reduce)');
const en = document.documentElement.lang === 'en';
const texto = (es, ingles) => en ? ingles : es;

// Si deja de caber una escena, esa visita continúa en lectura natural. No se vuelve
// a fijar a mitad de la lectura al rotar o ampliar la ventana.
const compacto=matchMedia('(max-height: 599px)');
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
    (resumen.hidden ? formulario.querySelector('select,input,textarea') : dialogo.querySelector('[data-piloto-editar]')).focus({preventScroll:true});
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
    formulario.querySelector('select,input,textarea').focus({preventScroll:true}); dialogo.scrollTop = 0;
  });
}

// Los 41 segundos: la fila quieta, una persona que espera y se va, y el hallazgo. Corre una vez al
// llegar y se queda en el final; puede volver a correr si la persona regresa después de un rato.
const momento = document.querySelector('[data-momento]');
if (momento) {
  const svg=momento.querySelector('[data-escena]'), cliente=momento.querySelector('[data-cliente]');
  const halo=cliente.querySelector('.motion-halo'), reloj=momento.querySelector('[data-segundos]'), hallazgo=momento.querySelector('[data-final]');
  const movil=matchMedia('(max-width: 760px)');
  const DURACION=5800, REGRESO=20000;
  const limitar=n=>Math.max(0,Math.min(1,n)), suave=n=>n*n*(3-2*n);
  let cuadro=0, inicio=0, visible=false, listo=false, hecho=false, salio=0;
  // En celular se acerca el encuadre sin perder la fila ni la puerta
  const encuadre=()=>svg.setAttribute('viewBox',movil.matches ? '400 0 1100 1024' : '0 0 1536 1024');
  movil.addEventListener('change',encuadre); encuadre();
  const pintar=fraccion=>{
    const tiempo=fraccion*DURACION;
    const espera=limitar((tiempo-1050)/2500);
    // El final de la cuenta tarda más que su principio: se siente la espera
    const segundos=espera<.55 ? 35*espera/.55 : 35+6*(espera-.55)/.45;
    const salida=suave(limitar((tiempo-3650)/1300));
    // Sale por el pasillo libre, rodea a la otra persona y va hacia la puerta
    const x=salida<.52 ? 330*salida/.52 : 330+205*(salida-.52)/.48;
    const y=salida<.52 ? -25*salida/.52 : -25-355*(salida-.52)/.48;
    const balance=salida>0 && salida<1 ? Math.sin(salida*Math.PI*6)*1.8 : 0;
    cliente.setAttribute('transform',`translate(${x} ${y+balance}) translate(812 947) scale(${1-.22*salida}) translate(-812 -947)`);
    cliente.setAttribute('opacity',String(1-suave(limitar((salida-.82)/.18))));
    halo.setAttribute('opacity',String(suave(limitar((tiempo-450)/450))*(1-suave(limitar((tiempo-3400)/650)))));
    reloj.textContent=String(Math.min(41,Math.round(segundos)));
    const final=suave(limitar((tiempo-4950)/650));
    hallazgo.style.opacity=String(final); hallazgo.style.transform=`translateY(${(1-final)*8}px)`;
  };
  const terminar=()=>{cancelAnimationFrame(cuadro); cuadro=0; hecho=true; pintar(1);};
  const animar=ahora=>{const p=limitar((ahora-inicio)/DURACION); pintar(p); if(p<1) cuadro=requestAnimationFrame(animar); else terminar();};
  const entrar=()=>{
    if(!listo || !visible || document.hidden) return;
    if(quieto.matches) {terminar(); return;}
    if(cuadro || hecho) return;
    inicio=performance.now(); pintar(0); cuadro=requestAnimationFrame(animar);
  };
  new IntersectionObserver(([e])=>{
    visible=e.isIntersecting;
    if(visible) {if(salio && performance.now()-salio>=REGRESO) hecho=false; entrar();}
    else {salio=performance.now(); if(cuadro) terminar();}
  },{threshold:.5}).observe(momento);
  document.addEventListener('visibilitychange',()=>{if(document.hidden && cuadro) terminar(); else entrar();});
  quieto.addEventListener('change',()=>{if(quieto.matches) terminar();});
  // Sin JavaScript o sin imágenes, la figura ya muestra el final
  const urls=[...new Set([...svg.querySelectorAll('image')].map(i=>i.href.baseVal))];
  Promise.all(urls.map(url=>{const img=new Image(); img.src=new URL(url,location.href).href; return img.decode();}))
    .then(()=>{listo=true; entrar();}).catch(terminar);
}

// CubeSat → instrumento: el modelo del sitio se reutiliza y sólo se carga al pedirlo.
const integracion = document.querySelector('[data-integracion]');
if (integracion) {
  const abrir = integracion.querySelector('[data-integracion-abrir]');
  const pieza = integracion.querySelector('.integracion-instrumento');
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
  document.querySelectorAll('[data-mision-opcion]').forEach((a,i)=>['pointerenter','focus'].forEach(ev=>a.addEventListener(ev,()=>{
    integracion.dataset.funcion=String(i); visor?.fijar(i===2 ? 1 : 0);
  })));
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
