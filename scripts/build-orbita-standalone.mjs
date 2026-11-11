import {cp,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const output=new URL('../dist-orbita/',import.meta.url);
await mkdir(output,{recursive:true});
await cp(new URL('../public/orbita/',import.meta.url),new URL('./orbita/',output),{recursive:true});
await writeFile(new URL('./index.html',output),'<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Órbita</title><main><h1>Órbita</h1><p>Plataforma de agentes de Alba Vision.</p><p><a href="/orbita/panel">Administrar agentes</a></p><p><a href="/orbita/index.html">Información del servicio</a> · <a href="/orbita/privacy.html">Privacidad</a></p></main></html>');
console.log('Órbita standalone: '+fileURLToPath(output));
