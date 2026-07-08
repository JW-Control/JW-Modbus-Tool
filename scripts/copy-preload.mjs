import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(rootDir, "src", "preload", "preload.cjs");
const targetDir = path.join(rootDir, "dist-electron", "preload");
const target = path.join(targetDir, "preload.cjs");

await mkdir(targetDir, { recursive: true });
await copyFile(source, target);
