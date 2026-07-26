import { readFile } from "node:fs/promises";
import path from "node:path";
import Script from "next/script";

export default async function Page() {
  const html = await readFile(path.join(process.cwd(), "public", "index.html"), "utf8");
  const body = html
    .split("<body>")[1]
    .split("</body>")[0]
    .replace('<script src="script.js"></script>', "");

  return (
    <>
      <link rel="stylesheet" href="/styles.css" />
      <div dangerouslySetInnerHTML={{ __html: body }} />
      <Script src="/script.js" strategy="afterInteractive" />
    </>
  );
}
