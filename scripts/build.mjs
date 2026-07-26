import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const source = resolve("public");
const destination = resolve("dist");

if (!existsSync(source)) {
  throw new Error("The public source directory is missing.");
}

rmSync(destination, { recursive: true, force: true });
mkdirSync(resolve(destination, "assets"), { recursive: true });
mkdirSync(resolve(destination, "server"), { recursive: true });
mkdirSync(resolve(destination, ".openai"), { recursive: true });

cpSync(source, resolve(destination, "assets"), { recursive: true });
copyFileSync(resolve("worker", "index.js"), resolve(destination, "server", "index.js"));
copyFileSync(resolve(".openai", "hosting.json"), resolve(destination, ".openai", "hosting.json"));
writeFileSync(resolve(destination, "package.json"), '{"type":"module"}\n');

console.log("Sites worker and static assets prepared in dist/");
