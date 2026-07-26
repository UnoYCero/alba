import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const source = resolve("public");
const destination = resolve("dist");

if (!existsSync(source)) {
  throw new Error("The public source directory is missing.");
}

rmSync(destination, { recursive: true, force: true });
mkdirSync(destination, { recursive: true });
cpSync(source, destination, { recursive: true });

console.log("Static site prepared in dist/");
