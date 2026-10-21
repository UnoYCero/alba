import { readFile } from "node:fs/promises";
import path from "node:path";

// Página de error de albavision.tech. La fuente es public/404.html (se puede abrir sola);
// de ahí se toman su <style> y su <body>, igual que page.js lo hace con la portada.
export const metadata = {
  title: "Página no encontrada · Alba Vision",
  robots: { index: false },
  icons: { icon: "/assets/favicon.svg" }
};

export default async function NotFound() {
  // Sin los comentarios, para que un comentario que nombre una etiqueta no confunda la búsqueda
  const html = (await readFile(path.join(process.cwd(), "public", "404.html"), "utf8")).replace(/<!--[\s\S]*?-->/g, "");
  const estilo = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "";
  const cuerpo = html.match(/<body[^>]*>([\s\S]*?)<\/body>/)?.[1] ?? "";

  return (
    <>
      <link rel="stylesheet" href="/landing.css" precedence="default" />
      <link rel="stylesheet" href="/amanecer.css" precedence="default" />
      <style dangerouslySetInnerHTML={{ __html: estilo }} />
      <div dangerouslySetInnerHTML={{ __html: cuerpo }} />
    </>
  );
}
